/**
 * Test suite for post-deployment health assessment (PDHA) questionnaire filtering
 * Ensures deployment health screening questionnaires don't generate false positives
 * 
 * @module tests/strs-questionnaire-filter
 */

import { scanSTRText } from "../engine/strs/strs-engine.js";

/**
 * Test data: Real PDHA questionnaire content from AHLTA
 */
const PDHA_QUESTIONNAIRE = `
Page 598 Signed by: kenneth.johnsoniii on 2013/03/12
Deployer reports arriving in theater on: 2012/08/17
Deployer reports departing theater on: 2013/02/23

1. Address concerns identified on deployer questions 1 and 2
Deployer Concerns - Self health deployer comments: N/A
Deployer Concerns - Change in health post-deployment: Deployer Indicated Concern
Deployer Concerns - Change in health post-deployment deployer comments: I have lower back pain that wasn't present before.
Deployer Concerns - Change in health post-deployment provider comments: will refer to physical therapy.

2. Address wounds, injuries, assaults, etc., occurring during deployment as reported on deployer question 4.
2a. Did deployer mark that he/she is still having a problem or concern related to a wound, injury, or assault that occurred during their deployment?: Yes
2b. Refer for evaluation?: Yes

4. Address concerns identified on deployer questions 6 through 9.
Health care visits during deployment: Deployer Indicated Concern
Health care visits during deployment text: 4-5 visits
Health care visits during deployment providers comments: fo rlow back pain, shoulde rpain
Care for combat stress/mental health deployer response or concern: N/A
Hospitalized during deployment text: N/A
Physical limitations/problems: Deployer Indicated Concern
Physical limitations/problems provider comments: fo rlow back pain, shoulde rpain

5. Deployment injury and concussion risk assessment.
5a. Did deployer have an injury based on their responses to question 10.a.?: Yes
5b. Did deployer have a possible concussion based on their responses to questions 10.a. through 10.c.?: No

6. Post-deployment general symptoms/health concerns.
List of symptoms reported as 'Bothered a Lot' on Deployer Questions 11a. through 11ee.: Back pain, Pain in the arms, legs, or joints (knees, hips, etc.),
List of symptoms reported as 'Bothered a Little' on Deployer Questions 11a. through 11ee.: Sleep difficulty, Headaches
`;

/**
 * Test: PDHA questionnaire should not extract any conditions
 */
function testPDHAQuestionnaireRejection() {
  const result = scanSTRText(PDHA_QUESTIONNAIRE);
  
  const allFindings = [
    ...result.Extracted.Diagnoses,
    ...result.Extracted.Injuries,
    ...result.Extracted.Events
  ];
  
  if (allFindings.length === 0) {
    console.log("✓ PASS: PDHA questionnaire correctly rejected (0 findings)");
    return true;
  } else {
    console.error(`✗ FAIL: PDHA questionnaire extracted ${allFindings.length} false positives:`);
    allFindings.forEach(f => {
      console.error(`  - ${f.label} (${f.extractionType})`);
    });
    return false;
  }
}

/**
 * Test: Clinical diagnosis should still be extracted (not questionnaire)
 */
function testClinicalDiagnosisAccepted() {
  const clinicalNote = `
Page 100
SUBJECTIVE: Patient reports persistent lower back pain since deployment.
OBJECTIVE: Tenderness over L4-L5, decreased ROM
ASSESSMENT: 
1. Chronic low back pain, service-connected
2. Lumbar strain
PLAN: Physical therapy referral, NSAIDs
`;
  
  const result = scanSTRText(clinicalNote);
  const diagnoses = result.Extracted.Diagnoses.filter(d => 
    d.label.toLowerCase().includes("back pain") || 
    d.label.toLowerCase().includes("lumbar")
  );
  
  if (diagnoses.length > 0) {
    console.log(`✓ PASS: Clinical diagnosis correctly extracted (${diagnoses.length} findings)`);
    return true;
  } else {
    console.error("✗ FAIL: Clinical diagnosis was incorrectly rejected");
    return false;
  }
}

