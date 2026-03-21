#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const group = process.argv[2];
if (!group) {
  console.error('Usage: node tooling/scripts/ci-run-vitest-group.mjs <group>');
  process.exit(1);
}

const baseArgs = ['run', '--config', 'vitest.config.js'];
const patternsByGroup = {
  unit: [
    'src/tests/tab-0*-*.test.*',
    'src/tests/engine-*.test.js',
    'src/tests/*normalization*.test.*',
    'src/tests/*mapping*.test.*',
    'src/tests/schema-compliance.test.js',
  ],
  integration: [
    'src/tests/unified-claims-engine.test.jsx',
    'src/tests/tab-06-engines-evidence-timeline.test.js',
    'src/tests/claim-generator-summary-tab.test.jsx',
    'src/tests/file-level-review.test.js',
  ],
  e2e: [
    'src/tests/unified-claims-engine.test.jsx',
    'src/tests/claim-generator-summary-tab.test.jsx',
  ],
};

const patterns = patternsByGroup[group];
if (!patterns) {
  console.error(`Unknown group: ${group}`);
  process.exit(1);
}

const result = spawnSync('npx', ['vitest', ...baseArgs, ...patterns], {
  cwd: 'app/frontend-modern',
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
