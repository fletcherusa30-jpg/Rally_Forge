import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDropdownLocations, getExposureRules, buildDeploymentEvidence, hasDateOverlap } from '../../app/frontend-modern/src/utils/presumptiveMatching.js';
import knowledge from '../../knowledge/presumptive-locations.json' with { type: 'json' };

test('dropdown location list is sorted and labeled from knowledge payload', () => {
  const payload = {
    locations: knowledge.categories.flatMap((category) =>
      category.locations.map((location) => ({
        location: location.name,
        category: category.id,
        categoryLabel: category.label,
      }))
    ),
  };

  const locations = getDropdownLocations(payload);
  assert.ok(locations.length > 0);
  assert.ok(locations[0].label <= locations[locations.length - 1].label);
  assert.ok(locations.some((item) => item.value === 'Republic of Vietnam'));
});

test('frontend deployment evidence uses only supplied exposure rules', () => {
  const payload = {
    exposureRules: knowledge.categories.flatMap((category) =>
      category.locations.flatMap((location) =>
        location.dateRanges.map((dateRange) => ({
          location: location.name,
          aliases: location.aliases,
          category: category.id,
          categoryLabel: category.label,
          start: dateRange.start,
          end: dateRange.end,
        }))
      )
    ),
  };

  const rules = getExposureRules(payload);
  const evidence = buildDeploymentEvidence({
    location: 'Camp Lejeune',
    startDate: '1985-01-01',
    endDate: '1985-06-01',
  }, rules);

  assert.equal(evidence.presumptiveMatch, true);
  assert.equal(evidence.matchedCategory, 'Camp Lejeune Contaminated Water');
  assert.deepEqual(evidence.matchedDateRange, { start: '1953-08-01', end: '1987-12-31' });
});

test('date overlap helper is deterministic for overlap, non-overlap, and invalid dates', () => {
  assert.equal(hasDateOverlap('2003-01-01', '2003-05-01', '2003-04-01', '2003-12-01'), true);
  assert.equal(hasDateOverlap('2001-01-01', '2001-06-01', '2002-01-01', '2002-06-01'), false);
  assert.equal(hasDateOverlap('invalid-date', '2001-06-01', '2002-01-01', '2002-06-01'), false);
});

test('deployment evidence does not mark presumptive match outside rule date range', () => {
  const rules = getExposureRules({
    exposureRules: [
      {
        location: 'Camp Lejeune',
        aliases: ['Marine Corps Base Camp Lejeune'],
        category: 'camp_lejeune',
        categoryLabel: 'Camp Lejeune Contaminated Water',
        start: '1953-08-01',
        end: '1987-12-31',
      },
    ],
  });

  const evidence = buildDeploymentEvidence({
    location: 'Camp Lejeune',
    startDate: '1990-01-01',
    endDate: '1990-03-01',
  }, rules);

  assert.equal(evidence.presumptiveMatch, false);
  assert.equal(evidence.matchedCategory, null);
  assert.equal(evidence.matchedDateRange, null);
});