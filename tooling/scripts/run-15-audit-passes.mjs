import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const outJson = path.join(ROOT, '.reports', 'audit-15-pass.json');
const outMd = path.join(ROOT, '.reports', 'audit-15-pass.md');

function run(cmd, args = []) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    shell: process.platform === 'win32',
    encoding: 'utf8',
    timeout: 300000,
  });
  return { code: r.status ?? 1, stdout: (r.stdout || ''), stderr: (r.stderr || '') };
}

const passes = [];
for (let i = 1; i <= 15; i++) {
  const startedAt = new Date().toISOString();
  const runRes = run('npm', ['run', 'audit:developer:strict']);

  let snapshot = null;
  try {
    snapshot = JSON.parse(await fs.readFile(path.join(ROOT, '.reports', 'dev-audit-report.json'), 'utf8'));
  } catch {
    snapshot = null;
  }

  const highNew = (snapshot?.delta?.newIssues ?? []).filter((x) => x.severity === 'high').length;
  const totalIssues = snapshot?.totals?.issues ?? null;

  passes.push({
    pass: i,
    startedAt,
    exitCode: runRes.code,
    highNew,
    totalIssues,
    note: runRes.code === 0 ? 'pass' : 'non-zero-exit',
    stderrPreview: (runRes.stderr || '').split(/\r?\n/).filter(Boolean).slice(0, 4),
  });

  console.log(`[audit-15] pass ${i}/15 exit=${runRes.code} highNew=${highNew} totalIssues=${totalIssues}`);
}

await fs.mkdir(path.join(ROOT, '.reports'), { recursive: true });
await fs.writeFile(outJson, JSON.stringify({ generatedAt: new Date().toISOString(), passes }, null, 2), 'utf8');

const lines = [];
lines.push('# 15-Pass Audit Run');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push('');
for (const p of passes) {
  lines.push(`- Pass ${p.pass}: exit=${p.exitCode}, highNew=${p.highNew}, totalIssues=${p.totalIssues}`);
}
const failing = passes.filter((p) => p.exitCode !== 0).length;
lines.push('');
lines.push(`Summary: ${15 - failing}/15 zero-exit passes.`);
await fs.writeFile(outMd, lines.join('\n'), 'utf8');

const hasHighRegression = passes.some((p) => p.highNew > 0);
process.exit(hasHighRegression ? 1 : 0);
