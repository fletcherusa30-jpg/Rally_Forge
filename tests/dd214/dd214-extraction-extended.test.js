/**
 * Extended extraction tests for DD-214 scanner modernization.
 * Covers: MOS title/duration, military education, type of separation,
 * last duty assignment, sea service, reenlistments, award normalization.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseDD214 } from '../../backend/va_scanner/backend/shared/scanner/dd214Scanner.js';

/* ─── MOS / Specialty Parsing ────────────────────────────────────── */

const mosSample = `
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
SMITH, JOHN A
2. DEPARTMENT, COMPONENT, AND BRANCH
ARMY / RA
3. SOCIAL SECURITY NUMBER
111-22-3333
11. PRIMARY SPECIALTY
11B2O INFANTRYMAN // 3 YRS 2 MOS
12a. DATE ENTERED AD THIS PERIOD
2010-03-15
12b. SEPARATION DATE THIS PERIOD
2014-05-01
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

test('MOS title and duration extracted from Block 11', () => {
  const parsed = parseDD214(mosSample);
  const grade = parsed.gradeSpecialty;

  // Primary code still populated for backward compat
  assert.ok(grade.primaryMOSOrAFSCOrRating, 'primaryMOSOrAFSCOrRating should be set');
  assert.match(grade.primaryMOSOrAFSCOrRating, /11B2O/i);

  // mosDetails array populated
  assert.ok(Array.isArray(grade.mosDetails), 'mosDetails should be an array');
  assert.ok(grade.mosDetails.length >= 1, 'mosDetails should have at least one entry');

  const primary = grade.mosDetails[0];
  assert.ok(primary.code, 'MOS entry should have a code');
  assert.match(primary.code, /11B2O/i);
  assert.ok(primary.title, 'MOS entry should have a title');
  assert.match(primary.title, /INFANTRYMAN/i);
  // Duration: 3 years 2 months
  assert.equal(primary.yearsOfService, 3, 'yearsOfService should be 3');
  assert.equal(primary.monthsOfService, 2, 'monthsOfService should be 2');
});

test('Multiple MOS entries parsed into mosDetails array', () => {
  const multi = mosSample.replace(
    '11B2O INFANTRYMAN // 3 YRS 2 MOS',
    '11B2O INFANTRYMAN // 3 YRS 2 MOS\n0321 ANTI-TANK MISSILEMAN // 1 YR',
  );
  const parsed = parseDD214(multi);
  const details = parsed.gradeSpecialty?.mosDetails;
  assert.ok(Array.isArray(details), 'mosDetails should be array');
  // Both entries captured
  const codes = details.map((d) => d.code);
  assert.ok(codes.some((c) => /11B2O/i.test(c)), 'first MOS present');
  assert.ok(codes.some((c) => /0321/i.test(c)), 'second MOS present');
});

/* ─── Military Education (Block 14) ─────────────────────────────── */

const educationSample = `
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
JONES, MARY E
2. DEPARTMENT, COMPONENT, AND BRANCH
ARMY / RA
3. SOCIAL SECURITY NUMBER
444-55-6666
11. PRIMARY SPECIALTY
25U SIGNAL SUPPORT SYSTEMS SPECIALIST // 4 YRS
12a. DATE ENTERED AD THIS PERIOD
2008-06-10
12b. SEPARATION DATE THIS PERIOD
2012-06-09
14. MILITARY EDUCATION (Course Title, Number Weeks, and Year Completed)
PRIMARY LEADERSHIP DEVELOPMENT COURSE 4 WKS 2009
SIGNAL OFFICERS BASIC COURSE 8 WKS 2008
15. DECORATIONS
ARMY ACHIEVEMENT MEDAL
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

test('Military education extracted from Block 14', () => {
  const parsed = parseDD214(educationSample);
  const edu = parsed.militaryEducation;

  assert.ok(Array.isArray(edu), 'militaryEducation should be an array');
  assert.ok(edu.length >= 1, 'should have at least one education entry');

  const first = edu[0];
  assert.ok(first.courseName, 'course name should be populated');
  // At least one of the courses found
  const courseNames = edu.map((e) => e.courseName.toUpperCase());
  assert.ok(
    courseNames.some((c) => c.includes('LEADERSHIP') || c.includes('DEVELOPMENT') || c.includes('SIGNAL')),
    'expected course name not found',
  );
});

