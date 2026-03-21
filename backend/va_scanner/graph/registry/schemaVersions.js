/**
 * Authoritative version registry for all Veteran Evidence Graph schemas and scanners.
 * Bump these constants whenever a schema or scanner output structure changes.
 */

export const SCHEMA_VERSIONS = {
  VETERAN_EVIDENCE_GRAPH: '2.0.0',
  DD214:                  '3.0.0',
  STR:                    '3.0.0',
  CURRENT_TREATMENT:      '2.0.0',
  RATING_DECISION:        '4.2.0',
  EVIDENCE_ITEM:          '2.0.0',
  EVIDENCE_BUNDLE:        '2.0.0',
  VERIFICATION_RESULT:    '2.0.0',
};

export const SCANNER_VERSIONS = {
  DD214:             '3.0.0-modernized-extraction',
  STR:               '3.0.0-nlp-enhanced',
  RATING_DECISION:   '4.2.0-cfr-compliant',
  CURRENT_TREATMENT: '2.0.0-deterministic',
  OCR:               '2.0.0-advanced-preprocessing',
};
