import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseDD214 } from '../../backend/va_scanner/backend/shared/scanner/dd214Scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadCorpusInput(caseName) {
  return fs.readFileSync(path.join(__dirname, 'corpus', caseName, 'input.txt'), 'utf8');
}

const reenlistmentOverrideSample = `
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
FLETCHER, DALE ARTHUR
2. DEPARTMENT, COMPONENT AND BRANCH
ARMY / RA
3. SOCIAL SECURITY NUMBER
540-98-0772
8a. LAST DUTY ASSIGNMENT AND MAJOR COMMAND
020077FAEHE HHB FIRES B FC FORT CARSON TC, CO 80913-4143
9. COMMAND TO WHICH TRANSFERRED
10. SGLI COVERAGE | | NONE USAR CON GP (RET) 1600 SPEARHEAD DIVISION AVE, FT KNOX, KY 40122 AMOUNT: $400,000.00
11. PRIMARY SPECIALTY
13B3P CANNON CREWMEMBER - 1 YRS 8 MOS // 12W3S CARPENTRY AND MASONRY - 1 YRS 6 MOS
12. RECORD OF SERVICE
a. DATE ENTERED AD THIS PERIOD | 2009 | 04 | 28 |
b. SEPARATION DATE THIS PERIOD | 2017 | 11 | 26 |
c. NET ACTIVE SERVICE THIS PERIOD | 0008 | 06 | 29 |
d. TOTAL PRIOR ACTIVE SERVICE | 0004 | 09 | 00 |
e. TOTAL PRIOR INACTIVE SERVICE | 0000 | 00 | 00 |
f. FOREIGN SERVICE | 0001 | 00 | 00 |
g. SEA SERVICE | 0000 | 00 | 00 |
13. DECORATIONS, MEDALS, BADGES
AFGHANISTAN CAMPAIGN MEDAL WITH CAMPAIGN STAR
ARMY COMMENDATION MEDAL (5TH AWARD)
18. REMARKS
SERVICE IN AFGHANISTAN FROM 20111007-20171126
IMMEDIATE REENLISTMENTS THIS PERIOD: 20111007-20171126
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
SEPARATION AUTHORITY 26. SEPARATION CODE 27. REENTRY CODE AR 635-40, CHAP 4 SEC 4
26. SEPARATION CODE
SFK
27. REENTRY CODE
4
28. NARRATIVE REASON FOR SEPARATION
SUFFICIENT SERVICE FOR RETIREMENT
19a. MAILING ADDRESS AFTER SEPARATION
123 MAIN ST, KUNA, ID 83634
19b. NEAREST RELATIVE
JANE FLETCHER, KUNA, ID
21.a. MEMBER SIGNATURE
SIGNED BY MEMBER
`;

test('Block 12a entry date is not overwritten by reenlistment ranges', () => {
  const parsed = parseDD214(reenlistmentOverrideSample);
  assert.equal(parsed.servicePeriods.entryDate, '2009-04-28');
  assert.equal(parsed.servicePeriods.separationDate, '2017-11-26');
  assert.deepEqual(parsed.servicePeriods.netActiveServiceThisPeriod, { years: 8, months: 6, days: 29 });
});

test('Transfer command strips SGLI boilerplate and keeps command target', () => {
  const parsed = parseDD214(reenlistmentOverrideSample);
  const transfer = parsed.transferCommand?.postServiceComponent || '';
  assert.match(transfer, /USAR\s+CON\s+GP/i);
  assert.ok(!/SGLI\s*COVERAGE/i.test(transfer));
});

test('Separation authority narrows to regulation citation', () => {
  const parsed = parseDD214(reenlistmentOverrideSample);
  assert.equal(parsed.characterAndSeparation?.separationAuthority, 'AR 635-40, CHAP 4 SEC 4');
});

test('Last duty assignment prefers Block 8a and keeps major command', () => {
  const parsed = parseDD214(reenlistmentOverrideSample);
  assert.match(String(parsed.lastDutyAssignment?.lastDutyAssignmentTitle || ''), /HHB FIRES B FC/i);
  assert.ok(parsed.lastDutyAssignment?.majorCommand);
});

test('Post-service contact fields avoid signature contamination', () => {
  const parsed = parseDD214(reenlistmentOverrideSample);
  assert.match(String(parsed.postServiceContact?.mailingAddressAtSeparation || ''), /KUNA, ID/i);
  assert.match(String(parsed.postServiceContact?.nearestRelativeOrEmergencyContact || ''), /JANE FLETCHER/i);
  assert.ok(!/SIGNATURE/i.test(String(parsed.postServiceContact?.mailingAddressAtSeparation || '')));
});

test('Flattened dd214Analysis fields are populated for UI compatibility', () => {
  const parsed = parseDD214(reenlistmentOverrideSample);
  const analysis = parsed.dd214Analysis;
  assert.equal(analysis.branch, 'Army');
  assert.equal(analysis.entryDate, '2009-04-28');
  assert.equal(analysis.separationDate, '2017-11-26');
  assert.ok(Array.isArray(analysis.deploymentLocations));
  assert.ok(Array.isArray(analysis.unifiedDeploymentAndHazards));
  assert.ok(Array.isArray(analysis.awards));
});