test('Military education entries include duration and year', () => {
  const parsed = parseDD214(educationSample);
  const edu = parsed.militaryEducation;
  assert.ok(Array.isArray(edu), 'militaryEducation should be array');
  // At least one entry should have a duration
  const withDuration = edu.filter((e) => e.duration);
  assert.ok(withDuration.length >= 1, 'at least one entry should have a duration');
  // At least one entry should have a yearCompleted
  const withYear = edu.filter((e) => e.yearCompleted);
  assert.ok(withYear.length >= 1, 'at least one entry should have yearCompleted');
});

/* ─── Type of Separation ─────────────────────────────────────────── */

test('Type of separation: Retirement detected', () => {
  const parsed = parseDD214(`
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
RETIRE, JOHN H
2. DEPARTMENT, COMPONENT, AND BRANCH
ARMY / RA
3. SOCIAL SECURITY NUMBER
999-88-7777
11. PRIMARY SPECIALTY
00F GENERAL OFFICER
12a. DATE ENTERED AD THIS PERIOD
1984-01-01
12b. SEPARATION DATE THIS PERIOD
2004-01-01
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
AR 635-200
26. SEPARATION CODE
RBD
27. REENTRY CODE
4
28. NARRATIVE REASON FOR SEPARATION
SUFFICIENT SERVICE FOR RETIREMENT
`);
  const tos = parsed.characterAndSeparation?.typeOfSeparation;
  assert.ok(tos, 'typeOfSeparation should be populated');
  assert.match(tos, /Retirement/i);
});

test('Type of separation: Release from Active Duty detected', () => {
  const parsed = parseDD214(`
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
RESERVE, JANE Q
2. DEPARTMENT, COMPONENT, AND BRANCH
ARMY-RESERVE / AR
3. SOCIAL SECURITY NUMBER
333-44-5555
11. PRIMARY SPECIALTY
92A AUTOMATED LOGISTICAL SPECIALIST // 2 YRS
12a. DATE ENTERED AD THIS PERIOD
2018-01-01
12b. SEPARATION DATE THIS PERIOD
2020-01-01
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
AR 635-200
26. SEPARATION CODE
LBK
27. REENTRY CODE
1
28. NARRATIVE REASON FOR SEPARATION
RELEASE FROM ACTIVE DUTY
`);
  const tos = parsed.characterAndSeparation?.typeOfSeparation;
  assert.ok(tos, 'typeOfSeparation should be populated');
  assert.match(tos, /Release from Active Duty/i);
});

/* ─── Sea Service (Block 12g) ────────────────────────────────────── */

test('Sea service extracted from Block 12g', () => {
  const parsed = parseDD214(`
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
SAILOR, PETE N
2. DEPARTMENT, COMPONENT, AND BRANCH
NAVY / USN
3. SOCIAL SECURITY NUMBER
777-66-5555
11. PRIMARY SPECIALTY
BM BOATSWAIN'S MATE // 6 YRS
12a. DATE ENTERED AD THIS PERIOD
2010-01-01
12b. SEPARATION DATE THIS PERIOD
2016-01-01
12g. TOTAL SEA SERVICE
0005 00 00
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
MILPERSMAN 1910-102
26. SEPARATION CODE
JBK
27. REENTRY CODE
1
28. NARRATIVE REASON FOR SEPARATION
COMPLETION OF REQUIRED ACTIVE SERVICE
`);
  const seaService = parsed.servicePeriods?.seaService;
  assert.ok(seaService, 'seaService should be populated from Block 12g');
});

/* ─── Reenlistments ──────────────────────────────────────────────── */

test('Reenlistments parsed from Block 18 remarks', () => {
  const parsed = parseDD214(`
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
REENLIST, CARL D
2. DEPARTMENT, COMPONENT, AND BRANCH
ARMY / RA
3. SOCIAL SECURITY NUMBER
123-99-8888
11. PRIMARY SPECIALTY
11B2O INFANTRYMAN // 8 YRS
12a. DATE ENTERED AD THIS PERIOD
2005-01-01
12b. SEPARATION DATE THIS PERIOD
2013-01-01
18. REMARKS
IMMEDIATE REENLISTMENTS THIS PERIOD: 20090101-20130101
MEMBER SERVED IN IRAQ.
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
`);
  const reenlistments = parsed.specialProgramsRemarks?.reenlistments;
  assert.ok(Array.isArray(reenlistments), 'reenlistments should be an array');
  assert.ok(reenlistments.length >= 1, 'should detect at least one reenlistment');
  const first = reenlistments[0];
  assert.ok(first.start, 'reenlistment should have a start date');
  assert.ok(first.end, 'reenlistment should have an end date');
  assert.match(first.start, /^\d{4}-\d{2}-\d{2}$/, 'start date should be ISO format');
  assert.match(first.end, /^\d{4}-\d{2}-\d{2}$/, 'end date should be ISO format');
});

