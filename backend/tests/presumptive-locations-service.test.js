import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadPresumptiveKnowledge,
  getFlattenedPresumptiveLocations,
  getPresumptiveExposureRules,
  matchDeploymentToPresumptive,
} from '../services/presumptiveLocationsService.js';

test('presumptive knowledge loads and exposes flattened dropdown locations', async () => {
  const knowledge = await loadPresumptiveKnowledge();
  const locations = getFlattenedPresumptiveLocations(knowledge);

  assert.ok(Array.isArray(knowledge.categories));
  assert.ok(knowledge.categories.length >= 5);
  assert.ok(Array.isArray(locations));
  assert.ok(locations.some((item) => item.location === 'Afghanistan'));
  assert.ok(locations.some((item) => item.location === 'Camp Lejeune, North Carolina'));
});

test('presumptive rules flatten date ranges for deterministic exposure matching', async () => {
  const knowledge = await loadPresumptiveKnowledge();
  const rules = getPresumptiveExposureRules(knowledge);

  assert.ok(Array.isArray(rules));
  assert.ok(rules.some((rule) => rule.location === 'Republic of Vietnam'));
  assert.ok(rules.some((rule) => rule.category === 'camp_lejeune'));
});

test('deployment matching identifies valid presumptive overlap', async () => {
  const knowledge = await loadPresumptiveKnowledge();
  const rules = getPresumptiveExposureRules(knowledge);

  const evidence = matchDeploymentToPresumptive({
    location: 'Afghanistan',
    startDate: '2011-03-01',
    endDate: '2012-02-01',
  }, rules);

  assert.equal(evidence.type, 'Deployment');
  assert.equal(evidence.presumptiveMatch, true);
  assert.equal(evidence.matchedCategory, 'Burn Pits / Airborne Hazards (PACT Act)');
  assert.deepEqual(evidence.matchedDateRange, { start: '2001-09-11', end: 'present' });
});

test('deployment matching rejects non-overlapping or unknown locations', async () => {
  const knowledge = await loadPresumptiveKnowledge();
  const rules = getPresumptiveExposureRules(knowledge);

  const noMatch = matchDeploymentToPresumptive({
    location: 'Germany',
    startDate: '2010-01-01',
    endDate: '2011-01-01',
  }, rules);

  assert.equal(noMatch.presumptiveMatch, false);
  assert.equal(noMatch.matchedCategory, null);
  assert.equal(noMatch.matchedDateRange, null);
});