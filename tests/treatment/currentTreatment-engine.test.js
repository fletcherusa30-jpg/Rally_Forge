/**
 * Current Treatment Engine Test Suite
 *
 * Tests verify:
 * 1. Schema compliance (required arrays, extractionMeta)
 * 2. Deterministic extraction of all 8 data categories
 * 3. Timeline and crossValidation structure
 * 4. Empty-text edge case — safe empty result
 * 5. No inference or AI-style diagnosis generation
 */

import { scanCurrentTreatmentDeterministic } from '../../backend/va_scanner/backend/shared/scanner/currentTreatmentScanner.js';

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
  console.log('='.repeat(60));
}

// ============================================================
// TEST 1: Schema Compliance — Required Array Fields
// ============================================================
testSection('TEST 1: Schema Compliance — Required Array Fields');

const minimalText = 'Diagnosis: lower back pain. Patient seen on 2024-01-15.';
const r1 = scanCurrentTreatmentDeterministic(minimalText);

assert(typeof r1 === 'object' && r1 !== null, 'Returns an object');
assert(r1.documentType === 'CurrentTreatmentDocument', 'documentType is CurrentTreatmentDocument');
assert(typeof r1.schemaVersion === 'string' && r1.schemaVersion.length > 0, 'schemaVersion is present');
assert(Array.isArray(r1.currentConditions), 'currentConditions is an array');
assert(Array.isArray(r1.worseningConditions), 'worseningConditions is an array');
assert(Array.isArray(r1.functionalLimitations), 'functionalLimitations is an array');
assert(Array.isArray(r1.medications), 'medications is an array');
assert(Array.isArray(r1.treatments), 'treatments is an array');
assert(Array.isArray(r1.providers), 'providers is an array');
assert(Array.isArray(r1.testsAndResults), 'testsAndResults is an array');
assert(Array.isArray(r1.appointments), 'appointments is an array');
assert(typeof r1.extractionMeta === 'object' && r1.extractionMeta !== null, 'extractionMeta is an object');
assert(typeof r1.extractionMeta.confidence === 'number', 'extractionMeta.confidence is a number');
assert(Number.isInteger(r1.extractionMeta.fieldsPopulated), 'extractionMeta.fieldsPopulated is an integer');
assert(Number.isInteger(r1.extractionMeta.fieldsTotal), 'extractionMeta.fieldsTotal is an integer');
assert(r1.extractionMeta.schemaValid === true, 'extractionMeta.schemaValid is true');

// ============================================================
// TEST 2: Current Conditions Extraction
// ============================================================
testSection('TEST 2: Current Conditions Extraction');

const conditionsText = `
Assessment: PTSD with hypervigilance and nightmares.
Diagnosis: chronic lower back pain, lumbar radiculopathy.
Impression: tinnitus, bilateral, service-connected.
`;

const r2 = scanCurrentTreatmentDeterministic(conditionsText);

assert(r2.currentConditions.length > 0, 'Extracts at least one current condition');
assert(
  r2.currentConditions.every((c) => typeof c.value === 'string' && c.value.length > 0),
  'All conditions have a non-empty value string',
);
assert(
  r2.currentConditions.every((c) => 'lineNumber' in c),
  'All conditions include lineNumber',
);

// ============================================================
// TEST 3: Worsening Conditions Extraction
// ============================================================
testSection('TEST 3: Worsening Conditions Extraction');

const worseningText = `
Pain has worsened significantly over the last 6 months.
Patient reports increased pain with activity.
Condition is progressing despite treatment.
`;

const r3 = scanCurrentTreatmentDeterministic(worseningText);

assert(r3.worseningConditions.length > 0, 'Extracts at least one worsening indicator');
assert(
  r3.worseningConditions.every((c) => typeof c.value === 'string'),
  'All worsening entries have a value string',
);

// ============================================================
// TEST 4: Functional Limitations Extraction
// ============================================================
testSection('TEST 4: Functional Limitations Extraction');

const functionalText = `
Patient is unable to walk more than one block without pain.
Difficulty standing for more than 10 minutes.
Limited range of motion in right shoulder.
Cannot lift objects over 10 pounds.
`;

const r4 = scanCurrentTreatmentDeterministic(functionalText);

assert(r4.functionalLimitations.length > 0, 'Extracts at least one functional limitation');
assert(
  r4.functionalLimitations.every((c) => typeof c.value === 'string'),
  'All functional limitations have a value string',
);

