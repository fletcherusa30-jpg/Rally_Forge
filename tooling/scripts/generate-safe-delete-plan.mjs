import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT_JSON = path.join(ROOT, '.reports', 'dev-audit-report.json');
const OUT_MD = path.join(ROOT, '.reports', 'safe-delete-plan.md');
const OUT_JSON = path.join(ROOT, '.reports', 'safe-delete-plan.json');

const TEXT_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml', '.txt', '.html', '.css']);
const SEARCH_DIRS = ['app', 'backend', 'docs', 'scripts', 'tooling', 'src', 'config', 'knowledge', 'resources', 'tests'];

function normalize(p) {
  return p.replace(/\\/g, '/');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === '.reports' || e.name === 'dist') continue;
      out.push(...(await walk(full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

async function loadFiles() {
  const files = [];
  for (const d of SEARCH_DIRS) {
    const full = path.join(ROOT, d);
    if (!(await exists(full))) continue;
    files.push(...(await walk(full)));
  }
  return files.filter((f) => TEXT_EXT.has(path.extname(f).toLowerCase()));
}

function scoreReferenceSafety(refCount) {
  if (refCount === 0) return 'safe-delete-candidate';
  if (refCount <= 2) return 'review-manual';
  return 'keep-or-migrate';
}

const report = JSON.parse(await fs.readFile(REPORT_JSON, 'utf8'));
const duplicateGroups = report?.duplicates?.exact ?? [];
const corpusFiles = await loadFiles();

const plan = [];
for (const group of duplicateGroups) {
  const canonical = normalize(group.canonical);
  const mirrors = (group.duplicates ?? []).map(normalize);

  const mirrorPlans = [];
  for (const mirror of mirrors) {
    const basename = path.basename(mirror);
    const mirrorPattern = new RegExp(escapeRegExp(mirror), 'i');
    const basePattern = new RegExp(escapeRegExp(basename), 'i');

    const refs = [];
    for (const file of corpusFiles) {
      const rel = normalize(path.relative(ROOT, file));
      if (rel === mirror) continue;
      const content = await fs.readFile(file, 'utf8');
      if (mirrorPattern.test(content) || basePattern.test(content)) {
        refs.push(rel);
      }
    }

    mirrorPlans.push({
      mirror,
      referenceCount: refs.length,
      sampleReferences: refs.slice(0, 8),
      action: scoreReferenceSafety(refs.length),
    });
  }

  plan.push({ canonical, mirrors: mirrorPlans });
}

await fs.writeFile(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), groups: plan }, null, 2), 'utf8');

const lines = [];
lines.push('# Safe Delete Plan (Duplicate Groups)');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Duplicate groups reviewed: ${plan.length}`);
lines.push('');
lines.push('Legend:');
lines.push('- safe-delete-candidate: zero in-repo references found for mirror path/basename');
lines.push('- review-manual: 1-2 references found, verify ownership before delete');
lines.push('- keep-or-migrate: >2 references, update refs before deleting mirror');
lines.push('');

for (const group of plan) {
  lines.push(`## Keep: ${group.canonical}`);
  for (const m of group.mirrors) {
    lines.push(`- Mirror: ${m.mirror}`);
    lines.push(`- Action: ${m.action}`);
    lines.push(`- Reference Count: ${m.referenceCount}`);
    if (m.sampleReferences.length) {
      lines.push(`- Sample References: ${m.sampleReferences.join(', ')}`);
    }
    lines.push('');
  }
}

await fs.writeFile(OUT_MD, lines.join('\n'), 'utf8');
console.log(`[safe-delete-plan] wrote ${path.relative(ROOT, OUT_MD).replace(/\\/g, '/')}`);
console.log(`[safe-delete-plan] wrote ${path.relative(ROOT, OUT_JSON).replace(/\\/g, '/')}`);
