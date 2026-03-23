import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MASTER_PATH = path.join(__dirname, '..', '..', 'knowledge', 'mos', 'generated', 'dod-mos-master.json');

let cache = null;

function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeBranch(branch) {
  const raw = String(branch || '').trim().toUpperCase();
  if (!raw) return '';

  const aliases = {
    ARMY: 'Army',
    USMC: 'USMC',
    'MARINE CORPS': 'USMC',
    MARINES: 'USMC',
    NAVY: 'Navy',
    AIRFORCE: 'AirForce',
    'AIR FORCE': 'AirForce',
    USAF: 'AirForce',
    SPACEFORCE: 'SpaceForce',
    'SPACE FORCE': 'SpaceForce',
    USSF: 'SpaceForce',
    COASTGUARD: 'CoastGuard',
    'COAST GUARD': 'CoastGuard',
    USCG: 'CoastGuard',
  };

  return aliases[raw] || '';
}

function normalizeRankCategory(rankCategory) {
  const raw = String(rankCategory || '').trim().toUpperCase();
  if (!raw) return '';

  if (raw === 'ENLISTED') return 'Enlisted';
  if (raw === 'WARRANT OFFICER' || raw === 'WARRANT') return 'Warrant Officer';
  if (raw === 'OFFICER') return 'Officer';
  return '';
}

function loadMasterRegistry() {
  if (cache) return cache;
  const raw = fs.readFileSync(MASTER_PATH, 'utf8').replace(/^\uFEFF/, '');
  const records = JSON.parse(raw);

  const byBranchAndCode = new Map();
  const byBranchCodeAndRank = new Map();

  for (const record of records) {
    const branch = normalizeBranch(record.branch);
    const code = normalizeCode(record.code);
    const rankCategory = normalizeRankCategory(record.rankCategory);
    if (!branch || !code || !rankCategory) continue;

    const key = `${branch}::${code}`;
    const rankKey = `${branch}::${code}::${rankCategory}`;

    if (!byBranchAndCode.has(key)) byBranchAndCode.set(key, []);
    byBranchAndCode.get(key).push(record);

    byBranchCodeAndRank.set(rankKey, record);
  }

  cache = {
    records,
    byBranchAndCode,
    byBranchCodeAndRank,
    masterPath: MASTER_PATH,
  };

  return cache;
}

function clearMasterRegistryCache() {
  cache = null;
}

export {
  MASTER_PATH,
  clearMasterRegistryCache,
  loadMasterRegistry,
  normalizeBranch,
  normalizeCode,
  normalizeRankCategory,
};