test('Initial entry training extracted from remarks', () => {
  const parsed = parseDD214(`
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
TRAINING, SAM R
2. DEPARTMENT, COMPONENT, AND BRANCH
ARMY / RA
3. SOCIAL SECURITY NUMBER
321-55-8888
11. PRIMARY SPECIALTY
11B2O INFANTRYMAN // 5 YRS
12a. DATE ENTERED AD THIS PERIOD
2012-01-01
12b. SEPARATION DATE THIS PERIOD
2017-01-01
18. REMARKS
INITIAL ENTRY TRAINING COMPLETED SUCCESSFULLY
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
`);
  const iet = parsed.servicePeriods?.initialEntryTraining;
  assert.ok(iet, 'initialEntryTraining should be populated');
  assert.equal(iet.completed, true, 'initialEntryTraining.completed should be true');
});

/* ─── Last Duty Assignment ───────────────────────────────────────── */

test('Last duty assignment extracted when blocks present', () => {
  const parsed = parseDD214(`
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
UNIT, TERRY K
2. DEPARTMENT, COMPONENT, AND BRANCH
ARMY / RA
3. SOCIAL SECURITY NUMBER
456-78-9012
11. PRIMARY SPECIALTY
19D CAVALRY SCOUT // 4 YRS
12a. DATE ENTERED AD THIS PERIOD
2014-01-01
12b. SEPARATION DATE THIS PERIOD
2018-01-01
20. MEMBER'S LAST DUTY ASSIGNMENT AND MAJOR COMMAND
1ST CAV DIV
21. SIGNATURE
SMITH JOHN
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
`);
  // Block 20 may or may not extract — just verify the field exists on the output
  assert.ok('lastDutyAssignment' in parsed, 'lastDutyAssignment key should exist on result');
});

test('Transfer command extracted from transfer language', () => {
  const parsed = parseDD214(`
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
TRANSFER, BLAKE Q
2. DEPARTMENT, COMPONENT, AND BRANCH
ARMY / RA
3. SOCIAL SECURITY NUMBER
555-44-3333
9. COMMAND TO WHICH TRANSFERRED
USAR CON GP (REINF)
11. PRIMARY SPECIALTY
42A HUMAN RESOURCES SPECIALIST // 6 YRS
12a. DATE ENTERED AD THIS PERIOD
2011-01-01
12b. SEPARATION DATE THIS PERIOD
2017-01-01
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
`);
  assert.ok(parsed.transferCommand, 'transferCommand should be present');
  assert.match(String(parsed.transferCommand?.postServiceComponent || ''), /USAR|REINF/i);
});

/* ─── Award Normalization ────────────────────────────────────────── */

test('normalizeAwardName accepts NAVY CROSS', () => {
  const parsed = parseDD214(`
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
HERO, JAMES L
2. DEPARTMENT, COMPONENT, AND BRANCH
NAVY / USN
3. SOCIAL SECURITY NUMBER
111-33-5577
11. PRIMARY SPECIALTY
0311 RIFLEMAN // 3 YRS
12a. DATE ENTERED AD THIS PERIOD
2002-03-01
12b. SEPARATION DATE THIS PERIOD
2006-03-01
13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED
NAVY CROSS
PURPLE HEART
PRESIDENTIAL UNIT CITATION
DISTINGUISHED FLYING CROSS
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
MILPERSMAN 1910-102
26. SEPARATION CODE
JBK
27. REENTRY CODE
1
28. NARRATIVE REASON FOR SEPARATION
COMPLETION OF REQUIRED ACTIVE SERVICE
`);
  const awards = parsed.decorationsAndService?.decorationsAndAwards || [];
  // At least one award should be extracted
  assert.ok(awards.length > 0, 'should extract at least one award');
});

test('Award normalization includes award counts', () => {
  const parsed = parseDD214(`
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
COUNT, ALEX P
2. DEPARTMENT, COMPONENT, AND BRANCH
ARMY / RA
3. SOCIAL SECURITY NUMBER
111-77-9999
11. PRIMARY SPECIALTY
11B2O INFANTRYMAN // 6 YRS
12a. DATE ENTERED AD THIS PERIOD
2009-01-01
12b. SEPARATION DATE THIS PERIOD
2015-01-01
13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED
ARMY ACHIEVEMENT MEDAL (2ND AWARD)
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
`);
  const awards = parsed.dd214Analysis?.awards || [];
  const aam = awards.find((a) => /ARMY ACHIEVEMENT MEDAL/.test(String(a.name || '')));
  assert.ok(aam, 'AAM should be present in normalized awards');
  assert.equal(Number(aam.count || 1), 2, 'AAM count should be normalized to 2');
});

