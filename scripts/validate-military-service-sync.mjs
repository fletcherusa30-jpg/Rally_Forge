import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

const MOS_FILES = {
  Army: 'army.json',
  'Marine Corps': 'marine-corps.json',
  Navy: 'navy.json',
  'Air Force': 'air-force.json',
  'Space Force': 'space-force.json',
  'Coast Guard': 'coast-guard.json',
  'Public Health Service Commissioned Corps (USPHS)': 'usphs.json',
  'NOAA Commissioned Officer Corps': 'noaa.json',
};

const ranksByBranch = {
  Army: { enlisted: ['E-1'], warrant: ['W-1'], officer: ['O-1'] },
  'Marine Corps': { enlisted: ['E-1'], warrant: ['W-1'], officer: ['O-1'] },
  Navy: { enlisted: ['E-1'], warrant: ['W-2'], officer: ['O-1'] },
  'Air Force': { enlisted: ['E-1'], warrant: [], officer: ['O-1'] },
  'Space Force': { enlisted: ['E-1'], warrant: [], officer: ['O-1'] },
  'Coast Guard': { enlisted: ['E-1'], warrant: ['W-2'], officer: ['O-1'] },
  'Public Health Service Commissioned Corps (USPHS)': { enlisted: [], warrant: [], officer: ['O-1'] },
  'NOAA Commissioned Officer Corps': { enlisted: [], warrant: [], officer: ['O-1'] },
};

function rankToDutyType(rank) {
  if (!rank) return '';
  if (rank.startsWith('W-')) return 'warrant';
  if (rank.startsWith('O-')) return 'officer';
  return 'enlisted';
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

async function readJson(filePath) {
  const buffer = await fs.readFile(filePath);
  const utf8 = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();

  try {
    return JSON.parse(utf8);
  } catch {
    const utf16 = buffer.toString('utf16le').replace(/^\uFEFF/, '').trim();
    return JSON.parse(utf16);
  }
}

async function main() {
  const exposuresPath = path.join(ROOT, 'knowledge', 'exposures', 'exposure-index.json');
  const exposureIndex = await readJson(exposuresPath);
  const exposureExamples = new Set(
    (Array.isArray(exposureIndex) ? exposureIndex : [])
      .flatMap((entry) => (Array.isArray(entry?.examples) ? entry.examples : []))
      .map((code) => normalizeCode(code))
      .filter(Boolean)
  );

  const issues = [];
  const summary = [];

  for (const [branch, fileName] of Object.entries(MOS_FILES)) {
    const catalog = await readJson(path.join(ROOT, 'knowledge', 'mos', fileName));
    const entries = Array.isArray(catalog?.mos) ? catalog.mos : [];

    const byType = {
      enlisted: entries.filter((entry) => entry?.type === 'enlisted'),
      warrant: entries.filter((entry) => entry?.type === 'warrant'),
      officer: entries.filter((entry) => entry?.type === 'officer'),
    };

    const ranks = ranksByBranch[branch];

    for (const tier of ['enlisted', 'warrant', 'officer']) {
      if ((ranks[tier] || []).length === 0) continue;
      if (byType[tier].length === 0) {
        issues.push(`[${branch}] missing ${tier} MOS/rating/designator entries despite rank tier support`);
      }
    }

    const duplicates = [];
    const seen = new Set();
    for (const entry of entries) {
      const key = `${entry?.type}|${normalizeCode(entry?.code)}`;
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }

    if (duplicates.length > 0) {
      issues.push(`[${branch}] duplicate code/type entries: ${[...new Set(duplicates)].join(', ')}`);
    }

    const rankChecks = [];
    for (const tier of ['enlisted', 'warrant', 'officer']) {
      const sampleRank = ranks[tier]?.[0];
      if (!sampleRank) continue;
      const dutyType = rankToDutyType(sampleRank);
      const filtered = entries.filter((entry) => entry?.type === dutyType);
      rankChecks.push({ tier, sampleRank, dutyType, count: filtered.length });
      if (filtered.length === 0) {
        issues.push(`[${branch}] rank ${sampleRank} maps to ${dutyType}, but no matching options found`);
      }
    }

    const mappedExposureCount = entries
      .map((entry) => normalizeCode(entry?.code))
      .filter((code) => exposureExamples.has(code)).length;

    summary.push({
      branch,
      fileName,
      total: entries.length,
      enlisted: byType.enlisted.length,
      warrant: byType.warrant.length,
      officer: byType.officer.length,
      mappedExposureCount,
      rankChecks,
    });
  }

  console.log(JSON.stringify({ summary, issueCount: issues.length, issues }, null, 2));
  if (issues.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
