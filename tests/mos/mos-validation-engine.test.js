import test from 'node:test';
import assert from 'node:assert/strict';

import { validateMOS, validateMOSList } from '../../backend/services/mosValidationEngine.js';

test('validateMOS accepts a valid MOS/branch/rank combination', () => {
  const result = validateMOS({
    code: '11b',
    branch: 'Army',
    rankCategory: 'Enlisted',
  });

  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.normalizedMOS.code, '11B');
  assert.equal(result.normalizedMOS.branch, 'Army');
  assert.equal(result.normalizedMOS.rankCategory, 'Enlisted');
});

test('validateMOS rejects unknown MOS code', () => {
  const result = validateMOS({
    code: 'ZZZZ',
    branch: 'Army',
    rankCategory: 'Enlisted',
  });

  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((error) => String(error).includes('code is not valid for branch')));
});

test('validateMOS rejects wrong branch/code combination', () => {
  const result = validateMOS({
    code: '11B',
    branch: 'Navy',
    rankCategory: 'Enlisted',
  });

  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((error) => String(error).includes('code is not valid for branch')));
});

test('validateMOS rejects impossible rank combination', () => {
  const result = validateMOS({
    code: '11B',
    branch: 'Army',
    rankCategory: 'Officer',
  });

  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((error) => String(error).includes('rankCategory')));
});

test('validateMOSList detects duplicate entries', () => {
  const result = validateMOSList([
    { code: '11B', branch: 'Army', rankCategory: 'Enlisted' },
    { code: '11B', branch: 'Army', rankCategory: 'Enlisted' },
  ]);

  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((error) => String(error.error).includes('duplicate MOS entry')));
});
