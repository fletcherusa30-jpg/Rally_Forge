import test from 'node:test';
import assert from 'node:assert/strict';
import { scanVaDecision } from '../../backend/va_scanner/engine/vaSuperScanner.js';

test('denial reason regression: scanner identifies at least one denial issue', () => {
  const text = [
    'Rating Decision Dated: March 15, 2024',
    'File Number: 11223344',
    'Service connection for migraine headaches is denied because the evidence does not show a nexus between your current disability and military service.',
    'The claim remains denied because the condition was not incurred in or caused by service.'
  ].join(' ');

  const result = scanVaDecision(text);

  assert.ok(Array.isArray(result.denied), 'denied should be an array');
  assert.ok(result.denied.length >= 1, 'expected at least one denial reason');

  const hasNexusSignal = result.denied.some((entry) => /nexus|caused by service|incurred/i.test(String(entry.reason || '')));
  assert.equal(hasNexusSignal, true, 'expected nexus-style denial signal');
  assert.equal(typeof result.extractionSummary.totalPyramidingRisks, 'number');
  assert.equal(typeof result.extractionSummary.totalHouseboundIndicators, 'number');
  assert.equal(typeof result.tdiu.confidence.overall, 'number');
});

test('denial reason regression: scanner keeps denial section stable with mixed outcomes', () => {
  const text = [
    'Rating Decision Dated: April 20, 2024',
    'File Number: 55667788',
    'Service connection for tinnitus is granted with an evaluation of 10 percent effective April 1, 2024.',
    'Service connection for sleep apnea is denied because no chronic diagnosis was shown during service and continuity of symptoms is not established.'
  ].join(' ');

  const result = scanVaDecision(text);

  assert.ok(Array.isArray(result.denied), 'denied should be an array');
  assert.ok(result.denied.length >= 1, 'expected denied issue analysis to remain available');
});
