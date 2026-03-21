import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const REPORT = path.join(ROOT, '.reports', 'dev-audit-report.json');

const run = spawnSync('node', ['tooling/scripts/dev-audit-assistant.mjs'], {
  cwd: ROOT,
  shell: process.platform === 'win32',
  encoding: 'utf8',
  timeout: 600000,
});

if (run.stdout) process.stdout.write(run.stdout);
if (run.stderr) process.stderr.write(run.stderr);

let report;
try {
  report = JSON.parse(await fs.readFile(REPORT, 'utf8'));
} catch (err) {
  console.error('[audit-developer-strict] Unable to read audit report:', err.message);
  process.exit(1);
}

const highNew = report?.deltaSeverityCounts?.high
  ?? (report?.delta?.newIssues ?? []).filter((i) => i.severity === 'high').length;

const highAll = report?.severityCounts?.high
  ?? (report?.issues ?? []).filter((i) => i.severity === 'high').length;

console.log(`[audit-developer-strict] High severity issues (all): ${highAll}`);
console.log(`[audit-developer-strict] High severity regressions (new): ${highNew}`);

if (highNew > 0) {
  console.error('[audit-developer-strict] FAIL: new high-severity regressions detected.');
  process.exit(1);
}

console.log('[audit-developer-strict] PASS: no new high-severity regressions (medium/low advisory only).');
process.exit(0);