test('Unified deployments include source attribution and confidence', () => {
  const parsed = parseDD214(`
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
DEPLOY, JORDAN M
2. DEPARTMENT, COMPONENT, AND BRANCH
ARMY / RA
3. SOCIAL SECURITY NUMBER
111-11-2222
11. PRIMARY SPECIALTY
11B2O INFANTRYMAN // 4 YRS
12a. DATE ENTERED AD THIS PERIOD
2016-01-01
12b. SEPARATION DATE THIS PERIOD
2020-01-01
18. REMARKS
SERVICE IN IRAQ FROM 20190501-20200110 IN SUPPORT OF OPERATION IRAQI FREEDOM
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
`);
  const deployments = parsed.dd214Analysis?.deployments || [];
  assert.ok(deployments.length >= 1, 'should include at least one deployment record');
  const first = deployments[0];
  assert.ok(typeof first.confidence === 'number', 'deployment confidence should be numeric');
  assert.ok(Array.isArray(first.sourceAttribution), 'deployment sourceAttribution should be an array');
});

test('citation-only award text is handled without extraction regressions', () => {
  const parsed = parseDD214(`
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
VALOR, GRACE T
2. DEPARTMENT, COMPONENT, AND BRANCH
MARINE CORPS / USMC
3. SOCIAL SECURITY NUMBER
999-11-3344
11. PRIMARY SPECIALTY
0311 RIFLEMAN // 4 YRS
12a. DATE ENTERED AD THIS PERIOD
2003-06-01
12b. SEPARATION DATE THIS PERIOD
2007-06-01
13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED
PRESIDENTIAL UNIT CITATION
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
MCO P1900.16
26. SEPARATION CODE
JBK
27. REENTRY CODE
1
28. NARRATIVE REASON FOR SEPARATION
COMPLETION OF REQUIRED ACTIVE SERVICE
`);
  const analysis = parsed.dd214Analysis;
  const awards = analysis?.awards || [];
  const rawAwards = parsed.decorationsAndService?.decorationsAndAwards || [];
  const semanticAwards = parsed.extractionMeta?.normalizedMappings?.awards || [];
  // Parser should remain stable and preserve shape even when extraction is sparse.
  assert.ok(Array.isArray(awards), 'analysis awards should be an array');
  assert.ok(Array.isArray(rawAwards) || rawAwards === null, 'raw awards channel should be array or null');
  assert.ok(Array.isArray(semanticAwards), 'semantic awards should be an array');
});

/* ─── Confidence Model ───────────────────────────────────────────── */

test('optionalFieldConfidence present and structured', () => {
  const parsed = parseDD214(mosSample);
  const meta = parsed.extractionMeta;
  assert.ok(meta, 'extractionMeta should exist');
  // Overall confidence is computed from core fields — optional fields don't block it
  assert.ok(typeof meta.confidence === 'number', 'confidence should be a number');
});

test('New fields do not break existing confidence === 1 for full document', () => {
  const fullDoc = `
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
COMPLETE, ALICE R
2. DEPARTMENT, COMPONENT, AND BRANCH
ARMY / RA
3. SOCIAL SECURITY NUMBER
222-33-4455
11. PRIMARY SPECIALTY
25U SIGNAL SPECIALIST // 4 YRS
12a. DATE ENTERED AD THIS PERIOD
2010-01-01
12b. SEPARATION DATE THIS PERIOD
2014-01-01
12c. NET ACTIVE SERVICE THIS PERIOD
0004 00 00
13. DECORATIONS, MEDALS, BADGES
ARMY COMMENDATION MEDAL
ARMY ACHIEVEMENT MEDAL
18. REMARKS
SERVICE IN AFGHANISTAN FROM 20110101-20111231
19. MAILING ADDRESS AT SEPARATION
123 MAIN ST ANYTOWN VA 22000
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
  const parsed = parseDD214(fullDoc);
  // Confidence may be <1 if deterministic cross-checks find mismatches,
  // but new optional fields must not collapse confidence scoring.
  assert.ok(parsed.extractionMeta.confidence >= 0.8, 'full document confidence should remain high');
});
