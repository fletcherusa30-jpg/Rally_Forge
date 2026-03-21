import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const APPLY = process.argv.includes('--apply');
const REPORT_PATH = path.join(ROOT, '.reports', 'md-quality-upgrade-report.md');
const JSON_PATH = path.join(ROOT, '.reports', 'md-quality-upgrade-report.json');

function toTitle(fileName) {
  return fileName
    .replace(/\.md$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', '.reports', 'dist'].includes(e.name)) continue;
      out.push(...(await walk(full)));
    } else if (e.name.toLowerCase().endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

const docsRoot = path.join(ROOT, 'docs');
const mdFiles = (await exists(docsRoot)) ? await walk(docsRoot) : [];

const fixes = [];
for (const file of mdFiles) {
  let content = await fs.readFile(file, 'utf8');
  const original = content;
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');

  if (!/^\uFEFF?\s*#\s+\S+/m.test(content)) {
    const title = toTitle(path.basename(file));
    content = `# ${title}\n\n${content}`;
    fixes.push({ file: rel, type: 'h1-added', detail: `Inserted H1: ${title}` });
  }

  const links = [...content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)];
  for (const match of links) {
    const target = match[1];
    if (!target || target.startsWith('http://') || target.startsWith('https://') || target.startsWith('#')) continue;

    const raw = target.split('#')[0];
    const resolved = path.resolve(path.dirname(file), raw);
    if (await exists(resolved)) continue;

    if (raw.startsWith('docs/')) {
      const trimmed = raw.slice('docs/'.length);
      const alt = path.resolve(path.dirname(file), trimmed);
      if (await exists(alt)) {
        content = content.replace(`](${target})`, `](${trimmed}${target.includes('#') ? '#' + target.split('#')[1] : ''})`);
        fixes.push({ file: rel, type: 'link-fixed', detail: `${target} -> ${trimmed}` });
      }
    }
  }

  if (APPLY && content !== original) {
    await fs.writeFile(file, content, 'utf8');
  }
}

await fs.mkdir(path.join(ROOT, '.reports'), { recursive: true });
await fs.writeFile(JSON_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), applied: APPLY, fixes }, null, 2), 'utf8');

const lines = [];
lines.push('# Markdown Quality Upgrade Report');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Mode: ${APPLY ? 'apply' : 'dry-run'}`);
lines.push(`Fixes: ${fixes.length}`);
lines.push('');
for (const fix of fixes.slice(0, 500)) {
  lines.push(`- ${fix.file}: [${fix.type}] ${fix.detail}`);
}
await fs.writeFile(REPORT_PATH, lines.join('\n'), 'utf8');
console.log(`[md-quality-upgrade] ${APPLY ? 'applied' : 'planned'} fixes: ${fixes.length}`);
console.log(`[md-quality-upgrade] report: .reports/md-quality-upgrade-report.md`);
