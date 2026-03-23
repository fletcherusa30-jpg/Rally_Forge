import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearMOSIngestionStore,
  getMOSCrossBranchView,
  getMOSExposures,
  getVeteranMOSHistory,
  ingestMOSData,
} from '../../backend/services/mosIngestionPipeline.js';

test.beforeEach(() => {
  clearMOSIngestionStore();
});

test('ingestMOSData normalizes, validates, maps, and stores DD214 MOS data', () => {
  const result = ingestMOSData({
    veteranId: 'vet-1',
    sourceType: 'dd214',
    payload: {
      serviceIdentity: { branchOfService: 'Army' },
      servicePeriods: {
        entryDate: '2010-01-01',
        separationDate: '2014-01-01',
      },
      gradeSpecialty: {
        payGrade: 'E-5',
        primaryMOSOrAFSCOrRating: '11b',
        additionalMOSOrSpecialties: ['12B'],
      },
    },
  });

  assert.equal(result.isValid, true);
  assert.equal(result.stages.parsed, 2);
  assert.equal(result.stages.validated, 2);
  assert.equal(result.stages.stored, 2);

  const history = getVeteranMOSHistory('vet-1');
  assert.equal(history.length, 2);
  assert.equal(history[0].code, '11B');
  assert.ok(history[0].mapped.crossBranchEquivalents);
  assert.ok(history[0].mapped.exposure);
});

test('ingestMOSData fails on invalid records and does not store', () => {
  const result = ingestMOSData({
    veteranId: 'vet-2',
    sourceType: 'userInput',
    payload: [
      { code: 'INVALID', branch: 'Army', rankCategory: 'Enlisted' },
    ],
  });

  assert.equal(result.isValid, false);
  assert.ok(result.errors.length > 0);

  const history = getVeteranMOSHistory('vet-2');
  assert.equal(history.length, 0);
});

test('pipeline is idempotent for same source payload', () => {
  const payload = [
    { code: '11B', branch: 'Army', rankCategory: 'Enlisted' },
  ];

  const first = ingestMOSData({
    veteranId: 'vet-3',
    sourceType: 'importedDataset',
    payload,
  });
  const second = ingestMOSData({
    veteranId: 'vet-3',
    sourceType: 'importedDataset',
    payload,
  });

  assert.equal(first.isValid, true);
  assert.equal(second.isValid, true);
  assert.equal(first.stages.stored, 1);
  assert.equal(second.stages.stored, 0);
  assert.equal(getVeteranMOSHistory('vet-3').length, 1);
});

test('exposed views return mapped cross-branch and exposure data', () => {
  ingestMOSData({
    veteranId: 'vet-4',
    sourceType: 'userInput',
    payload: [
      { code: '11B', branch: 'Army', rankCategory: 'Enlisted' },
    ],
  });

  const exposures = getMOSExposures('vet-4');
  const crossView = getMOSCrossBranchView('vet-4');

  assert.equal(exposures.length, 1);
  assert.equal(crossView.length, 1);
  assert.ok(exposures[0].exposure);
  assert.ok(crossView[0].crossBranchEquivalents);
});
