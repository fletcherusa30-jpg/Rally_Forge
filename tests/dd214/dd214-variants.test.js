import test from 'node:test';
import assert from 'node:assert/strict';

import { parseDD214, looksLikeDD214 } from '../../backend/va_scanner/backend/shared/scanner/dd214Scanner.js';
import { detectDD214Variant } from '../../backend/va_scanner/backend/shared/scanner/dd214VariantModel.js';
import { correctDD214OcrNoise } from '../../backend/va_scanner/backend/shared/scanner/dd214OcrCorrection.js';
import { detectDD214Blocks } from '../../backend/va_scanner/backend/shared/scanner/dd214BlockDetectionModel.js';

const member4Text = `
DD FORM 214 MEMBER-4
CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
1. NAME (Last, First, Middle)\nDOE, JOHN Q
2. DEPARTMENT, COMPONENT AND BRANCH\nARMY /RA
3. SOCIAL SECURITY NUMBER\n123-45-6789
11. PRIMARY SPECIALTY\n11B2O INFANTRYMAN
12a. DATE ENTERED AD THIS PERIOD\n2011-10-07
12b. SEPARATION DATE THIS PERIOD\n2017-11-26
12c. NET ACTIVE SERVICE THIS PERIOD\n0006 01 19
12d. TOTAL PRIOR ACTIVE SERVICE\n0001 00 00
12e. TOTAL PRIOR INACTIVE SERVICE\n0000 06 00
12f. FOREIGN SERVICE\n0001 00 00
12g. SEA SERVICE\n0000 00 00
13. DECORATIONS, MEDALS, BADGES\nIRAQ CAMPAIGN MEDAL//PARACHUTIST BADGE
18. REMARKS\nSERVICE IN IRAQ 20140101-20150101//MEMBER SERVED IN A DESIGNATED IMMINENT DANGER PAY AREA
25. SEPARATION AUTHORITY\nAR 635-200
26. SEPARATION CODE\nJBK
27. REENTRY CODE\n1
28. NARRATIVE REASON FOR SEPARATION\nCOMPLETION OF REQUIRED ACTIVE SERVICE
`;

const member1Text = `
DD FORM 214 MEMBER-1
CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
NAME OF MEMBER: SMITH, JANE A
ARMY NATIONAL GUARD
`;

const dd215Text = `
DD FORM 215
CORRECTION TO DD FORM 214, CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
NAME: DOE, JOHN Q
`;

const ngb22Text = `
NGB FORM 22
REPORT OF SEPARATION AND RECORD OF SERVICE
ARMY NATIONAL GUARD
`;

test('detects supported DD-214 variants', () => {
  assert.equal(detectDD214Variant(member4Text).variantType, 'DD214_MEMBER_4');
  assert.equal(detectDD214Variant(member1Text).variantType, 'DD214_MEMBER_1');
  assert.equal(detectDD214Variant(dd215Text).variantType, 'DD215_CORRECTION');
  assert.equal(detectDD214Variant(ngb22Text).variantType, 'NGB22');
});

test('looksLikeDD214 accepts DD214 family docs', () => {
  assert.equal(looksLikeDD214(member4Text), true);
  assert.equal(looksLikeDD214(dd215Text), true);
  assert.equal(looksLikeDD214(ngb22Text), true);
});

test('ocr correction normalizes common OCR artifacts', () => {
  const corrected = correctDD214OcrNoise('SEJ 4 E07 O03 0CT CONT IN BLOCK 18 RIBB0NS AWARDED OR AUTH0RIZED (All perlods of service) year completed)');
  assert.match(corrected, /SEC 4/);
  assert.match(corrected, /E-7/);
  assert.match(corrected, /O-3/);
  assert.match(corrected, /OCT/);
  assert.match(corrected, /CONT FROM BLOCK 18/);
  assert.doesNotMatch(corrected, /RIBBONS AWARDED OR AUTHORIZED/i);
});

test('block detection extracts key DD214 blocks', () => {
  const blocks = detectDD214Blocks(member4Text);
  assert.match(String(blocks.block1_name || ''), /DOE, JOHN Q/i);
  assert.match(String(blocks.block25_authority || ''), /AR 635-200/i);
  assert.match(String(blocks.block28_reason || ''), /COMPLETION OF REQUIRED ACTIVE SERVICE/i);
});

test('parseDD214 produces required dd214Analysis schema contract', () => {
  const parsed = parseDD214(member4Text);
  const analysis = parsed.dd214Analysis;

  assert.ok(analysis);
  assert.ok(analysis.identification);
  assert.ok(analysis.serviceDates);
  assert.ok(analysis.separation);
  assert.ok(analysis.rankAndSpecialty);
  assert.ok(Array.isArray(analysis.awards));
  assert.ok(Array.isArray(analysis.deployments));
  assert.ok(Array.isArray(analysis.remarks));
  assert.ok(Array.isArray(analysis.crossValidationFlags));
  assert.ok(analysis.confidenceScores);
  assert.equal(typeof analysis.notes, 'string');
});
