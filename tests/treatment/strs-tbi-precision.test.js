/**
 * STRS TBI Precision Test
 * 
 * Verifies that TBI/head indicators are NOT triggered by:
 * - Health assessment questionnaires ("number of TBI? 0")
 * - Screening checklists (PDHA, concussion screen)
 * - Review sections without actual diagnosis
 * 
 * AND ARE triggered by:
 * - Actual diagnosis mentions
 * - Clinical assessment contexts (Assessment: concussion, Diagnosis: TBI)
 * - Documented injury events
 */

import {
  normalizeText,
  scanSTRText
} from '../../backend/engine/strs/strs-engine.js';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    testsPassed++;
  } else {
    console.log(`  ✗ ${message}`);
    testsFailed++;
  }
}

function testSection(name) {
  console.log(`\n${name}`);
  console.log('='.repeat(70));
}

// ============================================================
// Test Suite: TBI False Positive Filtering
// ============================================================
testSection('TBI PRECISION TEST 1: Filter Screening/Questionnaire Mentions');

// Scenario 1: PDHA questionnaire with NO TBI
const pdhaNoTBI = `
POST DEPLOYMENT HEALTH ASSESSMENT
Date: 01/15/2023

History of mTBI/Concussive occurrences? 0
Number of head injuries? 0

Screening: No documented TBI or concussion events.
`;

const result1 = scanSTRText(normalizeText(pdhaNoTBI));

assert(
  result1.Extracted.Injuries.filter(i => /TBI|traumatic brain|concussion/i.test(i.label)).length === 0,
  'Does NOT extract TBI from "0 occurrences" questionnaire'
);

// Scenario 2: TBI screening checklist - negative
const screeningNegative = `
CONCUSSION SCREENING CHECKLIST
Veteran Name: [REDACTED]
Date: 03/10/2023

TBI Screen: Negative
Number of mTBI? 0
Concussion questionnaire: No events reported
`;

const result2 = scanSTRText(normalizeText(screeningNegative));

assert(
  result2.Extracted.Injuries.filter(i => /TBI|traumatic brain|concussion/i.test(i.label)).length === 0,
  'Does NOT extract TBI from negative screening checklist'
);

// Scenario 3: Generic review mentioning "head" but no trauma
const genericReview = `
MEDICAL HISTORY REVIEW
Date: 06/20/2023

Review of systems:
- Head: No complaints, no headaches
- Eyes: Vision normal
- Ears: Hearing intact
- Cardiovascular: No chest pain
`;

const result3 = scanSTRText(normalizeText(genericReview));

assert(
  result3.Extracted.Injuries.filter(i => i.category === 'head').length === 0,
  'Does NOT extract head injury from generic review of systems'
);

// ============================================================
// Test Suite: TBI True Positive Detection
// ============================================================
testSection('TBI PRECISION TEST 2: Detect Actual Diagnoses & Injuries');

// Scenario 4: Actual TBI diagnosis
const actualTBI = `
CLINICAL ENCOUNTER
Date: 01/25/2023
Chief Complaint: Persistent headaches since deployment

History: Patient sustained blast injury during IED explosion in theater.
Loss of consciousness reported for approximately 2 minutes.

Assessment: Traumatic Brain Injury, mild (mTBI)
Diagnosis: Post-concussive syndrome

Plan: Neurology referral, cognitive screening, TBI clinic evaluation.
`;

const result4 = scanSTRText(normalizeText(actualTBI));

assert(
  result4.Extracted.Injuries.filter(i => /TBI|traumatic brain/i.test(i.label)).length > 0,
  'DOES extract TBI from actual clinical diagnosis'
);

assert(
  result4.Extracted.Injuries.some(i => i.label === 'Traumatic Brain Injury' && i.firstOccurrence.context.includes('Assessment')),
  'TBI extraction includes clinical assessment context'
);

// Scenario 5: Concussion documented as injury
const concussionInjury = `
SPORTS MEDICINE CLINIC NOTE
Date: 04/10/2023

Injury: Concussion sustained during PT session

Exam: Patient with headache, dizziness, photophobia.
Diagnosis: Concussion (minor head trauma)
Plan: No PT for 2 weeks, return to play protocol
`;

const result5 = scanSTRText(normalizeText(concussionInjury));

assert(
  result5.Extracted.Injuries.filter(i => /concussion/i.test(i.label)).length > 0,
  'DOES extract concussion from injury documentation'
);

// Scenario 6: Head trauma event
const headTrauma = `
EMERGENCY DEPARTMENT NOTE
Date: 07/15/2023

Chief Complaint: Head trauma

History: Patient struck head on low-hanging beam during training.
Brief loss of consciousness witnessed by squad leader.

Impression: Closed head injury, concussion
Plan: CT scan, neurology consult, TBI protocol
`;

const result6 = scanSTRText(normalizeText(headTrauma));

assert(
  result6.Extracted.Injuries.filter(i => i.category === 'head' && /trauma|injury|concuss/i.test(i.label)).length > 0,
  'DOES extract head injury from trauma event with LOC'
);

// ============================================================
// Test Suite: Mixed Context (Screening + Diagnosis)
// ============================================================
testSection('TBI PRECISION TEST 3: Mixed Context - Screening AND Diagnosis');

// Scenario 7: PDHA with both screening (negative) and separate diagnosis
const mixedContext = `
POST DEPLOYMENT HEALTH ASSESSMENT
Date: 09/01/2023

TBI Screening:
Number of mTBI? 0
Concussion questionnaire: Negative

---

ACTIVE PROBLEMS:
1. Chronic low back pain
2. Tinnitus
3. Traumatic Brain Injury (diagnosed 2022, service-connected)
   - Residual headaches and cognitive difficulties
   - TBI clinic follow-up scheduled
`;

const result7 = scanSTRText(normalizeText(mixedContext));

// Should find ONLY the actual diagnosis, NOT the screening mention
const tbiMatches = result7.Extracted.Injuries.filter(i => /TBI|traumatic brain/i.test(i.label));

assert(
  tbiMatches.length > 0,
  'DOES extract actual TBI diagnosis even when screening is also present'
);

assert(
  tbiMatches.every(m => 
    !m.firstOccurrence.context.includes('Number of mTBI? 0') &&
    !m.firstOccurrence.context.includes('Concussion questionnaire: Negative')
  ),
  'TBI extraction avoids screening context and uses diagnosis context'
);

// ============================================================
// Test Summary
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('TBI PRECISION TEST SUMMARY');
console.log('='.repeat(70));
console.log(`Total Assertions: ${testsPassed + testsFailed}`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log(`Status: ${testsFailed === 0 ? '✓ ALL TBI PRECISION TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
console.log('='.repeat(70));

console.log('\nKey Improvements:');
console.log('  ✓ Filter screening/questionnaire mentions ("0 occurrences")');
console.log('  ✓ Reject TBI screening checklists without diagnosis');
console.log('  ✓ Reject generic "head" review-of-systems mentions');
console.log('  ✓ Detect actual clinical diagnoses (Assessment: TBI)');
console.log('  ✓ Detect documented injury events (concussion, head trauma)');
console.log('  ✓ Handle mixed contexts (screening + diagnosis)');

process.exit(testsFailed === 0 ? 0 : 1);