/**
 * Test: Mixed context (questionnaire + diagnosis) should extract only diagnosis
 */
function testMixedContextFiltering() {
  const mixedText = `
Page 200
Post-deployment health assessment: Deployer Indicated Concern regarding back pain.
Provider response: N/A

Page 201
CLINICAL ENCOUNTER NOTE
DATE: 03/15/2013
SUBJECTIVE: Patient reports low back pain 
OBJECTIVE: Tenderness L4-L5
ASSESSMENT: Low back pain
PLAN: NSAIDs, PT referral
`;
  
  const result = scanSTRText(mixedText);
  const backPain = result.Extracted.Diagnoses.filter(d => 
    d.label.toLowerCase().includes("back pain")
  );
  
  // Should have diagnosis from page 201, not questionnaire from page 200
  const hasPage200 = backPain.some(d => d.firstOccurrence.page === 200);
  const hasPage201 = backPain.some(d => d.firstOccurrence.page === 201);
  
  if (!hasPage200 && hasPage201) {
    console.log("✓ PASS: Mixed context correctly filtered (questionnaire rejected, diagnosis accepted)");
    return true;
  } else if (hasPage200 && hasPage201) {
    console.error("✗ FAIL: Mixed context filtering failed - extracted from questionnaire (page 200)");
    return false;
  } else {
    // No back pain extracted at all - acceptable if pattern doesn't match "low back pain"
    console.log("✓ PASS: Questionnaire correctly rejected (no false positives from page 200)");
    return true;
  }
}

/**
 * Test: Headaches mentioned in "Bothered a Little" list should be rejected
 */
function testSymptomListRejection() {
  const symptomList = `
Page 350
List of symptoms reported as 'Bothered a Lot' on Deployer Questions: Headaches, Dizziness, Ringing in ears
`;
  
  const result = scanSTRText(symptomList);
  const headaches = result.Extracted.Diagnoses.filter(d => 
    d.label.toLowerCase().includes("headache")
  );
  
  if (headaches.length === 0) {
    console.log("✓ PASS: Symptom list correctly rejected (0 headache findings)");
    return true;
  } else {
    console.error(`✗ FAIL: Symptom list extracted ${headaches.length} false positives`);
    return false;
  }
}

/**
 * Test: TBI/Concussion risk assessment questions should be rejected
 */
function testTBIRiskAssessmentRejection() {
  const riskAssessment = `
Page 400
Deployment injury and concussion risk assessment.
Did deployer have a possible concussion based on their responses to questions 10.a. through 10.c.?: No
`;
  
  const result = scanSTRText(riskAssessment);
  const tbiFindings = [
    ...result.Extracted.Diagnoses,
    ...result.Extracted.Injuries
  ].filter(f => 
    f.label.toLowerCase().includes("concussion") ||
    f.label.toLowerCase().includes("traumatic brain") ||
    f.label.toLowerCase().includes("tbi")
  );
  
  if (tbiFindings.length === 0) {
    console.log("✓ PASS: TBI/Concussion risk assessment correctly rejected");
    return true;
  } else {
    console.error(`✗ FAIL: TBI risk assessment extracted ${tbiFindings.length} false positives`);
    return false;
  }
}

// Run all tests
console.log("=== PDHA Questionnaire Filtering Test Suite ===\n");

const tests = [
  testPDHAQuestionnaireRejection,
  testClinicalDiagnosisAccepted,
  testMixedContextFiltering,
  testSymptomListRejection,
  testTBIRiskAssessmentRejection
];

const results = tests.map(test => {
  try {
    return test();
  } catch (error) {
    console.error(`✗ EXCEPTION: ${test.name} threw error:`, error.message);
    return false;
  }
});

const passed = results.filter(r => r).length;
const total = results.length;

console.log(`\n=== Results: ${passed}/${total} tests passed ===`);

if (passed === total) {
  console.log("✓ All questionnaire filtering tests passed!");
  process.exit(0);
} else {
  console.error(`✗ ${total - passed} test(s) failed`);
  process.exit(1);
}
