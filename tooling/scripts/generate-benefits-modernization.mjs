import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const INPUT_STATE_JSON = path.join(repoRoot, 'knowledge', 'State_Benefits', 'state-benefits.json');
const INPUT_FEDERAL_RULES = path.join(repoRoot, 'backend', 'rules', 'federalRules.json');

const OUTPUT_DIR = path.join(repoRoot, 'resources', 'state-benefits');
const OUTPUT_COMBINED_JSON = path.join(repoRoot, 'resources', 'state-benefits.json');
const OUTPUT_AUDIT_JSON = path.join(repoRoot, 'resources', 'state-benefits.audit.json');
const OUTPUT_SNAPSHOT_JSON = path.join(repoRoot, 'resources', 'state-benefits.snapshot.json');
const OUTPUT_FRONTEND_MODULE = path.join(repoRoot, 'app', 'frontend-modern', 'src', 'data', 'stateBenefits.js');
const OUTPUT_BACKEND_GENERATED_SERVICE = path.join(repoRoot, 'backend', 'services', 'stateBenefitsService.generated.js');

const DISCOVERED_FILES = {
  state: [
    'app/frontend-modern/src/pages/StateBenefitsPage.jsx',
    'backend/api/stateBenefits.js',
    'backend/controllers/stateBenefitsController.js',
    'backend/services/stateBenefitsService.js',
    'app/frontend-modern/src/api/client.js',
    'backend/engine/benefits/stateBenefits.js',
    'knowledge/State_Benefits/state-benefits.json',
  ],
  federal: [
    'backend/rules/federalRules.json',
    'backend/engine/federalBenefits.js',
    'backend/engine/benefits/federalBenefits.js',
    'backend/services/federalService.js',
    'backend/engine/benefits/benefitsEngine.js',
    'backend/domain/engines/BenefitsEngine.js',
  ],
  combined: [
    'backend/api/benefits.js',
    'backend/controllers/benefitsController.js',
    'backend/api/routeManifest.js',
    'backend/services/benefitsService.js',
  ],
};

const STATE_ORDER = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const CATEGORY_MAP = new Map([
  ['property tax', 'Property Tax'],
  ['education', 'Education'],
  ['employment', 'Employment'],
  ['vehicle', 'Vehicle'],
  ['hunting/fishing', 'Hunting and Fishing'],
  ['housing', 'Housing'],
  ['benefits', 'General Benefits'],
  ['income', 'Income'],
  ['insurance', 'Insurance'],
  ['healthcare', 'Healthcare'],
  ['caregiver', 'Caregiver'],
]);