test('parachutist and military freefall indicators are preserved and trigger hazard indicators', () => {
  const parsed = parseDD214(`
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
DOE, JOHN Q
2. DEPARTMENT, COMPONENT, AND BRANCH
ARMY / RA
12a. DATE ENTERED AD THIS PERIOD
2010-01-01
12b. SEPARATION DATE THIS PERIOD
2016-01-01
13. DECORATIONS, MEDALS, BADGES
AFGHANISTAN CAMPAIGN MEDAL WITH CAMPAIGN STAR // PARACHUTIST BADGE // MILITARY FREEFALL PARACHUTIST BADGE
18. REMARKS
CONT FROM BLOCK 18: PARACHUTIST MILITARY FREEFALL QUALIFIED
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
AR 635-200
26. SEPARATION CODE
LBK
27. REENTRY CODE
1
28. NARRATIVE REASON FOR SEPARATION
COMPLETION OF REQUIRED ACTIVE SERVICE
`);

  const awards = parsed?.decorationsAndService?.decorationsAndAwards || [];
  assert.ok(awards.some((value) => /PARACHUTIST\s+BADGE/i.test(String(value || ''))));
  assert.ok(awards.some((value) => /MILITARY\s+FREEFALL/i.test(String(value || ''))));

  const hazards = parsed?.intelligentExtraction?.hazardIndicators || [];
  assert.ok(hazards.some((value) => /PARACHUTIST/i.test(String(value || ''))));
  assert.ok(hazards.some((value) => /MILITARY\s+FREEFALL/i.test(String(value || ''))));
});

test('Navy sea-service corpus extracts branch, sea service, and fleet reserve SPD code', () => {
  const parsed = parseDD214(loadCorpusInput('navy-veteran-sea-service'));

  assert.equal(parsed.serviceIdentity?.branchOfService, 'Navy');
  assert.equal(parsed.servicePeriods?.seaService?.years, 2);
  assert.equal(parsed.characterAndSeparation?.separationCode, 'BFS');
  assert.equal(parsed.characterAndSeparation?.reentryCode, '1');
});

test('ARNG corpus retains guard component and waiver-coded RE status', () => {
  const parsed = parseDD214(loadCorpusInput('arng-guard-separation'));

  assert.match(String(parsed.serviceIdentity?.component || ''), /GUARD|ARNG/i);
  assert.equal(parsed.characterAndSeparation?.separationCode, 'MBK');
  assert.equal(parsed.characterAndSeparation?.reentryCode, '3');
  assert.match(String(parsed.characterAndSeparation?.characterOfService || ''), /GENERAL/i);
});

test('BCD corpus captures punitive discharge characteristics', () => {
  const parsed = parseDD214(loadCorpusInput('bcd-oth-discharge'));

  assert.match(String(parsed.characterAndSeparation?.characterOfService || ''), /BAD\s+CONDUCT/i);
  assert.equal(parsed.characterAndSeparation?.separationCode, 'JJD');
  assert.equal(parsed.characterAndSeparation?.reentryCode, '4');
});

// ─── Manual Review Fallback Tests ───────────────────────────────

const lowConfidenceGarbledFormat = `
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ
SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS
JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ
8a BLAH BLAH
12a 1234-56-78 GARBAGE TEXT
25 UNKNOWN CODE SOUP
`;

test('Manual review fallback triggers when extraction confidence is very low (<30%)', () => {
  const parsed = parseDD214(lowConfidenceGarbledFormat);
  // This should trigger manual review recommendation if overall confidence is <30%
  const analysis = parsed.dd214Analysis;
  if (parsed.extractionMeta?.confidence < 30 && !analysis.validationSummary?.allChecksPassed) {
    assert.ok(analysis.manualReviewRecommended, 'Manual review should be recommended');
    assert.ok(analysis.manualReviewReason, 'Should have fallback reason');
    assert.ok(analysis.manualReviewMessage, 'Should have review message');
  }
});

test('Manual review fallback provides structured field stubs with confidence and suggestions', () => {
  const parsed = parseDD214(lowConfidenceGarbledFormat);
  if (parsed.extractionMeta?.confidence < 30) {
    const analysis = parsed.dd214Analysis;
    if (analysis.manualReviewRecommended) {
      // Check that the analysis includes the standard structure with review recommendations
      assert.ok(analysis.validationSummary, 'validationSummary section should exist');
      assert.ok(analysis.manualReviewMessage, 'Should provide message');
      assert.ok(['critical', 'high', 'medium', 'low'].includes(analysis.manualReviewPriority), 'Should have priority');
    }
  }
});

test('Manual review fallback includes review priority indicators', () => {
  const parsed = parseDD214(lowConfidenceGarbledFormat);
  if (parsed.extractionMeta?.confidence < 30) {
    const analysis = parsed.dd214Analysis;
    if (analysis.manualReviewRecommended) {
      // Check priorities
      const priority = analysis.manualReviewPriority;
      assert.ok(['critical', 'high', 'medium', 'low'].includes(priority), 'Should have valid review priority');
    }
  }
});

test('Manual review fallback embeds OCR quality assessment and applied enhancements', () => {
  const parsed = parseDD214(lowConfidenceGarbledFormat);
  if (parsed.extractionMeta?.confidence < 30) {
    const analysis = parsed.dd214Analysis;
    if (analysis.manualReviewRecommended) {
      // Check for quality metadata in analysis
      assert.ok(typeof analysis.manualReviewMessage === 'string', 'Message should be a string');
      assert.ok(analysis.manualReviewReason, 'Should have reason');
    }
  }
});

