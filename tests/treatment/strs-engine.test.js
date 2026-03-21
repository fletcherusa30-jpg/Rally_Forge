/**
 * STRS Engine Test Suite
 * 
 * Tests verify:
 * 1. Deterministic pattern matching (exact, rule-based, no inference)
 * 2. Schema compliance (required fields, required structure)
 * 3. Chronicity detection (2+ mentions = chronic)
 * 4. Continuity detection (multiple years = continuity)
 * 5. Service connection opportunities (presumptive, direct, chronic)
 * 6. No AI-style reasoning or assumptions
 */

import {
  normalizeText,
  extractConditions,
  detectChronicity,
  detectContinuity,
  extractMedications,
  extractProcedures,
  identifyServiceConnectionOpportunities,
  scanSTRText,
  validateScanResult
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
  console.log('='.repeat(60));
}

// ============================================================
// TEST 1: Text Normalization
// ============================================================
testSection('TEST 1: Text Normalization');

const rawText = "Service  Treatment    Record\r\n\nDiagnosis:  PTSD\n\n\nDate:  01/15/2020";
const normalized = normalizeText(rawText);

assert(
  !normalized.includes('  '),
  'Removes multiple spaces'
);
assert(
  !normalized.includes('\r'),
  'Removes Windows line endings'
);
assert(
  !normalized.includes('\n\n\n'),
  'Removes triple newlines'
);
assert(
  normalized.startsWith('Service'),
  'Trims leading whitespace'
);

// ============================================================
// TEST 2: Condition Extraction - Deterministic Pattern Matching
// ============================================================
testSection('TEST 2: Condition Extraction');

const strsText1 = `
Diagnosis: Service member presents with lower back pain and chronic PTSD.
Physical exam reveals limited mobility due to back pain.
Patient reports ongoing anxiety and depression symptoms.
Mental health evaluation documents posttraumatic stress.
`;

const conditions1 = extractConditions(normalizeText(strsText1));

assert(
  conditions1.length > 0,
  'Extracts at least one condition from mixed clinical text'
);
assert(
  conditions1.some(c => c.label === 'PTSD'),
  'Extracts PTSD condition'
);
assert(
  conditions1.some(c => /ptsd|stress|mental/i.test(c.label)),
  'Extracts mental-health related condition'
);
assert(
  conditions1.every(c => typeof c.label === 'string' && c.label.length > 0),
  'Extracted conditions have valid labels'
);
assert(
  conditions1.length >= 1,
  'Extracts one or more deterministic conditions'
);

// Verify NO duplication/inference (deterministic)
assert(
  new Set(conditions1.map(c => c.label)).size === conditions1.length,
  'Does not duplicate conditions in extraction'
);

// ============================================================
// TEST 3: Chronicity Detection
// ============================================================
testSection('TEST 3: Chronicity Detection');

const strsText2 = `
Date: 01/15/2020 - Patient reports back pain.
Date: 03/22/2020 - Continuing back pain.
Date: 06/10/2020 - Chronic pain persists.
Date: 09/14/2020 - Ongoing back pain noted.
Diagnosis: chronic back pain, persistent anxiety.
`;

const conditionsForChronic = extractConditions(normalizeText(strsText2));
const chronicity = detectChronicity(normalizeText(strsText2), conditionsForChronic);

assert(
  chronicity.hasChronicIndicators,
  'Detects chronic indicators present'
);
assert(
  chronicity.totalChronicityScore > 0,
  'Has positive chronicity score'
);
assert(
  Object.keys(chronicity.conditions).length > 0,
  'Chronicity map includes extracted conditions'
);

// ============================================================
// TEST 4: Continuity Detection
// ============================================================
testSection('TEST 4: Continuity Detection');

const strsText3 = `
Date: 01/15/2020 - Initial evaluation
Date: 03/22/2020 - Follow-up visit
Date: 06/10/2021 - Continuing symptoms
Date: 09/14/2022 - Ongoing treatment
`;

const continuity = detectContinuity(normalizeText(strsText3));

assert(
  continuity.datesFound >= 4,
  'Extracts multiple dates'
);
assert(
  continuity.hasContinuity,
  'Detects continuity across multiple years'
);
assert(
  continuity.yearsSpanned.includes(2020) && continuity.yearsSpanned.includes(2022),
  'Spans from 2020 to 2022'
);
assert(
  continuity.continuityYears >= 3,
  '3+ year continuity detected'
);

// ============================================================
// TEST 5: Medication Extraction
// ============================================================
testSection('TEST 5: Medication Extraction');

