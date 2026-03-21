#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, 'tooling', 'ci-quality-baseline.json');
const CURRENT_PATH = path.join(ROOT, 'tooling', 'ci-quality-current.json');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(ROOT, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const baseline = readJson(BASELINE_PATH);
const current = readJson(CURRENT_PATH);

const checks = [
  {
    key: 'lint.errors',
    baseline: Number(baseline?.lint?.errors || 0),
    current: Number(current?.lint?.errors || 0),
  },
  {
    key: 'lint.warnings',
    baseline: Number(baseline?.lint?.warnings || 0),
    current: Number(current?.lint?.warnings || 0),
  },
  {
    key: 'staticGuard.violations',
    baseline: Number(baseline?.staticGuard?.violations || 0),
    current: Number(current?.staticGuard?.violations || 0),
  },
  {
    key: 'fileAudit.violations',
    baseline: Number(baseline?.fileAudit?.violations || 0),
    current: Number(current?.fileAudit?.violations || 0),
  },
];

const regressions = checks.filter((row) => row.current > row.baseline);

if (regressions.length > 0) {
  console.error('QUALITY BASELINE ENFORCEMENT FAILED');
  for (const row of regressions) {
    console.error(` - ${row.key}: current=${row.current} baseline=${row.baseline}`);
  }
  process.exit(1);
}

console.log('QUALITY BASELINE ENFORCEMENT PASSED');
for (const row of checks) {
  console.log(` - ${row.key}: current=${row.current} baseline=${row.baseline}`);
}
