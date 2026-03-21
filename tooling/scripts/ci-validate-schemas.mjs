#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function read(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
}

function fail(message) {
  console.error(`SCHEMA VALIDATION FAILED: ${message}`);
  process.exit(1);
}

const schemaFiles = [
  'app/frontend-modern/src/tabs/military-service/schema.js',
  'app/frontend-modern/src/tabs/strs/schema.js',
  'app/frontend-modern/src/tabs/current-treatment/schema.js',
  'app/frontend-modern/src/tabs/rating-decision/schema.js',
  'app/frontend-modern/src/tabs/claim-generator-summary/schema.js',
  'app/frontend-modern/src/schemas/claimDataUnified.schema.js',
];

for (const rel of schemaFiles) {
  const full = path.join(process.cwd(), rel);
  if (!fs.existsSync(full)) {
    fail(`Missing schema file: ${rel}`);
  }
}

const unifiedBuilder = read('app/frontend-modern/src/state/claimDataUnified/index.js');
const requiredEngineHooks = [
  'runDerivedSignalsEngine',
  'runConditionGeneratorEngine',
  'runLayStatementEngine',
  'runEvidenceIndexEngine',
  'buildUnifiedTimeline',
];
for (const hook of requiredEngineHooks) {
  if (!unifiedBuilder.includes(hook)) {
    fail(`Unified builder must reference ${hook}`);
  }
}

const unifiedSchema = read('app/frontend-modern/src/schemas/claimDataUnified.schema.js');
const requiredUnifiedKeys = [
  'profile',
  'service',
  'str',
  'currentTreatment',
  'ratingDecision',
  'timeline',
  'derivedSignals',
  'generatedConditions',
  'layStatement',
  'evidenceIndex',
];
for (const key of requiredUnifiedKeys) {
  if (!unifiedSchema.includes(key)) {
    fail(`Unified schema must document key: ${key}`);
  }
}

console.log('SCHEMA VALIDATION PASSED');
