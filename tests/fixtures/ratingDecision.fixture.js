/**
 * RatingDecision test fixture — Phase 6.
 * Minimal valid VA rating decision output used in graph and unit tests.
 */

export const RATING_DECISION_FIXTURE = {
  documentId:    'rd-fixture-001',
  schemaVersion: '1.0.0',
  serviceConnected: [
    { condition: 'Lumbar strain',     rating: 20, date: '2015-06-10' },
    { condition: 'Hearing loss',      rating: 10, date: '2015-06-10' },
  ],
  denied: [
    { condition: 'Right knee contusion', reason: 'Insufficient nexus evidence' },
  ],
  smc: [],
  dependents: { spouse: false, children: 0 },
  ratingCalculation: {
    calculatedCombinedRating: 28,
    roundedCombinedRating:    30,
    method:                   'whole-person',
  },
  extractionSummary: {
    scannerVersion:  '4.2.0-cfr-aware-upgrade',
    extractedAt:    '2024-01-15T00:00:00.000Z',
    documentType:   'VA Rating Decision',
  },
};
