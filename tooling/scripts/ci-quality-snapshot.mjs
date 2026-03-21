#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const TEMP_DIR = path.join(ROOT, 'tooling', '.tmp');
const CURRENT_PATH = path.join(ROOT, 'tooling', 'ci-quality-current.json');

function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  });
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseEslintJson(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return { errors: 0, warnings: 0, files: 0 };
  const rows = JSON.parse(text);
  let errors = 0;
  let warnings = 0;
  for (const row of rows) {
    errors += Number(row.errorCount || 0);
    warnings += Number(row.warningCount || 0);
  }
  return { errors, warnings, files: rows.length };
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

ensureDir(TEMP_DIR);

const eslintRun = run('npx', ['eslint', 'app/frontend-modern/src', 'backend', '--ext', '.js,.jsx', '--format', 'json'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

const eslintMetrics = parseEslintJson(eslintRun.stdout);

const staticReportPath = path.join('tooling', '.tmp', 'ci-static-report.json');
run('node', ['tooling/scripts/ci-static-guard.mjs', '--no-fail', '--report-json', staticReportPath], {
  stdio: ['ignore', 'ignore', 'ignore'],
});
const staticReport = readJson(path.join(ROOT, staticReportPath), {
  pass: false,
  counts: { totalViolations: 0 },
});

const fileAuditReportPath = path.join('tooling', '.tmp', 'ci-file-audit-report.json');
run('node', ['tooling/scripts/ci-file-audit.mjs', '--no-fail', '--report-json', fileAuditReportPath], {
  stdio: ['ignore', 'ignore', 'ignore'],
});
const fileAuditReport = readJson(path.join(ROOT, fileAuditReportPath), {
  pass: false,
  issueCount: 0,
  auditedFileCount: 0,
});

const snapshot = {
  generatedAt: new Date().toISOString(),
  lint: {
    errors: eslintMetrics.errors,
    warnings: eslintMetrics.warnings,
    files: eslintMetrics.files,
  },
  staticGuard: {
    pass: Boolean(staticReport.pass),
    violations: Number(staticReport?.counts?.totalViolations || 0),
    detail: staticReport?.counts || {},
  },
  fileAudit: {
    pass: Boolean(fileAuditReport.pass),
    violations: Number(fileAuditReport.issueCount || 0),
    auditedFiles: Number(fileAuditReport.auditedFileCount || 0),
  },
};

fs.writeFileSync(CURRENT_PATH, JSON.stringify(snapshot, null, 2));
console.log(`QUALITY SNAPSHOT WRITTEN: ${path.relative(ROOT, CURRENT_PATH)}`);
console.log(JSON.stringify(snapshot, null, 2));
