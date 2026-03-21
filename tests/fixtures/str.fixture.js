/**
 * STR test fixture — Phase 6.
 * Minimal valid STR scanner output used in graph and unit tests.
 */

export const STR_FIXTURE = {
  documentId:     'str-fixture-001',
  schemaVersion:  '2.0.0',
  scannerVersion: '2.0.0-authoritative',
  chronicConditions: [
    { value: 'Lumbar strain',     date: '2011-09-15', rawText: 'Low back pain — lumbar strain' },
    { value: 'Hearing loss',      date: '2013-04-02', rawText: 'Bilateral sensorineural hearing loss from weapons range' },
  ],
  injuries: [
    { value: 'Right knee contusion', date: '2012-03-20', rawText: 'Right knee struck during patrol' },
  ],
  medications: [
    { value: 'Ibuprofen 800mg',   date: '2011-09-16', rawText: 'Rx: Ibuprofen 800mg TID PRN pain' },
  ],
  medicalEvents: [
    { value: 'Audiology evaluation', date: '2013-04-02', rawText: 'Referred to audiology — bilateral threshold shift' },
  ],
  exposureEvents: [
    { value: 'Burn pit smoke exposure', date: '2011-06-01', rawText: 'Patient reports daily burn pit exposure at FOB' },
  ],
  extractionMeta: {
    scannerVersion: '2.0.0-authoritative',
    pageCount:       12,
    usedOcr:         false,
    extractedAt:    '2024-01-15T00:00:00.000Z',
  },
};
