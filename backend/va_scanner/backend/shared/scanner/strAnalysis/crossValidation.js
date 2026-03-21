/**
 * crossValidation.js — Rally Forge STR Scanner v3.1
 *
 * Cross-record consistency and pattern detection engine.
 * Validates relationships between extracted STR elements and detects
 * recurring patterns, evolving diagnoses, and internal inconsistencies.
 *
 * SAFETY NOTICE: Output is for human review only. No medical conclusions.
 */

// ── Recurring Symptom / Condition Detection ────────────────────────────────

export function detectRecurringPatterns(strAnalysis) {
  return strAnalysis.conditionPatterns
    .filter(p => p.numberOfMentions >= 3 || p.hasChronicityIndicator)
    .map(p => ({
      type: 'recurringPattern',
      conditionName: p.conditionName,
      numberOfMentions: p.numberOfMentions,
      firstMentionDate: p.firstMentionDate,
      lastMentionDate: p.lastMentionDate,
      hasChronicityIndicator: p.hasChronicityIndicator,
      patternSummary: p.patternSummary,
      note: 'Recurring pattern detected across STR records. Human review required.',
    }));
}

// ── Medications Without Linked Diagnoses ──────────────────────────────────────

export function detectMedicationsWithoutDiagnoses(strAnalysis) {
  const diagnosisNames = (strAnalysis.diagnoses || []).map(d => d.diagnosisName?.toLowerCase() || '');
  const flags = [];

  for (const med of strAnalysis.medications || []) {
    const medName = (med.medicationName || '').toLowerCase();
    // Try to find a diagnosis that might correspond to this medication
    const hasLinkedDx = diagnosisNames.some(dx => dx && (
      medName.includes(dx.split(' ')[0]) || (_KNOWN_MED_INDICATION_MAP[medName] &&
        diagnosisNames.some(dx2 => dx2.includes(_KNOWN_MED_INDICATION_MAP[medName])))
    ));

    if (!hasLinkedDx) {
      flags.push({
        type: 'medicationWithoutLinkedDiagnosis',
        medicationName: med.medicationName,
        date: med.date,
        rawText: med.rawText,
        note: 'Medication present without apparent linked diagnosis in extracted data. Human review required.',
      });
    }
  }

  return flags;
}

const _KNOWN_MED_INDICATION_MAP = {
  sertraline: 'depression',
  fluoxetine: 'depression',
  paroxetine: 'depression',
  gabapentin: 'pain',
  pregabalin: 'pain',
  tramadol: 'pain',
  ibuprofen: 'pain',
  naproxen: 'pain',
  prazosin: 'ptsd',
  albuterol: 'asthma',
  omeprazole: 'gerd',
  metformin: 'diabetes',
};

// ── Tests Without Linked Conditions ──────────────────────────────────────────

export function detectTestsWithoutLinkedConditions(strAnalysis) {
  const flags = [];
  for (const test of strAnalysis.testsAndResults || []) {
    if (!test.relatedCondition && !test.findingsSummary) {
      flags.push({
        type: 'testWithoutLinkedCondition',
        testType: test.testType,
        date: test.date,
        rawText: test.rawText,
        note: 'Test result with no linked condition or findings summary detected. Human review required.',
      });
    }
  }
  return flags;
}

// ── Treatments Without Diagnoses ──────────────────────────────────────────────

export function detectFunctionalImpactWithoutLinkedConditions(strAnalysis) {
  const flags = [];
  for (const impact of strAnalysis.functionalImpactStatements || []) {
    if (!impact.relatedCondition) {
      flags.push({
        type: 'functionalImpactWithoutLinkedCondition',
        description: impact.functionalImpactDescription,
        date: impact.date,
        note: 'Functional impact statement without linked condition. Human review required.',
      });
    }
  }
  return flags;
}

// ── Deployment Gap Detection ─────────────────────────────────────────────────

/**
 * Flags long gaps in treatment records (> 12 months without entries) when
 * context suggests ongoing conditions.
 */
export function detectTreatmentGaps(strAnalysis) {
  const gaps = [];

  const allDated = [
    ...((strAnalysis.events || []).filter(e => e.date)),
    ...((strAnalysis.symptoms || []).filter(s => s.date)),
    ...((strAnalysis.diagnoses || []).filter(d => d.date)),
  ].sort((a, b) => (a.date < b.date ? -1 : 1));

  if (allDated.length < 2) return gaps;

  for (let i = 1; i < allDated.length; i++) {
    const prev = new Date(allDated[i - 1].date);
    const curr = new Date(allDated[i].date);
    const monthsGap = (curr - prev) / (1000 * 60 * 60 * 24 * 30);

    if (monthsGap > 12) {
      gaps.push({
        type: 'treatmentGap',
        fromDate: allDated[i - 1].date,
        toDate: allDated[i].date,
        approximateMonths: Math.round(monthsGap),
        note: `Gap of ~${Math.round(monthsGap)} months detected in treatment records. Human review required.`,
      });
    }
  }

  return gaps;
}

// ── Main: Run All Cross-Validation Checks ─────────────────────────────────────

export function runCrossValidation(strAnalysis) {
  return {
    recurringPatterns: detectRecurringPatterns(strAnalysis),
    medicationsWithoutDiagnoses: detectMedicationsWithoutDiagnoses(strAnalysis),
    testsWithoutLinkedConditions: detectTestsWithoutLinkedConditions(strAnalysis),
    functionalImpactWithoutLinkedConditions: detectFunctionalImpactWithoutLinkedConditions(strAnalysis),
    treatmentGaps: detectTreatmentGaps(strAnalysis),
  };
}
