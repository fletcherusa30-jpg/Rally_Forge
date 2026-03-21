import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractDischargeAndSeparationFields,
  extractCharacterOfService,
  extractTypeOfSeparation,
  extractSeparationAuthority,
  extractSeparationCode,
  extractReentryCode,
  extractNarrativeReasonForSeparation,
  detectDisabilityRetirement,
  SPD_CODE_NORMALIZATIONS,
  RE_CODE_NORMALIZATIONS,
} from '../../backend/va_scanner/backend/shared/scanner/dd214DischargeExtractor.js';

test('extractCharacterOfService: extracts honorable discharge', () => {
  const result = extractCharacterOfService({
    '24': 'HONORABLE',
  });
  assert.equal(result, 'Honorable');
});

test('extractCharacterOfService: extracts general discharge', () => {
  const result = extractCharacterOfService({
    '24': 'GENERAL (UNDER HONORABLE CONDITIONS)',
  });
  assert.equal(result, 'General');
});

test('extractCharacterOfService: empty block returns null', () => {
  const result = extractCharacterOfService({});
  assert.equal(result, null);
});

test('extractTypeOfSeparation: extracts retirement', () => {
  const result = extractTypeOfSeparation({
    '23': 'RETIREMENT',
  });
  assert.equal(result, 'Retirement');
});

test('extractTypeOfSeparation: extracts release from active duty', () => {
  const result = extractTypeOfSeparation({
    '23': 'RELEASE FROM ACTIVE DUTY',
  });
  assert.equal(result, 'Release from Active Duty');
});

test('extractSeparationAuthority: extracts Army regulation', () => {
  const result = extractSeparationAuthority({
    '25': 'AR 635-200',
  });
  assert.equal(result, 'AR 635-200');
});

test('extractSeparationAuthority: extracts Air Force instruction', () => {
  const result = extractSeparationAuthority({
    '25': 'AFI 36-3208',
  });
  assert.match(result, /AFI\s*36[-–]?3208/i);
});

test('extractSeparationCode: normalizes disability SPD code (SEJ)', () => {
  const result = extractSeparationCode({
    '26': 'SEJ',
  });
  assert.equal(result.code, 'SEJ');
  assert.equal(result.category, 'Disability');
  assert.match(result.meaning, /Disability/i);
});

test('extractSeparationCode: normalizes misconduct pattern SPD code (JKA)', () => {
  const result = extractSeparationCode({
    '26': 'JKA',
  });
  assert.equal(result.code, 'JKA');
  assert.equal(result.category, 'Misconduct');
  assert.match(result.meaning, /Misconduct/i);
});

test('extractSeparationCode: handles unknown code gracefully', () => {
  const result = extractSeparationCode({
    '26': 'ZZZ',
  });
  assert.equal(result.code, 'ZZZ');
  assert.equal(result.category, 'Unknown');
});

test('extractReentryCode: normalizes RE-1 (eligible)', () => {
  const result = extractReentryCode({
    '27': 'RE-1',
  });
  assert.equal(result.code, 'RE-1');
  assert.equal(result.category, 'Eligible');
});

test('extractReentryCode: normalizes RE-4 (not eligible)', () => {
  const result = extractReentryCode({
    '27': 'RE-4',
  });
  assert.equal(result.code, 'RE-4');
  assert.equal(result.category, 'Not Eligible');
});

test('extractReentryCode: normalizes numeric code 1', () => {
  const result = extractReentryCode({
    '27': '1',
  });
  assert.equal(result.code, '1');
  assert.equal(result.category, 'Eligible');
});

test('extractNarrativeReasonForSeparation: extracts from block 28', () => {
  const result = extractNarrativeReasonForSeparation(
    {
      '28': 'COMPLETION OF REQUIRED ACTIVE SERVICE',
    },
    {}
  );
  assert.equal(result, 'COMPLETION OF REQUIRED ACTIVE SERVICE');
});

test('extractNarrativeReasonForSeparation: filters out noise', () => {
  const result = extractNarrativeReasonForSeparation(
    {
      '28': 'SIGNATURE BLOCK ONLY',
    },
    {}
  );
  assert.equal(result, null);
});

test('detectDisabilityRetirement: detects from SEJ code', () => {
  const result = detectDisabilityRetirement(
    { code: 'SEJ', category: 'Disability' },
    null,
    null
  );
  assert.equal(result, true);
});

test('detectDisabilityRetirement: detects from JFH code', () => {
  const result = detectDisabilityRetirement(
    { code: 'JFH', category: 'Disability' },
    null,
    null
  );
  assert.equal(result, true);
});

