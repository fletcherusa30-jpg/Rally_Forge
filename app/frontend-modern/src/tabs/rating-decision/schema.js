export const RD_CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'unknown'];

export const RD_RESULT_SECTIONS = [
  'combinedRating',
  'serviceConnectedConditions',
  'deniedConditions',
  'smcAdjustments',
  'dependentAdjustments',
  'effectiveDates',
];

export const RD_SECTION_LABELS = {
  combinedRating: 'Combined Rating',
  serviceConnectedConditions: 'Service-Connected Conditions',
  deniedConditions: 'Denied Conditions',
  smcAdjustments: 'SMC',
  dependentAdjustments: 'Dependents',
  effectiveDates: 'Effective Dates',
};

export const RD_PERCENT_OPTIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export function createEmptyManualEntry() {
  return {
    id: '',
    conditionName: '',
    percentage: '',
    effectiveDate: '',
    isServiceConnected: false,
    isDenied: false,
    denialReason: '',
    smcCodes: [],
    dependents: '',
    combinedRating: '',
  };
}

export function createEmptyExtractedFindings() {
  return {
    combinedRating: '',
    decisionMetadata: {},
    serviceConnectedConditions: [],
    deniedConditions: [],
    smcAdjustments: [],
    dependentAdjustments: [],
    effectiveDates: [],
    confidenceBySection: {},
    evidenceSpans: [],
  };
}

export function createVaDecisionSection() {
  return {
    manualEntries: [],
    extractedFindings: createEmptyExtractedFindings(),
    conflicts: [],
    summary: null,
    updatedAt: null,
  };
}
