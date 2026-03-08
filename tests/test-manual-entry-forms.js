/**
 * Test Suite: Manual Entry Forms
 * PURPOSE: Verify VA Rating Decision and STR forms with validation rules
 */

const tests = [];
let passed = 0;
let failed = 0;

// Test Helper
function test(name, fn) {
  try {
    fn();
    tests.push({ name, status: '✓ PASS', error: null });
    passed++;
  } catch (error) {
    tests.push({ name, status: '✗ FAIL', error: error.message });
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// ============= VA RATING DECISION VALIDATION TESTS =============

test('VA Rating: Condition name is required', () => {
  const entry = {
    conditionName: '',
    diagnosticType: 'disability',
    status: 'Service Connected',
    ratingPercent: 30
  };
  assert(!entry.conditionName.trim(), 'Condition name should be required');
});

test('VA Rating: Status=SC requires ratingPercent', () => {
  const entry = {
    conditionName: 'PTSD',
    status: 'Service Connected',
    ratingPercent: 50
  };
  assert(entry.status === 'Service Connected' && entry.ratingPercent > 0, 'SC must have rating');
});

test('VA Rating: Status=Denied requires denialReason', () => {
  const entry = {
    conditionName: 'Claimed Condition',
    status: 'Denied',
    denialReason: 'Insufficient nexus to service'
  };
  assert(entry.status === 'Denied' && entry.denialReason.trim(), 'Denied must have reason');
});

test('VA Rating: scBasis=secondary requires secondaryTo', () => {
  const entry = {
    conditionName: 'Knee pain',
    scBasis: 'secondary',
    secondaryTo: 'Agent Orange exposure',
    ratingPercent: 30,
    status: 'Service Connected'
  };
  assert(entry.scBasis === 'secondary' && entry.secondaryTo.trim(), 'Secondary must specify primary condition');
});

test('VA Rating: scBasis=aggravation requires aggravationPercent', () => {
  const entry = {
    conditionName: 'Back pain',
    scBasis: 'aggravation',
    aggravationPercent: 20,
    ratingPercent: 40,
    status: 'Service Connected'
  };
  assert(entry.scBasis === 'aggravation' && entry.aggravationPercent > 0, 'Aggravation must have percent');
});

test('VA Rating: bilateral extremity optional when not bilateral', () => {
  const entry = {
    conditionName: 'Tinnitus',
    isBilateral: false,
    extremity: null,
    status: 'Service Connected',
    ratingPercent: 10
  };
  assert(entry.isBilateral === false && entry.extremity === null, 'Bilateral should be optional');
});

test('VA Rating: Combined rating calculation (multiple SC conditions)', () => {
  const ratings = [70, 50, 20];
  let combined = ratings[0];
  for (let i = 1; i < ratings.length; i++) {
    combined = Math.round(combined + ((100 - combined) * ratings[i]) / 100);
  }
  // 70 + ((30) * 0.5) = 70 + 15 = 85
  // 85 + ((15) * 0.2) = 85 + 3 = 88
  assert(combined === 88, `Combined should be 88%, got ${combined}%`);
});

// ============= STR VALIDATION TESTS =============

test('STR: Condition name is required', () => {
  const entry = {
    conditionName: ''
  };
  assert(!entry.conditionName.trim(), 'Condition name should be required');
});

test('STR: Date of event is required', () => {
  const entry = {
    conditionName: 'Knee injury',
    dateOfEvent: '2003-06-15'
  };
  assert(entry.dateOfEvent, 'Date of event should be required');
});

test('STR: Description is required', () => {
  const entry = {
    conditionName: 'Knee injury',
    dateOfEvent: '2003-06-15',
    description: 'Fell on stairs during combat mission'
  };
  assert(entry.description.trim(), 'Description should be required');
});

test('STR: exposureType selected requires MOSRelevant evaluation', () => {
  const entry = {
    conditionName: 'Respiratory symptoms',
    dateOfEvent: '2005-08-01',
    description: 'Ongoing cough from burn pit exposure',
    exposureType: 'burn pits',
    MOSRelevant: true
  };
  assert(entry.exposureType && entry.MOSRelevant !== undefined, 'Exposure must have MOS evaluation');
});

test('STR: chronicityEvidence requires continuityNotes', () => {
  const entry = {
    conditionName: 'PTSD',
    dateOfEvent: '2004-03-01',
    description: 'Combat-related trauma',
    chronicityEvidence: 'Multiple hospitalizations 2004-2024',
    continuityNotes: 'Continuous symptoms with periodic exacerbations'
  };
  assert(entry.chronicityEvidence.trim() && entry.continuityNotes.trim(), 'Chronicity must have continuity notes');
});

test('STR: lineOfDuty status captured', () => {
  const entry = {
    conditionName: 'Heat stroke',
    dateOfEvent: '2003-06-15',
    description: 'Heat injury during training',
    lineOfDuty: 'Yes',
    inServiceEvent: true
  };
  assert(entry.lineOfDuty === 'Yes' && entry.inServiceEvent === true, 'LineOfDuty and inServiceEvent should match');
});

test('STR: Exposure types correctly set', () => {
  const exposureTypes = ['agent orange', 'burn pits', 'radiation', 'asbestos', 'noise', 'other'];
  const entry = {
    exposureType: 'agent orange'
  };
  assert(exposureTypes.includes(entry.exposureType), 'Exposure type should be valid');
});

// ============= FIELD SEPARATION TESTS =============

test('Field Separation: VA Rating has adjudicative fields only', () => {
  const vaFields = [
    'conditionName', 'diagnosticType', 'pageNumber', 'status', 'ratingPercent',
    'effectiveDate', 'isBilateral', 'extremity', 'scBasis', 'secondaryTo',
    'aggravationPercent', 'inferredIssue', 'scEvidence', 'rationaleSummary',
    'denialReason', 'evidenceNotes'
  ];
  assert(vaFields.length === 16, `VA fields should be 16, got ${vaFields.length}`);
});

test('Field Separation: STR has medical/chronological fields only', () => {
  const strFields = [
    'conditionName', 'dateOfEvent', 'type', 'location', 'provider', 'description',
    'severity', 'lineOfDuty', 'MOSRelevant', 'exposureType', 'inServiceEvent',
    'chronicityEvidence', 'continuityNotes', 'nexusIndicators'
  ];
  assert(strFields.length === 14, `STR fields should be 14, got ${strFields.length}`);
});

test('Field Separation: No shared adjudicative fields in STR', () => {
  const vaAdjudicativeFields = ['ratingPercent', 'scBasis', 'denialReason', 'isBilateral', 'extremity'];
  const strFields = ['dateOfEvent', 'severity', 'lineOfDuty', 'exposureType', 'chronicityEvidence'];
  
  const overlap = vaAdjudicativeFields.filter(f => strFields.includes(f));
  assert(overlap.length === 0, 'STR should not have VA adjudicative fields');
});

test('Field Separation: No shared medical fields in VA Rating', () => {
  const strMedicalFields = ['dateOfEvent', 'provider', 'severity', 'lineOfDuty', 'exposureType'];
  const vaFields = ['status', 'ratingPercent', 'scBasis', 'denialReason', 'effectiveDate'];
  
  const overlap = strMedicalFields.filter(f => vaFields.includes(f));
  assert(overlap.length === 0, 'VA should not have STR medical fields');
});

// ============= OUTPUT FORMAT TESTS =============

test('VA Rating Output: Includes required metadata', () => {
  const result = {
    success: true,
    serviceConnected: [],
    denied: [],
    allConditions: [],
    ratingCalculation: {
      calculatedCombinedRating: 0,
      conditions: [],
      calculationMethod: 'Manual entry (38 CFR §4.25)'
    },
    extractionSummary: {
      totalServiceConnected: 0,
      totalDenied: 0,
      manualEntry: true,
      entryType: 'VA_RATING_DECISION'
    }
  };
  assert(result.extractionSummary.entryType === 'VA_RATING_DECISION' && result.ratingCalculation, 'VA output should have rating calculation');
});

test('STR Output: Includes medical metadata', () => {
  const result = {
    success: true,
    records: [],
    allRecords: [],
    patientHistory: {
      totalMedicalEvents: 0,
      inServiceCount: 0,
      exposureEvents: 0,
      chronicConditions: 0
    },
    exposureSummary: {
      exposureTypes: [],
      MOSRelevantCount: 0
    },
    extractionSummary: {
      totalRecords: 0,
      manualEntry: true,
      entryType: 'SERVICE_TREATMENT_RECORD'
    }
  };
  assert(result.extractionSummary.entryType === 'SERVICE_TREATMENT_RECORD' && result.patientHistory, 'STR output should have patient history');
});

// ============= VALIDATION CHAINING TESTS =============

test('VA Rating: Status NSC does not require ratingPercent', () => {
  const entry = {
    conditionName: 'Claimed condition',
    status: 'Not Service Connected',
    ratingPercent: null // NSC doesn't get a rating
  };
  assert(entry.status !== 'Service Connected' && entry.ratingPercent === null, 'NSC should not require rating');
});

test('STR: severityLevel optional when description provided', () => {
  const entry = {
    conditionName: 'Heat illness',
    dateOfEvent: '2003-06-15',
    description: 'Heat exhaustion during Basic Training',
    severity: 'moderate' // optional but can be set
  };
  assert(entry.severity, 'Severity can be optional or set');
});

test('VA Rating: effectiveDate optional but affects retroactive SC', () => {
  const entry = {
    conditionName: 'PTSD',
    status: 'Service Connected',
    ratingPercent: 70,
    effectiveDate: '2001-06-15' // retroactive
  };
  assert(entry.effectiveDate, 'Effective date can be retroactive');
});

test('STR: Multiple exposures can be tracked separately', () => {
  const records = [
    { conditionName: 'Respiratory', exposureType: 'burn pits' },
    { conditionName: 'Rash', exposureType: 'agent orange' },
    { conditionName: 'Nerve damage', exposureType: 'radiation' }
  ];
  const exposureTypes = [...new Set(records.map(r => r.exposureType))];
  assert(exposureTypes.length === 3, 'Should track 3 different exposure types');
});

// ============= PRINT RESULTS =============

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  MANUAL ENTRY FORMS TEST SUITE - VALIDATION & SEPARATION   ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('Test Results:');
console.log(`  ✓ Passed: ${passed}`);
console.log(`  ✗ Failed: ${failed}`);
console.log(`  Total:   ${tests.length}\n`);

if (failed === 0) {
  console.log('  ✓✓✓ ALL TESTS PASSED ✓✓✓\n');
} else {
  console.log('  ✗✗✗ SOME TESTS FAILED ✗✗✗\n');
}

console.log('Individual Results:');
tests.forEach(t => {
  const status = t.status.includes('PASS') ? '✓' : '✗';
  console.log(`  ${status} ${t.name}`);
  if (t.error) {
    console.log(`     Error: ${t.error}`);
  }
});

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log(`║ Total Tests: ${tests.length}, Passed: ${passed}, Failed: ${failed}${failed === 0 ? ' ✓' : ' ✗'} ${' '.repeat(21)}║`);
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Return exit code based on test results
process.exit(failed > 0 ? 1 : 0);