test('detectDisabilityRetirement: detects from narrative containing DISABILITY RETIREMENT', () => {
  const result = detectDisabilityRetirement(
    null,
    'DISABILITY RETIREMENT - PERMANENT',
    null
  );
  assert.equal(result, true);
});

test('detectDisabilityRetirement: detects from AR 635-40 authority', () => {
  const result = detectDisabilityRetirement(
    null,
    null,
    { '25': 'AR 635-40' }
  );
  assert.equal(result, true);
});

test('extractDischargeAndSeparationFields: full honorable discharge scenario', () => {
  const blocks = {
    '23': 'DISCHARGE',
    '24': 'HONORABLE',
    '25': 'AR 635-200',
    '26': 'LBK',
    '27': 'RE-1',
    '28': 'COMPLETION OF REQUIRED ACTIVE SERVICE',
    '29': '0 YEARS 0 MONTHS 0 DAYS',
    '9': 'ACTIVE RESERVE',
    '10': '$250,000',
    '19a': '123 MAIN ST, ANYTOWN, USA 12345',
    '19b': 'JOHN DOE, BROTHER',
    '20': 'STATE VA',
  };

  const result = extractDischargeAndSeparationFields(blocks, {});

  assert.equal(result.characterOfService, 'Honorable');
  assert.equal(result.typeOfSeparation, 'Discharge');
  assert.match(result.separationAuthority, /AR\s*635[-–]?200/i);
  assert.equal(result.separationCode.code, 'LBK');
  assert.equal(result.separationCode.category, 'Administrative');
  assert.equal(result.reentryCode.code, 'RE-1');
  assert.equal(result.narrativeReasonForSeparation, 'COMPLETION OF REQUIRED ACTIVE SERVICE');
  assert.equal(result.disabilityRetirement, false);
  assert.equal(result.vaCopyRequests.stateVA, true);
  assert.equal(result.vaCopyRequests.centralVA, false);
});

test('extractDischargeAndSeparationFields: full disability discharge scenario', () => {
  const blocks = {
    '23': 'DISCHARGE',
    '24': 'HONORABLE',
    '25': 'AR 635-40',
    '26': 'SEJ',
    '27': 'RE-4',
    '28': 'DISABILITY RETIREMENT - PERMANENT',
    '29': '0 YEARS 3 MONTHS 15 DAYS',
    '9': 'ACTIVE RESERVE',
    '10': '$400,000',
    '19a': '456 MEDICAL AVE, ARMY HOSPITAL, USA 54321',
    '19b': 'JANE SMITH, SPOUSE',
    '20': 'CENTRAL VA',
  };

  const result = extractDischargeAndSeparationFields(blocks, {});

  assert.equal(result.characterOfService, 'Honorable');
  assert.equal(result.separationCode.code, 'SEJ');
  assert.equal(result.separationCode.category, 'Disability');
  assert.equal(result.reentryCode.code, 'RE-4');
  assert.equal(result.disabilityRetirement, true);
  assert.match(result.disabilityType, /Disability/i);
  assert.equal(result.vaCopyRequests.centralVA, true);
});

test('SPD_CODE_NORMALIZATIONS: contains key disability codes', () => {
  assert.ok(SPD_CODE_NORMALIZATIONS['SEJ']);
  assert.ok(SPD_CODE_NORMALIZATIONS['JFH']);
  assert.ok(SPD_CODE_NORMALIZATIONS['JKA']);
});

test('RE_CODE_NORMALIZATIONS: contains key reenlistment codes', () => {
  assert.ok(RE_CODE_NORMALIZATIONS['1']);
  assert.ok(RE_CODE_NORMALIZATIONS['RE-1']);
  assert.ok(RE_CODE_NORMALIZATIONS['RE-4']);
});

test('extractSeparationCode: rejects garbage text', () => {
  const result = extractSeparationCode({
    '26': 'THIS IS A VERY LONG GARBAGE STRING THAT SHOULD BE REJECTED',
  });
  // Should either return null or mark as unknown
  assert.ok(result === null || result.category === 'Unknown');
});

test('extractNarrativeReasonForSeparation: handles continuation sheets', () => {
  const result = extractNarrativeReasonForSeparation(
    {
      '28': 'COMPLETION OF REQUIRED',
    },
    {
      '18': [
        '28. ACTIVE SERVICE OBLIGATION FULFILLED PER Service Member REQUEST',
      ],
    }
  );
  // Should extract from block 28, even with continuation
  assert.ok(result);
  assert.match(result, /REQUIRED|ACTIVE/i);
});
