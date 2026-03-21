import test from 'node:test';
import assert from 'node:assert/strict';

import { parseDD214 } from '../../backend/va_scanner/backend/shared/scanner/dd214Scanner.js';

const deterministicSample = `
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)\nDOE, JAMIE K
2. DEPARTMENT, COMPONENT, AND BRANCH\nARMY / RA
3. SOCIAL SECURITY NUMBER\n123-45-6789
11. PRIMARY SPECIALTY\n11B2O INFANTRYMAN // 3 YRS 2 MOS
12a. DATE ENTERED AD THIS PERIOD\n2018-01-05
12b. SEPARATION DATE THIS PERIOD\n2022-01-04
12c. NET ACTIVE SERVICE THIS PERIOD\n0003 11 30
13. DECORATIONS, MEDALS, BADGES\nIRAQ CAMPAIGN MEDAL//ARMY COMMENDATION MEDAL
18. REMARKS\nSERVICE IN IRAQ FROM 20190501-20200110
CONT FROM BLOCK 13: COMBAT INFANTRYMAN BADGE
CONT FROM BLOCK 18: MEMBER SERVED IN A DESIGNATED IMMINENT DANGER PAY AREA
24. CHARACTER OF SERVICE\nHONORABLE
25. SEPARATION AUTHORITY\nAR 635-200
26. SEPARATION CODE\nJBK
27. REENTRY CODE\n1
28. NARRATIVE REASON FOR SEPARATION\nCOMPLETION OF REQUIRED ACTIVE SERVICE
`;

test('deterministic DD-214 parsing anchors to blocks and merges continuation', () => {
  const parsed = parseDD214(deterministicSample);

  assert.equal(parsed.servicePeriods.entryDate, '2018-01-05');
  assert.equal(parsed.servicePeriods.separationDate, '2022-01-04');
  assert.equal(parsed.serviceIdentity.component, 'Active');
  assert.match(String(parsed.gradeSpecialty.primaryMOSOrAFSCOrRating || ''), /11B/i);

  const awards = parsed.decorationsAndService.decorationsAndAwards || [];
  assert.ok(awards.some((value) => /COMBAT INFANTRYMAN BADGE/i.test(value)));

  const remarks = String(parsed.specialProgramsRemarks.remarksBlock || '');
  assert.match(remarks, /IMMINENT DANGER PAY/i);

  assert.equal(parsed.extractionMeta.confidence, 1);
  assert.equal(parsed.dd214Analysis.validationSummary.allChecksPassed, true);
});

test('confidence cannot be 100% when required deterministic checks fail', () => {
  const missingDates = `
  DD FORM 214 MEMBER-4
  1. NAME\nDOE, JAMIE K
  2. DEPARTMENT, COMPONENT, AND BRANCH\nUSAR
  13. DECORATIONS\nARMY ACHIEVEMENT MEDAL
  18. REMARKS\nNONE
  `;

  const parsed = parseDD214(missingDates);
  assert.ok(parsed.extractionMeta.confidence < 1);
  assert.equal(parsed.dd214Analysis.validationSummary.allChecksPassed, false);
});

test('noisy OCR DD-214 still resolves component/net service and filters ribbon boilerplate', () => {
  const noisySample = `
  DD FORM 214 MEMBER-4
  2. DEPARTMENT, COMPONENT, AND BRANCH\nARMY / R A
  12a. DATE ENTERED AD THIS PERIOD\n2009-04-28
  12b. SEPARATION DATE THIS PERIOD\n2017-11-26
  12c. NET ACTIVE SERVICE THIS PERIOD\n0008 O6 27
  13. DECORATIONS, MEDALS, BADGES\nRIBB0NS AWARDED OR AUTH0RIZED (All perlods of service) year completed) AFGHANISTAN CAMPAIGN MEDAL W/ CAMPAIGN STAR [ADV // ARMY COMMENDATION MEDAL (5TH AWARD)
  18. REMARKS\nCONT IN BLOCK 18 PARACHUTIST
  `;

  const parsed = parseDD214(noisySample);

  assert.equal(parsed.serviceIdentity.component, 'Active');
  assert.deepEqual(parsed.servicePeriods.netActiveServiceThisPeriod, { years: 8, months: 6, days: 27 });

  const awards = parsed.decorationsAndService?.decorationsAndAwards || [];
  assert.ok(awards.some((value) => /AFGHANISTAN\s+CAMPAIGN\s+MEDAL/i.test(value)));
  assert.ok(awards.some((value) => /ARMY COMMENDATION MEDAL/i.test(value)));
  assert.ok(!awards.some((value) => /RIBBONS\s+AWARDED\s+OR\s+AUTHORIZED/i.test(value)));
  assert.ok(!awards.some((value) => /\[ADV\b/i.test(String(value || ''))));
  assert.ok(!awards.some((value) => /^AWARD\)?$/i.test(String(value || '').trim())));
});

test('noisy block 24 does not leak SSN label into character of service', () => {
  const noisyCharacterSample = `
  DD FORM 214 MEMBER-4
  2. DEPARTMENT, COMPONENT, AND BRANCH\nARMY / RA
  24. CHARACTER OF SERVICE\nSOCIAL SECURITY NUMBER
  25. SEPARATION AUTHORITY\nAR 635-40, CHAP 4 SEC 4
  `;

  const parsed = parseDD214(noisyCharacterSample);
  assert.equal(parsed.characterAndSeparation.characterOfService, null);
});
