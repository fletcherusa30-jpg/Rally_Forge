function normalizeBooleanPair(input) {
  if (input && typeof input === 'object') {
    return {
      left: Boolean(input.left),
      right: Boolean(input.right),
    };
  }

  return { left: false, right: false };
}

export function normalizeDecisionSuggestion(input) {
  if (!input) {
    return null;
  }

  if (typeof input === 'string') {
    const condition = String(input).trim();
    return condition
      ? {
          condition,
          status: 'service-connected',
          effectiveDate: '',
          laterality: { left: false, right: false },
          evidenceSummary: '',
          evidenceGaps: [],
          sourceEvidence: [],
          readinessReason: '',
          suggestedLane: '',
          readinessState: '',
          readinessScore: null,
          importedFromWorkspace: true,
        }
      : null;
  }

  const condition = String(input.condition || input.conditionName || '').trim();
  if (!condition) {
    return null;
  }

  return {
    condition,
    status: String(input.status || 'service-connected').trim() || 'service-connected',
    effectiveDate: String(input.effectiveDate || '').trim(),
    laterality: normalizeBooleanPair(input.laterality),
    evidenceSummary: String(input.evidenceSummary || '').trim(),
    evidenceGaps: Array.isArray(input.evidenceGaps) ? input.evidenceGaps.filter(Boolean) : [],
    sourceEvidence: Array.isArray(input.sourceEvidence) ? input.sourceEvidence : [],
    readinessReason: String(input.readinessReason || '').trim(),
    suggestedLane: String(input.suggestedLane || '').trim(),
    readinessState: String(input.readinessState || '').trim(),
    readinessScore: Number.isFinite(Number(input.readinessScore)) ? Number(input.readinessScore) : null,
    importedFromWorkspace: input.importedFromWorkspace !== false,
  };
}

export function normalizeTreatmentSuggestion(input) {
  if (!input) {
    return null;
  }

  if (typeof input === 'string') {
    const label = String(input).trim();
    return label
      ? {
          conditionName: label,
          diagnosisDate: '',
          symptomSummary: '',
          provider: '',
          treatmentPlan: '',
          medications: '',
          severity: 'moderate',
          status: 'active',
          importedFromWorkflow: true,
          sourceEvidence: [],
        }
      : null;
  }

  const conditionName = String(input.conditionName || input.condition || '').trim();
  if (!conditionName) {
    return null;
  }

  return {
    conditionName,
    diagnosisDate: String(input.diagnosisDate || '').trim(),
    symptomSummary: String(input.symptomSummary || '').trim(),
    provider: String(input.provider || '').trim(),
    treatmentPlan: String(input.treatmentPlan || '').trim(),
    medications: Array.isArray(input.medications)
      ? input.medications.join(', ')
      : String(input.medications || '').trim(),
    severity: String(input.severity || 'moderate').trim() || 'moderate',
    status: String(input.status || 'active').trim() || 'active',
    importedFromWorkflow: input.importedFromWorkflow !== false,
    sourceEvidence: Array.isArray(input.sourceEvidence) ? input.sourceEvidence : [],
  };
}
