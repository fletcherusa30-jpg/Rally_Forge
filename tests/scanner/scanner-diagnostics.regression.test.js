import test from 'node:test';
import assert from 'node:assert/strict';

import { buildScannerDiagnostics, buildExtractionMeta } from '../../backend/va_scanner/backend/shared/scanner/scannerMiddleware.js';
import { buildExtractionQuality } from '../../backend/engine/scanner/UnifiedScannerEngine.js';
import { validateExtractionMetaSchema } from '../../backend/va_scanner/backend/shared/scanner/schemaValidators.js';

test('buildScannerDiagnostics returns deterministic normalized diagnostics payload', () => {
  const diagnostics = buildScannerDiagnostics({
    stage: 'classify',
    parserProfile: 'va-rating-decision',
    classifier: 'va-rating-decision',
    usedOcr: true,
    ocrProfile: 'ratingDecision',
    ocrConfidence: 82.4,
    ocrScannerVersion: '3.0.0',
    warnings: ['  OCR fallback used  ', 'OCR fallback used'],
    errors: [''],
    signals: ['classification:initial-ambiguous', 'classification:initial-ambiguous'],
  });

  assert.deepEqual(diagnostics, {
    stage: 'classify',
    parserProfile: 'va-rating-decision',
    classifier: 'va-rating-decision',
    usedOcr: true,
    ocrProfile: 'ratingDecision',
    ocrConfidence: 82.4,
    ocrScannerVersion: '3.0.0',
    ocrFallbackError: null,
    warnings: ['OCR fallback used'],
    errors: [],
    signals: ['classification:initial-ambiguous'],
  });
});

test('buildExtractionQuality exposes deterministic signals and review reason', () => {
  const quality = buildExtractionQuality({
    scanData: {
      serviceConnected: [{ condition: 'lumbar strain' }],
      denied: [],
      smc: { detectedLevels: [] },
      ratingCalculation: { calculatedCombinedRating: 20 },
    },
    dependentData: {
      dependents: [],
      validationWarnings: [{ message: 'table parse fallback' }],
    },
    compensation: null,
    parserProfile: 'generic-va-document',
  });

  assert.equal(quality.review.requiresManualReview, true);
  assert.equal(typeof quality.review.reason, 'string');
  assert.ok(Array.isArray(quality.diagnostics.signals));
  assert.ok(quality.diagnostics.signals.includes('classification:generic-profile'));
  assert.ok(quality.diagnostics.signals.includes('conditions:service-connected-found'));
  assert.ok(quality.diagnostics.signals.includes('compensation:unavailable'));
});

test('validateExtractionMetaSchema accepts diagnostics payload', () => {
  const extractionMeta = buildExtractionMeta({
    scannerType: 'dd214',
    schemaVersion: '3.0.0',
    confidence: 0.8,
    fieldsPopulated: 8,
    fieldsTotal: 10,
    extras: {
      diagnostics: buildScannerDiagnostics({
        stage: 'extract',
        classifier: 'dd214',
        usedOcr: true,
        ocrProfile: 'dd214',
        ocrConfidence: 78.5,
        ocrScannerVersion: '3.0.0',
        warnings: ['OCR fallback used'],
        signals: ['ocr:fallback-used'],
      }),
    },
  });

  const result = validateExtractionMetaSchema(extractionMeta);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});