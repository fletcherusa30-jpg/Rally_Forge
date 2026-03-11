import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDropdownLocations, getExposureRules, buildDeploymentEvidence } from '../../app/frontend-modern/src/utils/presumptiveMatching.js';
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