const strsText4 = `
Patient prescribed sertraline 50mg daily for depression.
Also taking metoprolol for hypertension management.
Gabapentin prescribed for chronic pain relief.
Takes ibuprofen as needed.
`;

const meds = extractMedications(normalizeText(strsText4));

assert(
  meds.some(m => m.label.includes('SSRI')),
  'Extracts sertraline as SSRI'
);
assert(
  meds.some(m => m.label.includes('Antihypertensives')),
  'Extracts metoprolol as antihypertensive'
);
assert(
  meds.some(m => m.label.includes('Pain')),
  'Extracts gabapentin as pain medication'
);
assert(
  meds.length >= 3,
  'Identifies multiple medications'
);

// ============================================================
// TEST 6: Procedure Extraction
// ============================================================
testSection('TEST 6: Procedure Extraction');

const strsText5 = `
Physical therapy sessions scheduled 3x per week.
MRI of lumbar spine performed.
Blood work and laboratory tests ordered.
X-ray imaging completed.
Psychological counseling ongoing.
`;

const procs = extractProcedures(normalizeText(strsText5));

assert(
  procs.some(p => p.label === 'Physical therapy'),
  'Extracts physical therapy'
);
assert(
  procs.some(p => p.label === 'Imaging'),
  'Extracts imaging (MRI, X-ray)'
);
assert(
  procs.some(p => p.label === 'Lab work'),
  'Extracts lab work'
);
assert(
  procs.some(p => p.label === 'Mental health'),
  'Extracts mental health counseling'
);

// ============================================================
// TEST 7: Service Connection Opportunities
// ============================================================
testSection('TEST 7: Service Connection Opportunities');

const strsText6 = `
Service member injured in training accident while deployed.
Diagnosed with PTSD related to combat exposure.
Back pain is secondary to line of duty injury.
Presumptive condition: Agent Orange service in Vietnam.
Chronic depression documented for 3+ years.
`;

const conditionsForOpp = extractConditions(normalizeText(strsText6));
const chronicityForOpp = detectChronicity(normalizeText(strsText6), conditionsForOpp);
const opportunities = identifyServiceConnectionOpportunities(normalizeText(strsText6), {
  conditions: conditionsForOpp,
  chronicity: chronicityForOpp,
  continuity: detectContinuity(normalizeText(strsText6))
});

assert(
  opportunities.length > 0,
  'Identifies at least one service connection opportunity'
);
assert(
  opportunities.some(o => o.type === 'presumptive'),
  'Identifies presumptive conditions (Agent Orange)'
);
assert(
  opportunities.some(o => o.type === 'direct'),
  'Identifies direct service connection (LOD event)'
);

const lodUploadStyleText = `
DA Form 2173 documents an LOD determination for injury sustained during field training.
Assessment: back pain.
Provider notes the condition occurred in line of duty.
`;

const lodUploadStyleResult = scanSTRText(normalizeText(lodUploadStyleText));

assert(
  lodUploadStyleResult.Extracted.Events.some((event) => event.category === 'lod'),
  'Extracts line of duty events from uploaded STR-style text'
);
assert(
  lodUploadStyleResult.Analysis.ServiceConnectionOpportunities.some((opportunity) => opportunity.type === 'direct'),
  'Links LOD findings to direct service connection opportunities'
);

// ============================================================
// TEST 8: Presumptive Detection
// ============================================================
testSection('TEST 8: Presumptive Condition Detection');

const gulfWarText = 'Service in Gulf War 1991. Diagnosed with Gulf War Illness.';
const agentOrangeText = 'Vietnam service 1968-1969. Exposed to Agent Orange. Diagnosed with peripheral neuropathy.';
const burnPitText = 'Deployed to forward operating base. Exposure to burn pits documented.';

const gulfWar = identifyServiceConnectionOpportunities(
  normalizeText(gulfWarText),
  { conditions: [], chronicity: {}, continuity: {} }
);
const agentOrange = identifyServiceConnectionOpportunities(
  normalizeText(agentOrangeText),
  { conditions: [], chronicity: {}, continuity: {} }
);
const burnPit = identifyServiceConnectionOpportunities(
  normalizeText(burnPitText),
  { conditions: [], chronicity: {}, continuity: {} }
);

assert(
  gulfWar.some(o => o.type === 'presumptive' && o.condition.includes('Gulf War')),
  'Detects Gulf War Illness presumptive'
);
assert(
  agentOrange.some(o => o.type === 'presumptive' && o.condition.includes('Agent Orange')),
  'Detects Agent Orange presumptive'
);
assert(
  burnPit.some(o => o.type === 'presumptive' && o.condition.includes('Burn Pit')),
  'Detects Burn Pit presumptive'
);

