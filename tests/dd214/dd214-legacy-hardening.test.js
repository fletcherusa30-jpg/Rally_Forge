import test from 'node:test';
import assert from 'node:assert/strict';

import { parseDD214, looksLikeDD214 } from '../../backend/va_scanner/backend/shared/scanner/dd214Scanner.js';
import { detectDD214Variant } from '../../backend/va_scanner/backend/shared/scanner/dd214VariantModel.js';

const legacy1977 = `
DD FORM 214 NOV 1977
CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
1. NAME
DOE, ROBERT L
2. DEPARTMENT, COMPONENT AND BRANCH
ARMY / RA
11. PRIMARY SPECIALTY
11B INFANTRYMAN
12a. DATE ENTERED ACTIVE DUTY THIS PERIOD 1974-05-01
12b. SEPARATION DATE THIS PERIOD 1977-09-30
12c. NET ACTIVE SERVICE THIS PERIOD 0003 04 29
13. DECORATIONS MEDALS BADGES
NATIONAL DEFENSE SERVICE MEDAL
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
AR 635-200
26. SEPARATION CODE
LBK
27. REENTRY CODE
1
28. NARRATIVE REASON FOR SEPARATION
EXPIRATION TERM OF SERVICE
`;

test('legacy pre-1980 variant is detected', () => {
  const variant = detectDD214Variant(legacy1977);
  assert.equal(variant.variantType, 'DD214_LEGACY_PRE_1980');
  assert.equal(looksLikeDD214(legacy1977), true);
});

test('legacy pre-1980 document still resolves core service dates', () => {
  const parsed = parseDD214(legacy1977);
  assert.equal(parsed.servicePeriods.entryDate, '1974-05-01');
  assert.equal(parsed.servicePeriods.separationDate, '1977-09-30');
  assert.equal(parsed.characterAndSeparation.characterOfService, 'Honorable');
});

const rotatedLikeOcr = `
DD F0RM 214 MEMBER-4
CERTlFlCATE 0F RELEASE OR DlSCHARGE FR0M ACTlVE DUTY
1. NAME (Last, First, Middle)
SMlTH, ANDREA K
2. DEPARTMENT, C0MPONENT, AND BRANCH
ARMY / RA
11. PRIMARY SPECIALTY
11B2O INFANTRYMAN // 3 YRS 2 MOS
12a. DATE ENTERED AD THlS PERlOD
2018-01-05
12b. SEPARATI0N DATE THlS PERlOD
2022-01-04
13. DEC0RATI0NS, MEDALS, BADGES
lRAQ CAMPAIGN MEDAL
18. REMARKS
SERVlCE lN lRAQ FR0M 20190501-20200110 lN SUPP0RT 0F OPERATI0N lRAQl FREEDOM
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
AR 635-200
26. SEPARATION CODE
JBK
27. REENTRY CODE
1
28. NARRATIVE REASON FOR SEPARATION
COMPLETION OF REQUIRED ACTIVE SERVICE
`;

test('OCR-degraded document still extracts deployment with confidence and source attribution', () => {
  const parsed = parseDD214(rotatedLikeOcr);
  const deployments = parsed.dd214Analysis?.deployments || [];
  assert.ok(deployments.length >= 1, 'expected at least one deployment');
  assert.ok(deployments.some((d) => /Iraq/i.test(String(d.location || ''))), 'expected Iraq deployment');
  const first = deployments[0];
  assert.ok(typeof first.confidence === 'number', 'deployment confidence should be numeric');
  assert.ok(Array.isArray(first.sourceAttribution), 'source attribution should be present');
});

const trainingNoise = `
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
NOISE, JAMIE T
2. DEPARTMENT, COMPONENT, AND BRANCH
ARMY / RA
11. PRIMARY SPECIALTY
42A HUMAN RESOURCES SPECIALIST // 4 YRS
12a. DATE ENTERED AD THIS PERIOD
2016-01-01
12b. SEPARATION DATE THIS PERIOD
2020-01-01
18. REMARKS
COMPLETED KOREA LANGUAGE TRAINING COURSE AT FORT BRAGG
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
AR 635-200
26. SEPARATION CODE
JBK
27. REENTRY CODE
1
28. NARRATIVE REASON FOR SEPARATION
COMPLETION OF REQUIRED ACTIVE SERVICE
`;

test('training-only location mention does not create a deployment record', () => {
  const parsed = parseDD214(trainingNoise);
  const deployments = parsed.dd214Analysis?.deployments || [];
  assert.equal(deployments.length, 0);
});

const duplicateDeployment = `
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
DUPLICATE, CASEY R
2. DEPARTMENT, COMPONENT, AND BRANCH
ARMY / RA
11. PRIMARY SPECIALTY
11B2O INFANTRYMAN // 4 YRS
12a. DATE ENTERED AD THIS PERIOD
2016-01-01
12b. SEPARATION DATE THIS PERIOD
2020-01-01
18. REMARKS
SERVICE IN IRAQ FROM 20190501-20200110
SERVICE IN IRAQ FROM 20190501-20200110
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
AR 635-200
26. SEPARATION CODE
JBK
27. REENTRY CODE
1
28. NARRATIVE REASON FOR SEPARATION
COMPLETION OF REQUIRED ACTIVE SERVICE
`;

test('duplicate deployment mentions are deduplicated in analysis', () => {
  const parsed = parseDD214(duplicateDeployment);
  const deployments = parsed.dd214Analysis?.deployments || [];
  assert.equal(deployments.length, 1);
  assert.match(String(deployments[0].location || ''), /Iraq/i);
});
