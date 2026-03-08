import test from 'node:test';
import assert from 'node:assert/strict';
import { scanVaDecision } from '../../backend/va_scanner/engine/vaSuperScanner.js';

test('combined rating regression: scanner returns CFR-based rating metadata', () => {
  const text = [
    'Rating Decision Dated: January 10, 2024',
    'File Number: 12345678',
    'Service connection for PTSD is granted with an evaluation of 70 percent effective January 1, 2024.',
    'Service connection for tinnitus is granted with an evaluation of 10 percent effective January 1, 2024.'
  ].join(' ');

  const result = scanVaDecision(text);

  assert.ok(result.ratingCalculation, 'ratingCalculation should exist');
  assert.equal(typeof result.ratingCalculation.calculatedCombinedRating, 'number');
  assert.ok(result.ratingCalculation.calculatedCombinedRating >= 70);
  assert.match(result.ratingCalculation.calculationMethod, /38 CFR/i, 'calculation method should reference CFR guidance');
  assert.equal(typeof result.compliance, 'object');
  assert.equal(Array.isArray(result.compliance.pyramidingRisk), true);
  assert.equal(typeof result.housebound, 'object');
  assert.equal(typeof result.housebound.mentioned, 'boolean');

  const hasServiceConnectionTypes = result.serviceConnected.some((entry) => Array.isArray(entry.serviceConnectionTypes));
  assert.equal(hasServiceConnectionTypes, true, 'serviceConnected entries should include serviceConnectionTypes');

  const hasRatingChange = result.serviceConnected.some((entry) => entry.ratingChange && typeof entry.ratingChange.type === 'string');
  assert.equal(hasRatingChange, true, 'serviceConnected entries should include ratingChange metadata');
});

test('bilateral regression: left/right extremity ratings can trigger bilateral evaluation', () => {
  const text = [
    'Rating Decision Dated: February 2, 2024',
    'File Number: 98765432',
    'Service connection for left knee strain is granted with an evaluation of 10 percent effective February 1, 2024.',
    'Service connection for right knee strain is granted with an evaluation of 10 percent effective February 1, 2024.'
  ].join(' ');

  const result = scanVaDecision(text);

  assert.ok(result.ratingCalculation, 'ratingCalculation should exist');
  assert.equal(typeof result.ratingCalculation.hasBilateralPairs, 'boolean');
  assert.equal(Array.isArray(result.ratingCalculation.bilateralPairs), true);
});