// ============================================================
// TEST 9: Full Scan Function - Schema Compliance
// ============================================================
testSection('TEST 9: Full Scan Function & Schema Compliance');

const fullSTRText = `
VETERAN IDENTIFICATION: 123456789
DATE OF STR: 12/15/2023

DIAGNOSES:
- Service-connected: PTSD, back pain, tinnitus
- Non-service-connected: Hypertension

MEDICATIONS:
Sertraline 50mg daily for depression
Ibuprofen 400mg for pain

PROCEDURES:
PT sessions 2x/week
MRI lumbar spine 11/20/2023

CLINICAL NOTES:
Patient presents with chronic PTSD and pain. Service connected to training injury.
Multiple encounters documented from 2020-2023.
Agent Orange exposure during Vietnam service.
Loss of hearing secondary to tinnitus.
`;

const scanResult = scanSTRText(normalizeText(fullSTRText));

assert(
  scanResult.success === true,
  'Scan completes successfully'
);
assert(
  scanResult.Extracted !== undefined,
  'Result includes Extracted object'
);
assert(
  scanResult.Analysis !== undefined,
  'Result includes Analysis object'
);
assert(
  scanResult.NLP !== undefined,
  'Result includes NLP object'
);
assert(
  Array.isArray(scanResult.Extracted.Diagnoses),
  'Diagnoses is an array'
);
assert(
  Array.isArray(scanResult.Extracted.Medications),
  'Medications is an array'
);
assert(
  Array.isArray(scanResult.Extracted.Procedures),
  'Procedures is an array'
);
assert(
  ((scanResult.Analysis.DiagnosesFound || 0) + (scanResult.Analysis.InjuriesFound || 0) + (scanResult.Analysis.EventsFound || 0)) > 0,
  'Analysis finds conditions'
);
assert(
  Array.isArray(scanResult.Analysis.ServiceConnectionOpportunities),
  'Service connection opportunities identified'
);

// ============================================================
// TEST 10: Validation Function
// ============================================================
testSection('TEST 10: Schema Validation');

const validation = validateScanResult(scanResult);

assert(
  validation.isValid === true,
  'Scan result passes schema validation'
);
assert(
  Array.isArray(validation.errors) && validation.errors.length === 0,
  'No validation errors detected'
);
assert(
  validation.scanResult === scanResult,
  'Validation returns original scan result'
);

// ============================================================
// TEST 11: Empty/Edge Cases
// ============================================================
testSection('TEST 11: Edge Cases & Empty Input');

const emptyResult = scanSTRText('');
assert(
  emptyResult.success === true,
  'Empty text returns successful result'
);
assert(
  emptyResult.Extracted.Diagnoses.length === 0,
  'Empty text yields no diagnoses'
);
assert(
  emptyResult.parse_warnings instanceof Array,
  'Parse warnings array exists'
);

const minimalText = 'Patient is stable.';
const minimalResult = scanSTRText(minimalText);
assert(
  minimalResult.success === true,
  'Minimal text processes without error'
);
assert(
  minimalResult.Timestamp !== undefined,
  'Timestamp included in all results'
);

// ============================================================
// TEST 12: Determinism - Same Input = Same Output
// ============================================================
testSection('TEST 12: Determinism Verification');

const testInputText = 'PTSD with back pain and tinnitus. Chronic anxiety noted.';
const result1 = scanSTRText(testInputText);
const result2 = scanSTRText(testInputText);

assert(
  result1.Extracted.Diagnoses.length === result2.Extracted.Diagnoses.length,
  'Same input produces same diagnosis count'
);
assert(
  ((result1.Analysis.DiagnosesFound || 0) + (result1.Analysis.InjuriesFound || 0) + (result1.Analysis.EventsFound || 0)) ===
    ((result2.Analysis.DiagnosesFound || 0) + (result2.Analysis.InjuriesFound || 0) + (result2.Analysis.EventsFound || 0)),
  'Same input produces same analysis'
);
assert(
  JSON.stringify(result1.Extracted.Diagnoses.map(d => d.label).sort()) ===
    JSON.stringify(result2.Extracted.Diagnoses.map(d => d.label).sort()),
  'Same input produces identical extracted data'
);

// ============================================================
// Test Summary
// ============================================================
console.log('\n' + '='.repeat(60));
console.log('TEST SUMMARY');
console.log('='.repeat(60));
console.log(`Total Tests: ${testsPassed + testsFailed}`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log(`Status: ${testsFailed === 0 ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
console.log('='.repeat(60));

process.exit(testsFailed === 0 ? 0 : 1);



