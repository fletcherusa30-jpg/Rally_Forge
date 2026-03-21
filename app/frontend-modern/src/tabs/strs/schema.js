export const STR_FINDING_TYPES = ['diagnosis', 'injury', 'event', 'presumptive-location'];

export const STR_CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'manual'];

export const STR_CATEGORY_LABELS = {
  diagnosis: 'Diagnoses',
  injury: 'Injuries',
  event: 'In-Service Events',
  'presumptive-location': 'Presumptive Location Signals',
};

export function createEmptyManualEntry(overrides = {}) {
  return {
    id: '',
    findingType: 'event',
    conditionName: '',
    dateOfEvent: '',
    description: '',
    provider: '',
    severity: 'moderate',
    confidenceLevel: 'manual',
    exposureType: '',
    lineOfDuty: 'Yes',
    inServiceEvent: true,
    chronicityEvidence: '',
    continuityNotes: '',
    nexusIndicators: '',
    ...overrides,
  };
}

export function createServiceTreatmentRecordsSection(overrides = {}) {
  return {
    uploadedDocuments: [],
    extractedFindings: [],
    manualEntries: [],
    confidenceLevels: {
      high: 0,
      medium: 0,
      low: 0,
      manual: 0,
    },
    summary: null,
    updatedAt: null,
    ...overrides,
  };
}
