#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();

function fail(message, rows = []) {
  console.error(`STATIC GUARD FAILED: ${message}`);
  rows.slice(0, 50).forEach((row) => console.error(` - ${row}`));
  process.exit(1);
}

function isAuditedCodeFile(filePath) {
  return /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(filePath);
}

function shouldSkip(filePath) {
  const inScope =
    filePath.startsWith('app/frontend-modern/src/')
    || filePath.startsWith('backend/api/')
    || filePath.startsWith('backend/controllers/');
  return !inScope || filePath.includes('node_modules/') || filePath.includes('/dist/') || filePath.includes('/build/') || filePath.includes('/tests/');
}

let files = [];
try {
  const output = execSync('git ls-files', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  files = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
} catch {
  fail('Unable to enumerate tracked files via git ls-files');
}

const findings = {
  todo: [],
  commentedOut: [],
  consoleLog: [],
  deprecated: [],
};

for (const rel of files) {
  const normalized = rel.replace(/\\/g, '/');
  if (shouldSkip(normalized) || !isAuditedCodeFile(normalized)) continue;

  const full = path.join(ROOT, normalized);
  if (!fs.existsSync(full)) continue;
  const content = fs.readFileSync(full, 'utf8');

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const lineNo = index + 1;
    if (/\bTODO\b|\bFIXME\b/.test(line)) findings.todo.push(`${normalized}:${lineNo}`);
    if (/console\.log\s*\(/.test(line)) findings.consoleLog.push(`${normalized}:${lineNo}`);
    if (/\bdeprecated\b/i.test(line)) findings.deprecated.push(`${normalized}:${lineNo}`);
    if (/^\s*\/\/\s*(if|for|while|return|const|let|var|function|class|import|export)\b/.test(line)) {
      findings.commentedOut.push(`${normalized}:${lineNo}`);
    }
  });
}

if (findings.todo.length) fail('TODO/FIXME markers are not allowed', findings.todo);
if (findings.consoleLog.length) fail('console.log statements are not allowed', findings.consoleLog);
if (findings.commentedOut.length) fail('Commented-out code detected', findings.commentedOut);
if (findings.deprecated.length) fail('Deprecated markers detected', findings.deprecated);

console.log('STATIC GUARD PASSED');
