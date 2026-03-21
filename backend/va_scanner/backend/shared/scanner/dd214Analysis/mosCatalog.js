import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'knowledge', 'mos');
let cache = null;

function readJsonWithFallback(filePath) {
  const raw = fs.readFileSync(filePath);
  let text = raw.toString('utf8').replace(/^\uFEFF/, '');
  try {
    return JSON.parse(text);
  } catch {
    text = raw.toString('utf16le').replace(/^\uFEFF/, '');
    return JSON.parse(text);
  }
}

function loadCatalog() {
  if (cache) return cache;

  const files = {
    Army: 'army.json',
    Navy: 'navy.json',
    'Air Force': 'air-force.json',
    'Marine Corps': 'marine-corps.json',
    'Coast Guard': 'coast-guard.json',
    'Space Force': 'space-force.json',
  };

  const catalog = {};
  for (const [branch, file] of Object.entries(files)) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) continue;
    const data = readJsonWithFallback(filePath);
    const tiers = data?.tiers || {};

    const byCode = new Map();
    for (const [tier, entries] of Object.entries(tiers)) {
      for (const entry of entries || []) {
        const code = String(entry?.code || '').toUpperCase().trim();
        if (!code) continue;
        byCode.set(code, { tier, title: entry?.title || null, branch });
      }
    }
    catalog[branch] = byCode;
  }

  cache = catalog;
  return catalog;
}

function normalizeBranch(branch) {
  const value = String(branch || '').toUpperCase();
  if (value.includes('ARMY')) return 'Army';
  if (value.includes('NAVY')) return 'Navy';
  if (value.includes('AIR FORCE')) return 'Air Force';
  if (value.includes('MARINE')) return 'Marine Corps';
  if (value.includes('COAST GUARD')) return 'Coast Guard';
  if (value.includes('SPACE FORCE')) return 'Space Force';
  return null;
}

function expectedTierFromPayGrade(payGrade) {
  const value = String(payGrade || '').toUpperCase().replace(/\s+/g, '');
  if (/^E-?\d+/.test(value)) return 'enlisted';
  if (/^W-?\d+/.test(value)) return 'warrant';
  if (/^O-?\d+/.test(value)) return 'officer';
  return null;
}

export function validateMosAgainstCatalog({ branch, payGrade, mosCode }) {
  const branchKey = normalizeBranch(branch);
  const code = String(mosCode || '').toUpperCase().trim();
  const expectedTier = expectedTierFromPayGrade(payGrade);

  if (!branchKey || !code) {
    return { valid: false, reason: 'insufficient-data', branch: branchKey, code, expectedTier };
  }

  const catalog = loadCatalog();
  const branchCatalog = catalog[branchKey];
  if (!branchCatalog) {
    return { valid: false, reason: 'branch-catalog-missing', branch: branchKey, code, expectedTier };
  }

  const exact = branchCatalog.get(code);
  const wildcardMatch = [...branchCatalog.entries()].find(([key]) => key.includes('X') && new RegExp(`^${key.replace('X', '[A-Z0-9]')}$`).test(code));
  const hit = exact || wildcardMatch?.[1] || null;

  if (!hit) {
    return { valid: false, reason: 'code-not-in-branch', branch: branchKey, code, expectedTier };
  }

  if (expectedTier && hit.tier !== expectedTier) {
    return { valid: false, reason: 'tier-mismatch', branch: branchKey, code, expectedTier, actualTier: hit.tier };
  }

  return {
    valid: true,
    branch: branchKey,
    code,
    expectedTier,
    actualTier: hit.tier,
    title: hit.title,
  };
}