function normalizeCategory(input) {
  const raw = String(input || '').trim();
  if (!raw) return 'General Benefits';
  const mapped = CATEGORY_MAP.get(raw.toLowerCase());
  if (mapped) return mapped;
  return raw
    .split(/[\s/_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalizeUrl(input) {
  const value = String(input || '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function normalizeRatingThreshold(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.round(numeric);
}

function computeConfidence({ benefit, normalized }) {
  let score = 0.55;
  if (normalized.url) score += 0.15;
  if (normalized.description) score += 0.1;
  if (normalized.eligibility.conditions.length > 0) score += 0.1;
  if (benefit?.metadata?.source) score += 0.05;
  if (benefit?.metadata?.last_verified) score += 0.05;
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

function buildEligibility(benefit) {
  const ratingThreshold = normalizeRatingThreshold(benefit?.rating_min);
  const conditions = [];
  if (benefit?.requires_service_connection) conditions.push('service-connected');
  if (benefit?.requires_homeowner) conditions.push('homeowner');
  if (benefit?.requires_wartime_service) conditions.push('wartime-service');
  if (benefit?.requires_combat_flag) conditions.push('combat-veteran');

  return {
    ratingThreshold,
    conditions,
  };
}

function buildFederalPrograms(federalRules) {
  const rules = Array.isArray(federalRules?.rules) ? federalRules.rules : [];

  return rules.map((rule) => {
    const outcome = Array.isArray(rule?.outcomes) ? rule.outcomes[0] : null;
    const categoryTag = Array.isArray(outcome?.tags)
      ? outcome.tags.find((tag) => String(tag || '').toLowerCase() !== 'federal')
      : null;

    const program = {
      id: String(rule?.id || '').trim(),
      category: normalizeCategory(categoryTag || 'General Benefits'),
      title: String(outcome?.title || rule?.description || 'Federal VA Program').trim(),
      description: String(outcome?.description || rule?.description || '').trim(),
      eligibility: {
        conditions: (Array.isArray(rule?.conditions) ? rule.conditions : []).map((condition) => {
          const field = String(condition?.field || '').trim();
          const operator = String(condition?.operator || '').trim();
          const value = condition?.value;
          return `${field} ${operator} ${JSON.stringify(value)}`.trim();
        }).filter(Boolean),
      },
      url: normalizeUrl(outcome?.link),
      provenance: 'federal',
      confidence: 1,
    };

    return program;
  }).filter((program) => program.id && program.title);
}

function toCanonicalStateRecord(stateCode, stateName, benefits, federalOverlay) {
  return {
    stateCode,
    stateName,
    benefits,
    federal: federalOverlay,
  };
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function getCoverage(statesMap) {
  const presentStates = Array.from(statesMap.keys()).sort();
  const missingStates = STATE_ORDER.filter((stateCode) => !statesMap.has(stateCode));
  return {
    expectedStates: STATE_ORDER,
    presentStates,
    missingStates,
    isComplete50States: missingStates.length === 0,
  };
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, payload) {
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.writeFile(filePath, text, 'utf8');
}

function buildFrontendModule(records, metadata) {
  const payloadText = JSON.stringify({ metadata, records }, null, 2);
  return [
    '// Auto-generated by tooling/scripts/generate-benefits-modernization.mjs',
    '// Source of truth: knowledge/STATE_BENEFITS/STATE_BENEFITS_DATABASE.json + backend/rules/federalRules.json',
    `export const stateBenefitsMetadata = ${JSON.stringify(metadata, null, 2)};`,
    `export const stateBenefitsRecords = ${payloadText}.records;`,
    'export default stateBenefitsRecords;',
    '',
  ].join('\n');
}

function buildGeneratedBackendService() {
  return `// Auto-generated by tooling/scripts/generate-benefits-modernization.mjs\nimport fs from 'node:fs/promises';\nimport path from 'node:path';\nimport { fileURLToPath } from 'node:url';\n\nconst __filename = fileURLToPath(import.meta.url);\nconst __dirname = path.dirname(__filename);\nconst combinedPath = path.resolve(__dirname, '../../resources/state-benefits.json');\nconst auditPath = path.resolve(__dirname, '../../resources/state-benefits.audit.json');\n\nlet combinedCache = null;\nlet auditCache = null;\n\nexport async function loadUnifiedStateBenefits() {\n  if (!combinedCache) {\n    const raw = await fs.readFile(combinedPath, 'utf8');\n    combinedCache = JSON.parse(raw);\n  }\n  return combinedCache;\n}\n\nexport async function loadUnifiedStateBenefitsAudit() {\n  if (!auditCache) {\n    const raw = await fs.readFile(auditPath, 'utf8');\n    auditCache = JSON.parse(raw);\n  }\n  return auditCache;\n}\n\nexport async function getUnifiedStateBenefitsByCode(stateCode) {\n  const dataset = await loadUnifiedStateBenefits();\n  const code = String(stateCode || '').toUpperCase();\n  return (dataset.records || []).find((entry) => entry.stateCode === code) || null;\n}\n\nexport default {\n  loadUnifiedStateBenefits,\n  loadUnifiedStateBenefitsAudit,\n  getUnifiedStateBenefitsByCode,\n};\n`;
}

function normalizeStateBenefits(rawRecords, federalOverlay) {
  const grouped = new Map();

  for (const record of rawRecords) {
    if (!record || record.active === false) continue;
    const stateCode = String(record.state_code || '').toUpperCase();
    const stateName = String(record.state_name || '').trim();
    if (!stateCode || !stateName) continue;

    const eligibility = buildEligibility(record);
    const normalizedBenefit = {
      category: normalizeCategory(record.category),
      title: String(record.name || '').trim() || 'Untitled Benefit',
      description: String(record.description || '').trim(),
      eligibility,
      url: normalizeUrl(record.links),
      provenance: 'state',
      confidence: 0,
    };

    normalizedBenefit.confidence = computeConfidence({
      benefit: record,
      normalized: normalizedBenefit,
    });

    if (!grouped.has(stateCode)) {
      grouped.set(stateCode, {
        stateName,
        benefits: [],
      });
    }

    grouped.get(stateCode).benefits.push(normalizedBenefit);
  }

  for (const stateCode of STATE_ORDER) {
    if (!grouped.has(stateCode)) {
      grouped.set(stateCode, {
        stateName: 'Unknown',
        benefits: [],
      });
    }
  }

  const records = STATE_ORDER.map((stateCode) => {
    const state = grouped.get(stateCode);
    const dedupedBenefits = state.benefits
      .filter((benefit) => benefit.title)
      .sort((a, b) => {
        const byCategory = a.category.localeCompare(b.category);
        if (byCategory !== 0) return byCategory;
        return a.title.localeCompare(b.title);
      });

    return toCanonicalStateRecord(stateCode, state.stateName, dedupedBenefits, federalOverlay);
  });

  return records;
}

async function main() {
  const startedAt = new Date().toISOString();
  const [rawStateSource, rawFederalRules] = await Promise.all([
    readJson(INPUT_STATE_JSON),
    readJson(INPUT_FEDERAL_RULES),
  ]);

  const rawStateRecords = Array.isArray(rawStateSource)
    ? rawStateSource
    : (Array.isArray(rawStateSource?.records) ? rawStateSource.records : []);

  const federalPrograms = buildFederalPrograms(rawFederalRules);
  const federalOverlay = {
    summary: 'Federal VA programs normalized from backend/rules/federalRules.json',
    programs: federalPrograms,
  };

  const records = normalizeStateBenefits(rawStateRecords, federalOverlay);
  const coverage = getCoverage(new Map(records.map((item) => [item.stateCode, true])));

  const combined = {
    schemaVersion: '1.0.0',
    generatedAt: startedAt,
    source: {
      states: path.relative(repoRoot, INPUT_STATE_JSON).replace(/\\/g, '/'),
      federal: path.relative(repoRoot, INPUT_FEDERAL_RULES).replace(/\\/g, '/'),
    },
    coverage,
    records,
  };

  const previousCombined = await (async () => {
    try {
      return await readJson(OUTPUT_COMBINED_JSON);
    } catch {
      return null;
    }
  })();

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(path.dirname(OUTPUT_FRONTEND_MODULE), { recursive: true });
  await fs.mkdir(path.dirname(OUTPUT_BACKEND_GENERATED_SERVICE), { recursive: true });

  for (const record of records) {
    await writeJson(path.join(OUTPUT_DIR, `${record.stateCode}.json`), record);
  }

  await writeJson(OUTPUT_COMBINED_JSON, combined);

  const snapshot = {
    schemaVersion: combined.schemaVersion,
    generatedAt: combined.generatedAt,
    combinedHash: stableHash(combined.records),
    stateHashes: Object.fromEntries(records.map((record) => [record.stateCode, stableHash(record)])),
    coverage: combined.coverage,
    federalProgramCount: federalPrograms.length,
  };
  await writeJson(OUTPUT_SNAPSHOT_JSON, snapshot);

  const audit = {
    schemaVersion: '1.0.0',
    generatedAt: startedAt,
    discovery: DISCOVERED_FILES,
    extractedSchemas: {
      canonicalStateRecord: {
        stateCode: 'string',
        stateName: 'string',
        benefits: 'array',
        federal: 'object',
      },
      canonicalBenefit: {
        category: 'string',
        title: 'string',
        description: 'string',
        eligibility: {
          ratingThreshold: 'number',
          conditions: 'string[]',
        },
        url: 'string|null',
        provenance: 'state|federal',
        confidence: 'number(0..1)',
      },
      sourceStateBenefit: {
        category: 'string',
        name: 'string',
        rating_min: 'number',
        links: 'string',
        requires_service_connection: 'boolean',
        requires_homeowner: 'boolean',
        requires_wartime_service: 'boolean',
        requires_combat_flag: 'boolean',
      },
      sourceFederalRule: {
        id: 'string',
        description: 'string',
        conditions: 'array',
        outcomes: 'array',
      },
    },
    coverage,
    inputs: {
      stateRecords: Array.isArray(rawStateRecords) ? rawStateRecords.length : 0,
      federalRules: Array.isArray(rawFederalRules?.rules) ? rawFederalRules.rules.length : 0,
    },
    outputs: {
      stateFiles: records.length,
      combinedFile: path.relative(repoRoot, OUTPUT_COMBINED_JSON).replace(/\\/g, '/'),
      frontendModule: path.relative(repoRoot, OUTPUT_FRONTEND_MODULE).replace(/\\/g, '/'),
      backendGeneratedService: path.relative(repoRoot, OUTPUT_BACKEND_GENERATED_SERVICE).replace(/\\/g, '/'),
      snapshotFile: path.relative(repoRoot, OUTPUT_SNAPSHOT_JSON).replace(/\\/g, '/'),
    },
    categories: Array.from(new Set(records.flatMap((record) => record.benefits.map((benefit) => benefit.category)))).sort(),
    diff: {
      hadPreviousCombined: Boolean(previousCombined),
      previousRecordCount: Array.isArray(previousCombined?.records) ? previousCombined.records.length : 0,
      newRecordCount: records.length,
      previousHash: previousCombined ? stableHash(previousCombined.records || []) : null,
      newHash: stableHash(records),
      changed: previousCombined ? stableHash(previousCombined.records || []) !== stableHash(records) : true,
    },
  };

  await writeJson(OUTPUT_AUDIT_JSON, audit);
  await fs.writeFile(OUTPUT_FRONTEND_MODULE, buildFrontendModule(records, {
    schemaVersion: combined.schemaVersion,
    generatedAt: combined.generatedAt,
    federalProgramCount: federalPrograms.length,
    source: combined.source,
  }), 'utf8');
  await fs.writeFile(OUTPUT_BACKEND_GENERATED_SERVICE, buildGeneratedBackendService(), 'utf8');

  console.log(JSON.stringify({
    ok: true,
    generatedAt: startedAt,
    stateFiles: records.length,
    missingStates: coverage.missingStates,
    combinedFile: path.relative(repoRoot, OUTPUT_COMBINED_JSON).replace(/\\/g, '/'),
    auditFile: path.relative(repoRoot, OUTPUT_AUDIT_JSON).replace(/\\/g, '/'),
    snapshotFile: path.relative(repoRoot, OUTPUT_SNAPSHOT_JSON).replace(/\\/g, '/'),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