// ============================================================
// TEST 5: Medications Extraction
// ============================================================
testSection('TEST 5: Medications Extraction');

const medicationsText = `
Medication: Sertraline 50mg daily for PTSD.
Prescribed ibuprofen 600mg as needed for back pain.
Continue on gabapentin 300mg three times daily.
`;

const r5 = scanCurrentTreatmentDeterministic(medicationsText);

assert(r5.medications.length > 0, 'Extracts at least one medication');
assert(
  r5.medications.every((c) => typeof c.value === 'string' && c.value.length > 0),
  'All medications have a non-empty value',
);

// ============================================================
// TEST 6: Treatments And Provider Extraction
// ============================================================
testSection('TEST 6: Treatments and Provider Extraction');

const providerText = `
Patient referred to physical therapy for lumbar rehabilitation.
Follow-up with Dr. Smith at VA orthopedic clinic in 6 weeks.
Counseling sessions weekly with PTSD specialist.
Provider: Dr. Johnson, Primary Care, VA Medical Center.
`;

const r6 = scanCurrentTreatmentDeterministic(providerText);

assert(r6.treatments.length > 0, 'Extracts at least one treatment');
assert(r6.providers.length > 0, 'Extracts at least one provider');
assert(r6.appointments.length > 0, 'Extracts at least one appointment');

// ============================================================
// TEST 7: Tests And Results Extraction
// ============================================================
testSection('TEST 7: Tests and Results Extraction');

const testsText = `
MRI lumbar spine ordered — results pending.
X-ray right knee completed 2024-02-10, shows mild degenerative changes.
Lab work including CBC and metabolic panel ordered.
EMG of upper extremities performed.
`;

const r7 = scanCurrentTreatmentDeterministic(testsText);

assert(r7.testsAndResults.length > 0, 'Extracts at least one test/result');

// ============================================================
// TEST 8: currentTreatmentAnalysis Structure
// ============================================================
testSection('TEST 8: currentTreatmentAnalysis Structure');

const analysisText = `
Diagnosis: PTSD. Medication: Sertraline.
Follow-up appointment scheduled in 3 months.
Pain has worsened. Unable to stand for long periods.
`;

const r8 = scanCurrentTreatmentDeterministic(analysisText);
const analysis = r8.currentTreatmentAnalysis;

assert(analysis !== null && typeof analysis === 'object', 'currentTreatmentAnalysis is an object');
assert(typeof analysis.timeline === 'object' && analysis.timeline !== null, 'timeline is present');
assert(typeof analysis.crossValidation === 'object' && analysis.crossValidation !== null, 'crossValidation is present');
assert(Array.isArray(analysis.crossValidation?.medicationWithoutCondition), 'crossValidation.medicationWithoutCondition is array');
assert(Array.isArray(analysis.crossValidation?.treatmentWithoutCondition), 'crossValidation.treatmentWithoutCondition is array');
assert(Array.isArray(analysis.crossValidation?.followUpGaps), 'crossValidation.followUpGaps is array');

// ============================================================
// TEST 9: Empty Text — Safe Empty Result
// ============================================================
testSection('TEST 9: Empty Text — Safe Empty Result');

const r9 = scanCurrentTreatmentDeterministic('');

assert(typeof r9 === 'object', 'Returns object for empty input');
assert(Array.isArray(r9.currentConditions) && r9.currentConditions.length === 0, 'Empty input produces zero currentConditions');
assert(Array.isArray(r9.medications) && r9.medications.length === 0, 'Empty input produces zero medications');
assert(r9.extractionMeta.confidence === 0, 'Empty input has zero confidence');

// ============================================================
// TEST 10: No Inference — Only Explicit Text Is Extracted
// ============================================================
testSection('TEST 10: No Inference — Only Explicit Text Extracted');

const noMedText = 'Patient presents today for evaluation. General health is fair.';
const r10 = scanCurrentTreatmentDeterministic(noMedText);

assert(r10.medications.length === 0, 'No medications extracted when none mentioned');
assert(r10.worseningConditions.length === 0, 'No worsening extracted when none mentioned');
assert(r10.functionalLimitations.length === 0, 'No functional limitations extracted when none mentioned');

// ============================================================
// Summary
// ============================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`Current Treatment Engine Tests: ${testsPassed} passed, ${testsFailed} failed`);
console.log('='.repeat(60));

if (testsFailed > 0) {
  process.exit(1);
}
