#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();

function listTrackedFiles() {
  const output = execSync('git ls-files', { encoding: 'utf8' });
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function isAuditedFile(filePath) {
  return /\.(js|jsx|ts|tsx|mjs|cjs|json|md|yml|yaml)$/.test(filePath);
}

function isCodeFile(filePath) {
  return /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(filePath);
}

function isInAuditScope(filePath) {
  return (
    filePath.startsWith('app/frontend-modern/src/')
    || filePath.startsWith('backend/api/')
    || filePath.startsWith('backend/controllers/')
  );
}

function readFile(rel) {
  const fullPath = path.join(ROOT, rel);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function pushIssue(issues, rel, rule, detail) {
  issues.push({ rel, rule, detail });
}

const files = listTrackedFiles().filter((rel) => isAuditedFile(rel.replace(/\\/g, '/')));
const issues = [];

for (const rel of files) {
  const normalized = rel.replace(/\\/g, '/');
  if (normalized.includes('node_modules/')) continue;
  if (!isInAuditScope(normalized)) continue;

  const content = readFile(normalized);
  if (content === null) continue;
  const lines = content.split(/\r?\n/);

  if (isCodeFile(normalized) && /\bTODO\b|\bFIXME\b/.test(content)) {
    pushIssue(issues, normalized, 'Code Quality', 'Contains TODO/FIXME');
  }
  if (isCodeFile(normalized) && /console\.log\s*\(/.test(content)) {
    pushIssue(issues, normalized, 'Code Quality', 'Contains console.log');
  }
  if (isCodeFile(normalized) && /^\s*\/\/\s*(if|for|while|return|const|let|var|function|class|import|export)\b/m.test(content)) {
    pushIssue(issues, normalized, 'Code Quality', 'Contains commented-out code');
  }

  if (normalized.includes('/tabs/') && /claimDataUnified/.test(content) === false && /useClaimWorkspace/.test(content) === false) {
    pushIssue(issues, normalized, 'UI Binding', 'Tab file should bind through unified workspace hooks');
  }

  if (normalized.includes('/engine/') && /Math\.random\(|Date\.now\(/.test(content)) {
    pushIssue(issues, normalized, 'Determinism', 'Engine contains non-deterministic call');
  }

  if (normalized.includes('/engine/') && /runConditionGeneratorEngine\(|runDerivedSignalsEngine\(/.test(content) && normalized.includes('/state/')) {
    // state is allowed to orchestrate engines
  }

  if (normalized.includes('/engine/') && /sourceTag/.test(content) === false && normalized.includes('/timeline/')) {
    pushIssue(issues, normalized, 'Timeline Integration', 'Timeline logic should include sourceTag');
  }

  if (normalized.includes('/engine/evidenceIndex/') && /source\s*:/.test(content) === false) {
    pushIssue(issues, normalized, 'Evidence Index Integration', 'Evidence entries must include source');
  }

  lines.forEach((line, idx) => {
    if (isCodeFile(normalized) && /\bdeprecated\b/i.test(line)) {
      pushIssue(issues, normalized, 'Code Quality', `Deprecated marker on line ${idx + 1}`);
    }
  });
}

if (issues.length > 0) {
  console.error(`FILE AUDIT FAILED: ${issues.length} issue(s) found.`);
  issues.slice(0, 120).forEach((item) => {
    console.error(` - ${item.rel} :: ${item.rule} :: ${item.detail}`);
  });
  process.exit(1);
}

console.log(`FILE AUDIT PASSED: ${files.length} files audited.`);
