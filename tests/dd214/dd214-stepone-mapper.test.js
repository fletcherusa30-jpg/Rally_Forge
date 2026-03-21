import test from 'node:test';
import assert from 'node:assert/strict';

import { mapDD214ToStepOne } from '../../backend/va_scanner/backend/shared/scanner/dd214StepOneMapper.js';

function buildBaseDd214(overrides = {}) {
  return {
    documentType: 'DD-214',
    schemaVersion: '3.0.0',
    serviceIdentity: {
      branchOfService: 'Army',
      component: 'Reserve',
    },
    servicePeriods: {
      entryDate: '2011-10-07',
      separationDate: '2017-11-26',
      netActiveServiceThisPeriod: { years: 6, months: 1, days: 19 },
    },
    characterAndSeparation: {
      characterOfService: 'Honorable',
    },
    gradeSpecialty: {
      payGrade: 'E-7',
      primaryMOSOrAFSCOrRating: '92R',
    },
    decorationsAndService: {
      foreignServiceLocationsIfListed: ['Afghanistan'],
      combatIndicatorsFromAwards: [],
    },
    dd214Analysis: {
      validationSummary: {
        passes: [
          { passId: 'dateChronology', passed: true },
          { passId: 'netServiceConsistency', passed: true },
          { passId: 'componentFromBlock2', passed: true },
        ],
      },
    },
    ...overrides,
  };
}

test('step one mapping allows deterministic v3 data', () => {
  const mapped = mapDD214ToStepOne(buildBaseDd214());
  assert.ok(mapped?.stepOneFields);
  assert.equal(mapped.stepOneFields.serviceType, 'Reserve');
  assert.equal(mapped.stepOneFields.startDate, '2011-10-07');
  assert.equal(mapped.stepOneFields.endDate, '2017-11-26');
});

test('step one mapping blocks legacy schema data', () => {
  const mapped = mapDD214ToStepOne(buildBaseDd214({ schemaVersion: '2.0.0' }));
  assert.ok(mapped?.stepOneFields);
  assert.equal(mapped.stepOneFields.serviceType, null);
  assert.equal(mapped.stepOneFields.startDate, null);
  assert.equal(mapped.stepOneFields.endDate, null);
});

test('step one mapping blocks when deterministic passes are missing', () => {
  const mapped = mapDD214ToStepOne(buildBaseDd214({
    dd214Analysis: { validationSummary: { passes: [] } },
  }));
  assert.ok(mapped?.stepOneFields);
  assert.equal(mapped.stepOneFields.serviceType, null);
  assert.equal(mapped.stepOneFields.startDate, null);
  assert.equal(mapped.stepOneFields.endDate, null);
});

test('step one mapping does not map noisy discharge labels', () => {
  const mapped = mapDD214ToStepOne(buildBaseDd214({
    characterAndSeparation: {
      characterOfService: 'SOCIAL SECURITY NUMBER',
    },
  }));
  assert.ok(mapped?.stepOneFields);
  assert.equal(mapped.stepOneFields.dischargeType, null);
});

test('step one mapping sets combat veteran from deployment combat signal', () => {
  const mapped = mapDD214ToStepOne(buildBaseDd214({
    decorationsAndService: {
      foreignServiceLocationsIfListed: ['Afghanistan'],
      combatIndicatorsFromAwards: [],
    },
    dd214Analysis: {
      validationSummary: {
        passes: [
          { passId: 'dateChronology', passed: true },
          { passId: 'netServiceConsistency', passed: true },
          { passId: 'componentFromBlock2', passed: true },
        ],
      },
      deployments: [
        { location: 'Afghanistan', combatIndicator: true },
      ],
    },
  }));

  assert.ok(mapped?.stepOneFields);
  assert.equal(mapped.stepOneFields.combatVeteran, true);
});
