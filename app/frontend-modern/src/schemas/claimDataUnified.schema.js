export const CLAIM_DATA_UNIFIED_REQUIRED_KEYS = [
  'profile',
  'service',
  'str',
  'currentTreatment',
  'ratingDecision',
  'timeline',
  'derivedSignals',
  'generatedConditions',
  'layStatement',
  'evidenceIndex',
];

export const CLAIM_DATA_UNIFIED_ENGINE_CHAIN = [
  'conditionGenerator',
  'derivedSignals',
  'layStatement',
  'evidenceIndex',
  'timelineBuilder',
];

export const CLAIM_DATA_UNIFIED_NORMALIZATION_RULES = [
  'Normalize condition names before engine dispatch',
  'Normalize exposure names before derived-signal dispatch',
  'Normalize date values before evidence/timeline storage',
  'Normalize evidence rows with source/date/summary',
];

export const CLAIM_DATA_UNIFIED_SCHEMA = {
  profile: 'object',
  service: 'array',
  str: 'object',
  currentTreatment: 'object',
  ratingDecision: 'object',
  timeline: 'array',
  derivedSignals: 'object',
  generatedConditions: 'array',
  layStatement: 'string',
  evidenceIndex: 'array',
};

export function validateClaimDataUnifiedShape(value) {
  const candidate = value || {};
  return CLAIM_DATA_UNIFIED_REQUIRED_KEYS.every((key) => Object.prototype.hasOwnProperty.call(candidate, key));
}
