/**
 * Veteran Evidence Graph — type system.
 * Technology-agnostic. No DB-specific syntax.
 *
 * Exports:
 *   NODE_TYPES   — all valid node type strings
 *   EDGE_TYPES   — all valid edge type strings
 *   EDGE_RULES   — allowed [fromNodeType, edgeType, toNodeType] triples
 *   NODE_REQUIRED_PROPS — required properties per node type
 */

export const NODE_TYPES = Object.freeze({
  VETERAN:                       'Veteran',
  SERVICE_PERIOD:                'ServicePeriod',
  DEPLOYMENT:                    'Deployment',
  MOS:                           'MOS',
  DD214_DOCUMENT:                'DD214Document',
  STR_DOCUMENT:                  'STRDocument',
  CURRENT_TREATMENT_DOCUMENT:    'CurrentTreatmentDocument',
  RATING_DECISION_DOCUMENT:      'RatingDecisionDocument',
  CONDITION:                     'Condition',
  SYMPTOM:                       'Symptom',
  DIAGNOSIS:                     'Diagnosis',
  TREATMENT:                     'Treatment',
  SURGERY:                       'Surgery',
  EXPOSURE_EVENT:                'ExposureEvent',
  FUNCTIONAL_LIMITATION:         'FunctionalLimitation',
  CLAIM:                         'Claim',
  DECISION_OUTCOME:              'DecisionOutcome',
  EVIDENCE_ITEM:                 'EvidenceItem',
  EVIDENCE_BUNDLE:               'EvidenceBundle',
  VERIFICATION_RESULT:           'VerificationResult',
  INSIGHT:                       'Insight',
  SUGGESTION:                    'Suggestion',
});

export const EDGE_TYPES = Object.freeze({
  HAS_SERVICE_PERIOD:     'HAS_SERVICE_PERIOD',
  HAS_DEPLOYMENT:         'HAS_DEPLOYMENT',
  HAS_MOS:                'HAS_MOS',
  HAS_DD214:              'HAS_DD214',
  HAS_STR:                'HAS_STR',
  HAS_CURRENT_TREATMENT:  'HAS_CURRENT_TREATMENT',
  HAS_RATING_DECISION:    'HAS_RATING_DECISION',
  MENTIONS_CONDITION:     'MENTIONS_CONDITION',
  MENTIONS_EXPOSURE:      'MENTIONS_EXPOSURE',
  SHOWS_DIAGNOSIS:        'SHOWS_DIAGNOSIS',
  SHOWS_TREATMENT:        'SHOWS_TREATMENT',
  SHOWS_WORSENING:        'SHOWS_WORSENING',
  GRANTS:                 'GRANTS',
  DENIES:                 'DENIES',
  SUPPORTED_BY:           'SUPPORTED_BY',
  CONTRADICTED_BY:        'CONTRADICTED_BY',
  GROUPED_IN:             'GROUPED_IN',
  SUPPORTS:               'SUPPORTS',
  CONTRADICTS:            'CONTRADICTS',
  HAS_VERIFICATION:       'HAS_VERIFICATION',
  HAS_INSIGHT:            'HAS_INSIGHT',
});

