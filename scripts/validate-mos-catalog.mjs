import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const MOS_DIR = path.join(ROOT, 'knowledge', 'mos');
const BRANCH_FILES = [
  'army.json',
  'marine-corps.json',
  'navy.json',
  'air-force.json',
  'space-force.json',
  'coast-guard.json',
  'noaa.json',
  'usphs.json',
];

const ALLOWED_TYPES = new Set(['enlisted', 'warrant', 'officer']);

const REQUIRED_ARMY_WARRANT_CODES = [
  '120A', '125D', '131A', '140A', '140K', '140L', '150A', '150U', '151A',
  '152C', '152D', '152F', '152G', '152H', '153A', '154C', '170A', '170B',
  '255A', '255N', '255S', '255Z', '350F', '350G', '351L', '351M', '352N',
  '352S', '353T', '890A', '913A', '914A', '915A', '919A', '948B', '948D',
  '920A', '920B', '921A', '922A', '948E',
];

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const issues = [];
  const summary = [];

  for (const file of BRANCH_FILES) {
    const fullPath = path.join(MOS_DIR, file);
    const data = await readJson(fullPath);
    const branch = String(data?.branch || file);
    const entries = Array.isArray(data?.mos) ? data.mos : [];

    const byType = { enlisted: 0, warrant: 0, officer: 0 };
    const seenByType = new Map();

    for (const entry of entries) {
      const code = normalizeCode(entry?.code);
      const type = String(entry?.type || '').trim().toLowerCase();

      if (!code) {
        issues.push(`[${branch}] Missing code value`);
        continue;
      }

      if (!ALLOWED_TYPES.has(type)) {
        issues.push(`[${branch}] ${code}: invalid type '${type || '(empty)'}'`);
        continue;
      }

      byType[type] += 1;

      const key = `${type}|${code}`;
      if (seenByType.has(key)) {
        issues.push(`[${branch}] duplicate ${type} code: ${code}`);
      } else {
        seenByType.set(key, true);
      }
    }

    summary.push({ file, branch, total: entries.length, byType });

    if (branch === 'Army') {
      const warrants = entries
        .filter((entry) => String(entry?.type || '').trim().toLowerCase() === 'warrant')
        .map((entry) => normalizeCode(entry?.code));
      const missing = REQUIRED_ARMY_WARRANT_CODES.filter((code) => !warrants.includes(code));
      for (const code of missing) {
        issues.push(`[Army] missing required warrant code: ${code}`);
      }
    }
  }

  console.log(JSON.stringify({ summary, issueCount: issues.length, issues }, null, 2));

  if (issues.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
