export const CLAIM_CATEGORY = Object.freeze({
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  PRESUMPTIVE: 'presumptive',
  AGGRAVATION: 'aggravation',
  INCREASE: 'increase',
  REOPEN: 'reopen',
});

export const CLAIM_CATEGORY_LABEL = Object.freeze({
  [CLAIM_CATEGORY.PRIMARY]: 'Primary',
  [CLAIM_CATEGORY.SECONDARY]: 'Secondary',
  [CLAIM_CATEGORY.PRESUMPTIVE]: 'Presumptive',
  [CLAIM_CATEGORY.AGGRAVATION]: 'Aggravation',
  [CLAIM_CATEGORY.INCREASE]: 'Increase',
  [CLAIM_CATEGORY.REOPEN]: 'Reopen',
});

export function createEmptyGeneratedCondition() {
  return {
    conditionName: '',
    category: CLAIM_CATEGORY.PRIMARY,
    evidence: {
      str: [],
      treatment: [],
      service: [],
      ratingDecision: [],
    },
    confidence: {
      score: 0,
      level: 'low',
    },
    missingEvidence: [],
    recommendedForms: [],
    recommendedDBQs: [],
    followUpQuestions: [],
    whyClaimable: '',
  };
}

export function createClaimGeneratorSummarySection() {
  return {
    generatedConditions: [],
    readinessScore: 0,
    evidenceIndex: [],
    recommendedActions: [],
    followUpChecklist: [],
    layStatement: '',
    layStatementTemplate: '',
    updatedAt: null,
  };
}