export const EDGE_RULES = Object.freeze([
  [NODE_TYPES.VETERAN,                    EDGE_TYPES.HAS_SERVICE_PERIOD,    NODE_TYPES.SERVICE_PERIOD],
  [NODE_TYPES.VETERAN,                    EDGE_TYPES.HAS_DD214,             NODE_TYPES.DD214_DOCUMENT],
  [NODE_TYPES.VETERAN,                    EDGE_TYPES.HAS_STR,               NODE_TYPES.STR_DOCUMENT],
  [NODE_TYPES.VETERAN,                    EDGE_TYPES.HAS_CURRENT_TREATMENT, NODE_TYPES.CURRENT_TREATMENT_DOCUMENT],
  [NODE_TYPES.VETERAN,                    EDGE_TYPES.HAS_RATING_DECISION,   NODE_TYPES.RATING_DECISION_DOCUMENT],
  [NODE_TYPES.SERVICE_PERIOD,             EDGE_TYPES.HAS_DEPLOYMENT,        NODE_TYPES.DEPLOYMENT],
  [NODE_TYPES.SERVICE_PERIOD,             EDGE_TYPES.HAS_MOS,               NODE_TYPES.MOS],
  [NODE_TYPES.DD214_DOCUMENT,             EDGE_TYPES.MENTIONS_CONDITION,    NODE_TYPES.CONDITION],
  [NODE_TYPES.DD214_DOCUMENT,             EDGE_TYPES.MENTIONS_EXPOSURE,     NODE_TYPES.EXPOSURE_EVENT],
  [NODE_TYPES.STR_DOCUMENT,              EDGE_TYPES.MENTIONS_CONDITION,    NODE_TYPES.CONDITION],
  [NODE_TYPES.STR_DOCUMENT,              EDGE_TYPES.MENTIONS_EXPOSURE,     NODE_TYPES.EXPOSURE_EVENT],
  [NODE_TYPES.STR_DOCUMENT,              EDGE_TYPES.SHOWS_DIAGNOSIS,       NODE_TYPES.DIAGNOSIS],
  [NODE_TYPES.STR_DOCUMENT,              EDGE_TYPES.SHOWS_TREATMENT,       NODE_TYPES.TREATMENT],
  [NODE_TYPES.CURRENT_TREATMENT_DOCUMENT, EDGE_TYPES.MENTIONS_CONDITION,    NODE_TYPES.CONDITION],
  [NODE_TYPES.CURRENT_TREATMENT_DOCUMENT, EDGE_TYPES.SHOWS_WORSENING,       NODE_TYPES.CONDITION],
  [NODE_TYPES.CURRENT_TREATMENT_DOCUMENT, EDGE_TYPES.SHOWS_TREATMENT,       NODE_TYPES.TREATMENT],
  [NODE_TYPES.RATING_DECISION_DOCUMENT,   EDGE_TYPES.GRANTS,                NODE_TYPES.CONDITION],
  [NODE_TYPES.RATING_DECISION_DOCUMENT,   EDGE_TYPES.DENIES,                NODE_TYPES.CONDITION],
  [NODE_TYPES.CONDITION,                  EDGE_TYPES.SUPPORTED_BY,          NODE_TYPES.EVIDENCE_ITEM],
  [NODE_TYPES.CONDITION,                  EDGE_TYPES.CONTRADICTED_BY,       NODE_TYPES.EVIDENCE_ITEM],
  [NODE_TYPES.EVIDENCE_ITEM,              EDGE_TYPES.GROUPED_IN,            NODE_TYPES.EVIDENCE_BUNDLE],
  [NODE_TYPES.VERIFICATION_RESULT,        EDGE_TYPES.SUPPORTS,              NODE_TYPES.CONDITION],
  [NODE_TYPES.VERIFICATION_RESULT,        EDGE_TYPES.CONTRADICTS,           NODE_TYPES.CONDITION],
  [NODE_TYPES.VETERAN,                    EDGE_TYPES.HAS_VERIFICATION,      NODE_TYPES.VERIFICATION_RESULT],
  [NODE_TYPES.CONDITION,                  EDGE_TYPES.HAS_INSIGHT,           NODE_TYPES.INSIGHT],
  [NODE_TYPES.CONDITION,                  EDGE_TYPES.HAS_INSIGHT,           NODE_TYPES.SUGGESTION],
]);

export const NODE_REQUIRED_PROPS = Object.freeze({
  [NODE_TYPES.VETERAN]:                    ['veteranId', 'createdAt'],
  [NODE_TYPES.SERVICE_PERIOD]:             ['servicePeriodId', 'branchOfService', 'sourceDocumentId'],
  [NODE_TYPES.DEPLOYMENT]:                 ['deploymentId', 'location'],
  [NODE_TYPES.MOS]:                        ['mosId', 'code'],
  [NODE_TYPES.DD214_DOCUMENT]:             ['documentId', 'veteranId', 'createdAt'],
  [NODE_TYPES.STR_DOCUMENT]:              ['documentId', 'veteranId', 'createdAt'],
  [NODE_TYPES.CURRENT_TREATMENT_DOCUMENT]: ['documentId', 'veteranId', 'createdAt'],
  [NODE_TYPES.RATING_DECISION_DOCUMENT]:   ['documentId', 'veteranId', 'createdAt'],
  [NODE_TYPES.CONDITION]:                  ['conditionId', 'name'],
  [NODE_TYPES.SYMPTOM]:                    ['symptomId', 'description'],
  [NODE_TYPES.DIAGNOSIS]:                  ['diagnosisId', 'name'],
  [NODE_TYPES.TREATMENT]:                  ['treatmentId', 'description'],
  [NODE_TYPES.SURGERY]:                    ['surgeryId', 'description'],
  [NODE_TYPES.EXPOSURE_EVENT]:             ['exposureId', 'type'],
  [NODE_TYPES.FUNCTIONAL_LIMITATION]:      ['limitationId', 'description'],
  [NODE_TYPES.CLAIM]:                      ['claimId'],
  [NODE_TYPES.DECISION_OUTCOME]:           ['outcomeId', 'result'],
  [NODE_TYPES.EVIDENCE_ITEM]:              ['evidenceId', 'sourceDocumentType', 'sourceDocumentId', 'summary', 'confidence'],
  [NODE_TYPES.EVIDENCE_BUNDLE]:            ['bundleId', 'conditionId'],
  [NODE_TYPES.VERIFICATION_RESULT]:        ['verificationId', 'scope'],
  [NODE_TYPES.INSIGHT]:                    ['insightId', 'model', 'timestamp', 'confidence', 'scope'],
  [NODE_TYPES.SUGGESTION]:                 ['suggestionId', 'model', 'timestamp', 'confidence', 'scope'],
});

export const DOCUMENT_NODE_TYPES = Object.freeze([
  NODE_TYPES.DD214_DOCUMENT,
  NODE_TYPES.STR_DOCUMENT,
  NODE_TYPES.CURRENT_TREATMENT_DOCUMENT,
  NODE_TYPES.RATING_DECISION_DOCUMENT,
]);

export const AI_NODE_TYPES = Object.freeze([
  NODE_TYPES.INSIGHT,
  NODE_TYPES.SUGGESTION,
]);
