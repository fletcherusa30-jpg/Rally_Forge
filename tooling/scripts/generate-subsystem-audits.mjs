import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const resourcesDir = path.join(repoRoot, 'resources');

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function extractVersion(text) {
  const match = String(text || '').match(/@version\s+([^\s]+)/i);
  return match ? match[1] : 'unknown';
}

function countMatches(text, pattern) {
  const matches = String(text || '').match(pattern);
  return matches ? matches.length : 0;
}

async function writeJson(fileName, value) {
  const target = path.join(resourcesDir, fileName);
  await fs.mkdir(resourcesDir, { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return target;
}

async function buildScannerAudit() {
  const diagnosticPath = path.join(repoRoot, 'backend', 'va_scanner', 'backend', 'scanner-diagnostic.js');
  const apiPath = path.join(repoRoot, 'backend', 'api', 'scanner.js');
  const text = await readText(diagnosticPath);
  const apiText = await readText(apiPath);

  return {
    schemaVersion: '1.0.0',
    subsystem: 'scanner',
    version: extractVersion(text),
    generatedAt: new Date().toISOString(),
    discovery: {
      files: [
        'backend/api/scanner.js',
        'backend/api/scannerDiagnostics.js',
        'backend/va_scanner/backend/scanner-diagnostic.js',
        'backend/va_scanner/backend/shared/scanner/vaDecisionScanner.js',
        'backend/engine/strs/strs-engine.js',
      ],
    },
    metrics: {
      endpointCount: countMatches(apiText, /router\.(get|post|put|patch|delete)\(/g),
      regexMentions: countMatches(apiText, /new RegExp|matchAll\(|\.match\(/g) + countMatches(text, /new RegExp|matchAll\(|\.match\(/g),
      confidenceMentions: countMatches(apiText, /confidence/gi),
      provenanceMentions: countMatches(apiText, /evidence|field|label/gi),
    },
    validation: {
      hasDiagnosticsModule: await exists(diagnosticPath),
      hasScannerApi: await exists(apiPath),
    },
    modernization: {
      status: 'modernized',
      notes: [
        'Scanner diagnostics artifact generated from existing scanner modules.',
        'Counts are derived from current source text and require no external state.',
      ],
    },
  };
}

async function buildAnalyzerAudit() {
  const derivationsPath = path.join(repoRoot, 'app', 'frontend-modern', 'src', 'context', 'workspaceDerivations.js');
  const snapshotTestPath = path.join(repoRoot, 'tests', 'analyzer', 'workspace-derivations.snapshot.test.js');
  const secondaryTestPath = path.join(repoRoot, 'tests', 'analyzer', 'workspace-derivations.secondary-mode.test.js');
  const text = await readText(derivationsPath);

  return {
    schemaVersion: '1.0.0',
    subsystem: 'analyzer',
    version: 'unknown',
    generatedAt: new Date().toISOString(),
    discovery: {
      files: [
        'app/frontend-modern/src/context/workspaceDerivations.js',
        'tests/analyzer/workspace-derivations.snapshot.test.js',
        'tests/analyzer/workspace-derivations.secondary-mode.test.js',
      ],
    },
    metrics: {
      derivationFunctions: countMatches(text, /export function /g),
      secondaryRules: countMatches(text, /id:\s*'/g),
      readinessMentions: countMatches(text, /readiness/gi),
      laneMentions: countMatches(text, /recommendedLane|lane/gi),
    },
    validation: {
      hasSnapshotTests: await exists(snapshotTestPath),
      hasSecondaryModeTests: await exists(secondaryTestPath),
    },
    modernization: {
      status: 'modernized',
      notes: [
        'Analyzer audit generated from derivation source and existing regression tests.',
      ],
    },
  };
}

async function buildCaseSummaryAudit() {
  const exportPath = path.join(repoRoot, 'app', 'frontend-modern', 'src', 'services', 'caseSummaryExport.js');
  const pagePath = path.join(repoRoot, 'app', 'frontend-modern', 'src', 'pages', 'CaseSummaryPage.jsx');
  const text = await readText(exportPath);
  const pageText = await readText(pagePath);

  return {
    schemaVersion: '1.0.0',
    subsystem: 'case-summary',
    version: 'unknown',
    generatedAt: new Date().toISOString(),
    discovery: {
      files: [
        'app/frontend-modern/src/pages/CaseSummaryPage.jsx',
        'app/frontend-modern/src/services/caseSummaryExport.js',
      ],
    },
    metrics: {
      exportFunctions: countMatches(text, /export function /g),
      packetSections: countMatches(text, /SECTION\s+[0-9]/g),
      evidenceIndexMentions: countMatches(text, /evidenceIndex/gi),
      pageConditionCards: countMatches(pageText, /ConditionCard/g),
    },
    validation: {
      hasPacketBuilder: /buildCaseSummaryPacket/.test(text),
      hasJsonBuilder: /buildCaseSummaryJson/.test(text),
      hasEvidenceIndexBuilder: /buildEvidenceIndex/.test(text),
    },
    modernization: {
      status: 'modernized',
      notes: [
        'Case summary audit generated from export helpers and page integration.',
      ],
    },
  };
}

async function main() {
  const [scannerAudit, analyzerAudit, caseSummaryAudit] = await Promise.all([
    buildScannerAudit(),
    buildAnalyzerAudit(),
    buildCaseSummaryAudit(),
  ]);

  await Promise.all([
    writeJson('scanner.audit.json', scannerAudit),
    writeJson('analyzer.audit.json', analyzerAudit),
    writeJson('case-summary.audit.json', caseSummaryAudit),
  ]);

  console.log(JSON.stringify({
    ok: true,
    outputs: [
      'resources/scanner.audit.json',
      'resources/analyzer.audit.json',
      'resources/case-summary.audit.json',
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
