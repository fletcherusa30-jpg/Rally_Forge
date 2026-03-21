#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function fail(message) {
  console.error(`ENV VALIDATION FAILED: ${message}`);
  process.exit(1);
}

const root = process.cwd();
const requiredPaths = [
  'package.json',
  path.join('app', 'frontend-modern', 'package.json'),
  path.join('app', 'frontend-modern', 'src', 'state', 'claimDataUnified', 'index.js'),
  path.join('app', 'frontend-modern', 'src', 'engine', 'conditionGenerator', 'index.js'),
  path.join('app', 'frontend-modern', 'src', 'engine', 'derivedSignals', 'index.js'),
  path.join('app', 'frontend-modern', 'src', 'engine', 'layStatement', 'index.js'),
  path.join('app', 'frontend-modern', 'src', 'engine', 'evidenceIndex', 'index.js'),
  path.join('app', 'frontend-modern', 'src', 'engine', 'timeline', 'index.js'),
];

for (const rel of requiredPaths) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    fail(`Missing required path: ${rel}`);
  }
}

const major = Number.parseInt(process.versions.node.split('.')[0], 10);
if (!Number.isFinite(major) || major < 20) {
  fail(`Node.js 20+ is required. Detected: ${process.version}`);
}

console.log('ENV VALIDATION PASSED');
