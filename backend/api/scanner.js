import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'node:crypto';
import { scanVaDecision, looksLikeRatingDecisionNarrative } from '../va_scanner/engine/vaSuperScanner.js';
import cfrParser from '../va_scanner/engine/cfr-rating-parser.js';
const { COMBINED_RATINGS_TABLE, BILATERAL_FACTOR } = cfrParser;
import { enhanceWithPACTActFlags, generatePACTActSummary } from '../va_scanner/frontend/utils/pactActDetection.js';
import { parseDD214, looksLikeDD214 } from '../va_scanner/backend/shared/scanner/dd214Scanner.js';
import { mapDD214ToStepOne } from '../va_scanner/backend/shared/scanner/dd214StepOneMapper.js';
import { ocrPdfBuffer, needsOcr } from '../va_scanner/backend/shared/scanner/pdfOcrHelper.js';
import { scanSTRDeterministic } from '../va_scanner/backend/shared/scanner/strDeterministicScanner.js';
import { scanCurrentTreatmentDeterministic } from '../va_scanner/backend/shared/scanner/currentTreatmentScanner.js';
import { buildRatingDecisionAnalysis } from '../va_scanner/backend/shared/scanner/ratingDecisionAnalysis.js';
import { fuseScannerAnalyses } from '../va_scanner/backend/shared/scanner/crossScannerFusionEngine.js';
import { crossVerifyDD214WithSTR } from '../va_scanner/backend/shared/scanner/crossVerificationEngine.js';
import {
  validateDD214Schema,
  validateSTRSchema,
  validateCrossVerificationSchema,
  validateExtractionMetaSchema,
  validateCurrentTreatmentSchema,
} from '../va_scanner/backend/shared/scanner/schemaValidators.js';
import { buildScannerDiagnostics } from '../va_scanner/backend/shared/scanner/scannerMiddleware.js';
import { getSMCRate, getAncillaryRate } from '../va_scanner/engine/rateLoader.js';
import { extractDependents } from '../va_scanner/frontend/utils/extractDependents.js';
import { getDisabilityAmount } from '../va_scanner/engine/rateEscalator.js';
import { computeDependentCompensation } from '../services/dependentCompensationEngine.js';
import { scannerRateLimiter } from '../middleware/hardening.js';
import {
  extractSmcCodesFromText as extractSmcCodesFromTextEngine,
  getHighestSmcCode as getHighestSmcCodeEngine,
  getAncillaryFlags as getAncillaryFlagsEngine,
  determineParserProfile as determineParserProfileEngine,
  buildExtractionQuality as buildExtractionQualityEngine,
  buildEvidenceSpans as buildEvidenceSpansEngine,
} from '../engine/scanner/UnifiedScannerEngine.js';
import os from 'node:os';
import fsPromises from 'node:fs/promises';
import { isRedisAvailable, isRedisEnabled } from '../config/redisConfig.js';
import { enqueuePdfJob, getJob } from '../va_scanner/queue/pdfQueue.js';
import { extractPdfTextFromBuffer } from '../utils/pdfTextExtractor.js';
import { validatePortableDd214Output } from '../shared/dd214PortableSchemaValidator.js';

const router = express.Router();

function extractSmcCodesFromText(value) {
  return extractSmcCodesFromTextEngine(value);
}

function getHighestSmcCode(scanData = {}) {
  return getHighestSmcCodeEngine(scanData);
}

function getAncillaryFlags(scanData = {}) {
  return getAncillaryFlagsEngine(scanData);
}

function determineParserProfile({ scanType, extractedText }) {
  return determineParserProfileEngine({
    scanType,
    extractedText,
    looksLikeRatingDecisionNarrative,
  });
}

function buildExtractionQuality({ scanData, dependentData, compensation, parserProfile }) {
  return buildExtractionQualityEngine({ scanData, dependentData, compensation, parserProfile });
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findEvidenceSpan(text, matcher, field, label) {
  const normalizedText = String(text || '');
  if (!normalizedText) return null;

  let match = null;
  if (typeof matcher === 'string') {
    const index = normalizedText.toLowerCase().indexOf(matcher.toLowerCase());
    if (index >= 0) {
      match = { index, value: normalizedText.slice(index, index + matcher.length) };
    }
  } else if (matcher instanceof RegExp) {
    const result = normalizedText.match(matcher);
    if (result && typeof result.index === 'number') {
      match = { index: result.index, value: result[0] };
    }
  }

  if (!match) return null;

  const snippetStart = Math.max(0, match.index - 60);
  const snippetEnd = Math.min(normalizedText.length, match.index + match.value.length + 100);
  const snippet = normalizedText.slice(snippetStart, snippetEnd).replace(/\s+/g, ' ').trim();
  const line = normalizedText.slice(0, match.index).split(/\r?\n/).length;

  return {
    field,
    label,
    line,
    start: match.index,
    end: match.index + match.value.length,
    snippet,
  };
}

function buildEvidenceSpans({ text, scanData, dependentData }) {
  return buildEvidenceSpansEngine({ text, scanData, dependentData });
}

if (typeof Promise.withResolvers !== 'function') {
  Object.defineProperty(Promise, 'withResolvers', {
    value: function withResolvers() {
      let resolve;
      let reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    },
    writable: true,
    configurable: true
  });
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files are allowed'));
    } else {
      cb(null, true);
    }
  }
});

async function applyOcrFallback({
  fileBuffer,
  extractedText,
  numPages,
  shouldRun,
  profile = 'default',
  logPrefix = 'Scanner',
}) {
  const result = {
    text: extractedText,
    numPages,
    usedOcr: false,
    ocrConfidence: null,
    ocrProfile: null,
    ocrScannerVersion: null,
    ocrFallbackError: null,
  };

  if (!shouldRun) {
    return result;
  }

  try {
    const ocrResult = await ocrPdfBuffer(fileBuffer, { profile });
    result.usedOcr = true;
    result.ocrConfidence = ocrResult.ocrConfidence;
    result.ocrProfile = ocrResult.profile || profile;
    result.ocrScannerVersion = ocrResult.scannerVersion || null;
    result.numPages = ocrResult.pageCount || numPages;

    const ocrText = String(ocrResult.text || '').trim();
    if (ocrText) {
      result.text = ocrResult.text;
    }

    console.info(`[${logPrefix}] OCR produced ${String(ocrResult.text || '').length} chars from ${ocrResult.pageCount || 0} pages (confidence: ${Number(ocrResult.ocrConfidence || 0).toFixed(1)}%)`);
    console.info(`[${logPrefix}] OCR profile: ${result.ocrProfile || 'default'} | OCR helper version: ${result.ocrScannerVersion || 'unknown'}`);
  } catch (error) {
    result.ocrFallbackError = error?.message || 'OCR fallback failed';
    console.warn(`[${logPrefix}] OCR fallback failed: ${result.ocrFallbackError}`);
  }

  return result;
}

// Scanner status endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Scanner API is operational',
    scannerVersion: '2.0.0-authoritative',
    endpoints: ['/scan-pdf', '/scan-dd214', '/scan-str-text', '/scan-current-treatment-text', '/scan-va-decision', '/scan-fusion', '/cross-verify', '/validate-schema', '/queue-pdf', '/health'],
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Scanner API is working',
    scannerVersion: '2.0.0-authoritative',
    timestamp: new Date().toISOString()
  });
});

// Deterministic STR text scanner endpoint
router.post('/scan-str-text', scannerRateLimiter, express.json({ limit: '5mb' }), (req, res) => {
  try {
    const text = String(req.body?.text || '');
    if (!text.trim()) {
      return res.status(400).json({ success: false, error: 'No STR text provided' });
    }

    const strData = scanSTRDeterministic(text);
    const schema = validateSTRSchema(strData);

    return res.json({
      success: true,
      data: strData,
      schema,
      extractionMeta: strData.extractionMeta,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: `Failed to scan STR text: ${error.message}` });
  }
});

// Deterministic current treatment text scanner endpoint
router.post('/scan-current-treatment-text', scannerRateLimiter, express.json({ limit: '5mb' }), (req, res) => {
  try {
    const text = String(req.body?.text || '');
    if (!text.trim()) {
      return res.status(400).json({ success: false, error: 'No current treatment text provided' });
    }

    const currentTreatmentData = scanCurrentTreatmentDeterministic(text);
    const schema = validateCurrentTreatmentSchema(currentTreatmentData);

    return res.json({
      success: true,
      data: currentTreatmentData,
      schema,
      extractionMeta: currentTreatmentData.extractionMeta,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: `Failed to scan current treatment text: ${error.message}` });
  }
});

// Current treatment PDF upload and scan endpoint
router.post('/scan-current-treatment-pdf', scannerRateLimiter, upload.single('file'), async (req, res) => {
  console.info('[Scanner] POST /scan-current-treatment-pdf received');

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No PDF file provided' });
  }

  console.info(`[Scanner] Current Treatment Processing: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);

  try {
    let { text: extractedText, numPages } = await extractPdfTextFromBuffer(req.file.buffer);

    console.info(`[Scanner] Current Treatment extracted ${extractedText.length} chars from ${numPages} pages`);

    const ocrAttempt = await applyOcrFallback({
      fileBuffer: req.file.buffer,
      extractedText,
      numPages,
      shouldRun: needsOcr(extractedText),
      profile: 'default',
      logPrefix: 'Scanner',
    });
    extractedText = ocrAttempt.text;
    numPages = ocrAttempt.numPages;
    const usedOcr = ocrAttempt.usedOcr;
    const ocrConfidence = ocrAttempt.ocrConfidence;
    const ocrProfile = ocrAttempt.ocrProfile;
    const ocrScannerVersion = ocrAttempt.ocrScannerVersion;
    const ocrFallbackError = ocrAttempt.ocrFallbackError;
    const diagnostics = buildScannerDiagnostics({
      stage: 'extract',
      classifier: 'current-treatment-pdf',
      usedOcr,
      ocrProfile,
      ocrConfidence,
      ocrScannerVersion,
      ocrFallbackError,
      warnings: ocrFallbackError ? ['OCR fallback failed; using available extracted text.'] : [],
      signals: [usedOcr ? 'ocr:fallback-used' : 'ocr:text-layer-sufficient'],
    });

    if (!extractedText.trim()) {
      return res.status(422).json({
        success: false,
        error: 'No readable text could be extracted from this document.',
        details: {
          usedOcr,
          ocrFallbackError,
        },
      });
    }

    const currentTreatmentData = scanCurrentTreatmentDeterministic(extractedText);
    const schema = validateCurrentTreatmentSchema(currentTreatmentData);

    const fileFingerprint = crypto
      .createHash('sha256')
      .update(`${req.file.originalname}:${req.file.size}:${numPages}:${extractedText.slice(0, 1000)}`)
      .digest('hex')
      .slice(0, 20);

    console.info(`[Scanner] Current Treatment scan complete — confidence ${(currentTreatmentData.extractionMeta.confidence * 100).toFixed(0)}%, ${currentTreatmentData.extractionMeta.fieldsPopulated}/${currentTreatmentData.extractionMeta.fieldsTotal} fields`);

    return res.json({
      success: true,
      data: currentTreatmentData,
      schema,
      extractionMeta: {
        ...currentTreatmentData.extractionMeta,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        pagesScanned: numPages,
        fileFingerprint,
        usedOcr,
        ocrConfidence,
        ocrProfile,
        ocrScannerVersion,
        ocrFallbackError,
        diagnostics,
      },
    });
  } catch (error) {
    console.error('[Scanner] Current Treatment processing error:', error.message);
    return res.status(500).json({ success: false, error: `Failed to process current treatment PDF: ${error.message}` });
  }
});

// Deterministic cross-scanner fusion endpoint (STR + Current Treatment + Rating Decision)
router.post('/scan-fusion', scannerRateLimiter, express.json({ limit: '8mb' }), async (req, res) => {
  try {
    const strAnalysis = req.body?.strAnalysis
      || (req.body?.strText ? scanSTRDeterministic(String(req.body.strText)).strAnalysis : null);

    const currentTreatmentAnalysis = req.body?.currentTreatmentAnalysis
      || (req.body?.currentTreatmentText
        ? scanCurrentTreatmentDeterministic(String(req.body.currentTreatmentText)).currentTreatmentAnalysis
        : null);

    let ratingDecisionAnalysis = req.body?.ratingDecisionAnalysis || null;
    if (!ratingDecisionAnalysis && req.body?.ratingDecisionText) {
      const ratingDecisionText = String(req.body.ratingDecisionText);
      const ratingScan = scanVaDecision(ratingDecisionText);
      ratingDecisionAnalysis = await buildRatingDecisionAnalysis(ratingDecisionText, ratingScan);
    }

    if (!strAnalysis || !currentTreatmentAnalysis || !ratingDecisionAnalysis) {
      return res.status(400).json({
        success: false,
        error: 'strAnalysis, currentTreatmentAnalysis, and ratingDecisionAnalysis are required (or provide strText/currentTreatmentText/ratingDecisionText).',
      });
    }

    const fusion = await fuseScannerAnalyses({
      strAnalysis,
      currentTreatmentAnalysis,
      ratingDecisionAnalysis,
    });

    return res.json({
      success: true,
      data: {
        fusion,
        strAnalysis,
        currentTreatmentAnalysis,
        ratingDecisionAnalysis,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: `Failed to run fusion scan: ${error.message}` });
  }
});

// Deterministic DD214 <-> STR cross-verification endpoint
router.post('/cross-verify', scannerRateLimiter, express.json({ limit: '5mb' }), (req, res) => {
  try {
    const dd214 = req.body?.dd214 || null;
    const strData = req.body?.strData || null;
    const includeInferredConnections = Boolean(req.body?.includeInferredConnections);

    if (!dd214 || !strData) {
      return res.status(400).json({ success: false, error: 'Both dd214 and strData are required' });
    }

    const dd214Schema = validateDD214Schema(dd214);
    const strSchema = validateSTRSchema(strData);
    if (!dd214Schema.valid || !strSchema.valid) {
      return res.status(422).json({
        success: false,
        error: 'Schema validation failed before cross-verification',
        schema: { dd214: dd214Schema, strData: strSchema },
      });
    }

    const crossVerification = crossVerifyDD214WithSTR({ dd214, strData, includeInferredConnections });
    const crossSchema = validateCrossVerificationSchema(crossVerification);

    return res.json({
      success: true,
      data: crossVerification,
      schema: { dd214: dd214Schema, strData: strSchema, crossVerification: crossSchema },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: `Cross-verification failed: ${error.message}` });
  }
});

// Schema validation endpoint for DD214/STR/cross-verification/extractionMeta
router.post('/validate-schema', scannerRateLimiter, express.json({ limit: '5mb' }), (req, res) => {
  try {
    const dd214 = req.body?.dd214 || null;
    const strData = req.body?.strData || null;
    const crossVerification = req.body?.crossVerification || null;
    const extractionMeta = req.body?.extractionMeta || null;

    return res.json({
      success: true,
      validations: {
        dd214: dd214 ? validateDD214Schema(dd214) : null,
        strData: strData ? validateSTRSchema(strData) : null,
        crossVerification: crossVerification ? validateCrossVerificationSchema(crossVerification) : null,
        extractionMeta: extractionMeta ? validateExtractionMetaSchema(extractionMeta) : null,
      },
      validatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: `Schema validation failed: ${error.message}` });
  }
});

router.post('/validate-dd214-import', scannerRateLimiter, express.json({ limit: '5mb' }), (req, res) => {
  try {
    const dd214 = req.body?.dd214 || null;
    if (!dd214 || typeof dd214 !== 'object' || Array.isArray(dd214)) {
      return res.status(400).json({ success: false, error: 'dd214 JSON object is required' });
    }

    const portableSchema = validatePortableDd214Output(dd214);
    if (!portableSchema.valid) {
      return res.status(422).json({
        success: false,
        error: 'Imported DD-214 JSON failed portable schema validation.',
        details: portableSchema.errors,
      });
    }

    const extractionMeta = {
      confidence: Number(dd214?.extractionMeta?.confidence || 0),
      fieldConfidence: dd214?.extractionMeta?.fieldConfidence || {},
      optionalFieldConfidence: dd214?.extractionMeta?.optionalFieldConfidence || {},
      schemaValid: true,
      schemaErrors: [],
      imported: true,
      importSource: 'external-json',
      validatedAt: new Date().toISOString(),
    };

    return res.json({
      success: true,
      data: {
        dd214,
        stepOneMapping: null,
        supplemental: null,
        schema: {
          portable: portableSchema,
        },
        extractionMeta,
        importValidation: {
          portableSchema,
        },
        deterministicStatus: {
          contractAvailable: true,
          requiredPassIds: ['portableSchemaValid'],
          requiredPassesSatisfied: ['portableSchemaValid'],
          ready: true,
          source: 'external-json',
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: `Import validation failed: ${error.message}` });
  }
});

// DD-214 upload and scan endpoint
router.post('/scan-dd214', scannerRateLimiter, upload.single('file'), async (req, res) => {
  console.info('[Scanner] POST /scan-dd214 received');

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No PDF file provided' });
  }

  console.info(`[Scanner] DD214 Processing: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);

  try {
    let { text: extractedText, numPages } = await extractPdfTextFromBuffer(req.file.buffer);

    console.info(`[Scanner] DD214 extracted ${extractedText.length} chars from ${numPages} pages`);

    // If text layer is empty/near-empty, fall back to OCR
    const ocrAttempt = await applyOcrFallback({
      fileBuffer: req.file.buffer,
      extractedText,
      numPages,
      shouldRun: needsOcr(extractedText),
      profile: 'dd214',
      logPrefix: 'Scanner',
    });
    extractedText = ocrAttempt.text;
    numPages = ocrAttempt.numPages;
    const usedOcr = ocrAttempt.usedOcr;
    const ocrConfidence = ocrAttempt.ocrConfidence;
    const ocrProfile = ocrAttempt.ocrProfile;
    const ocrScannerVersion = ocrAttempt.ocrScannerVersion;
    const ocrFallbackError = ocrAttempt.ocrFallbackError;
    const diagnostics = buildScannerDiagnostics({
      stage: 'extract',
      classifier: 'dd214',
      usedOcr,
      ocrProfile,
      ocrConfidence,
      ocrScannerVersion,
      ocrFallbackError,
      warnings: ocrFallbackError ? ['OCR fallback failed; DD214 classification used available extracted text.'] : [],
      signals: [usedOcr ? 'ocr:fallback-used' : 'ocr:text-layer-sufficient'],
    });

    if (!String(extractedText || '').trim()) {
      return res.status(422).json({
        success: false,
        error: 'No readable text could be extracted from this DD-214.',
        details: {
          usedOcr,
          ocrFallbackError,
        },
      });
    }

    if (!looksLikeDD214(extractedText)) {
      return res.status(422).json({
        success: false,
        error: 'This document does not appear to be a DD-214 or similar discharge document.',
      });
    }

    const dd214Data = parseDD214(extractedText);
    const dd214SchemaVersion = String(dd214Data?.schemaVersion || '');
    const validationSummary = dd214Data?.dd214Analysis?.validationSummary || dd214Data?.extractionMeta?.validationSummary || null;
    const dd214Passes = Array.isArray(validationSummary?.passes) ? validationSummary.passes : [];
    const passMap = new Map(dd214Passes.map((pass) => [pass?.passId, Boolean(pass?.passed)]));
    const requiredPassIds = ['dateChronology', 'netServiceConsistency', 'componentFromBlock2'];
    const deterministicContractAvailable = dd214SchemaVersion === '3.0.0' && dd214Passes.length > 0;
    const deterministicReady = deterministicContractAvailable
      && requiredPassIds.every((passId) => passMap.get(passId) === true);

    if (dd214SchemaVersion !== '3.0.0') {
      return res.status(422).json({
        success: false,
        error: 'Deterministic DD-214 extraction is unavailable for this upload. Please re-scan with a supported document quality/template.',
        details: {
          schemaVersion: dd214SchemaVersion || null,
          deterministicPassesPresent: dd214Passes.length > 0,
        },
      });
    }
    const dd214Schema = validateDD214Schema(dd214Data);
    const extractionMetaSchema = validateExtractionMetaSchema(dd214Data.extractionMeta);
    const mapping = mapDD214ToStepOne(dd214Data);

    const fileFingerprint = crypto
      .createHash('sha256')
      .update(`${req.file.originalname}:${req.file.size}:${numPages}:${extractedText.slice(0, 1000)}`)
      .digest('hex')
      .slice(0, 20);

    console.info(`[Scanner] DD214 scan complete — confidence ${(dd214Data.extractionMeta.confidence * 100).toFixed(0)}%, ${dd214Data.extractionMeta.fieldsPopulated}/${dd214Data.extractionMeta.fieldsTotal} fields`);

    res.json({
      success: true,
      data: {
        dd214: dd214Data,
        stepOneMapping: mapping?.stepOneFields ?? null,
        supplemental: mapping?.supplemental ?? null,
        schema: {
          dd214: dd214Schema,
          extractionMeta: extractionMetaSchema,
        },
        extractionMeta: {
          ...dd214Data.extractionMeta,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          pagesScanned: numPages,
          fileFingerprint,
          usedOcr,
          ocrConfidence,
          ocrProfile,
          ocrScannerVersion,
          ocrFallbackError,
          diagnostics,
        },
        deterministicStatus: {
          contractAvailable: deterministicContractAvailable,
          requiredPassIds,
          requiredPassesSatisfied: requiredPassIds.filter((passId) => passMap.get(passId) === true),
          allChecksPassed: validationSummary?.allChecksPassed === true,
          ready: deterministicReady,
        },
      },
    });
  } catch (error) {
    console.error('[Scanner] DD214 processing error:', error.message);
    res.status(500).json({ success: false, error: `Failed to process DD-214 PDF: ${error.message}` });
  }
});

// PDF upload and scan endpoint
router.post('/scan-pdf', scannerRateLimiter, upload.single('file'), async (req, res) => {
  console.info('[Scanner] POST /scan-pdf received');
  
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No PDF file provided'
    });
  }

  console.info(`[Scanner] Processing PDF: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);
  
  try {
    let { text: extractedText, numPages } = await extractPdfTextFromBuffer(req.file.buffer);
    
    console.info(`[Scanner] Extracted ${extractedText.length} characters from ${numPages} pages`);

    const initialLooksLikeRatingDecision = looksLikeRatingDecisionNarrative(extractedText);
    const shouldTryRatingDecisionOcr = needsOcr(extractedText)
      || (!initialLooksLikeRatingDecision && String(extractedText || '').trim().length < 1200);

    const ocrAttempt = await applyOcrFallback({
      fileBuffer: req.file.buffer,
      extractedText,
      numPages,
      shouldRun: shouldTryRatingDecisionOcr,
      profile: 'ratingDecision',
      logPrefix: 'Scanner',
    });
    extractedText = ocrAttempt.text;
    numPages = ocrAttempt.numPages;
    const usedOcr = ocrAttempt.usedOcr;
    const ocrConfidence = ocrAttempt.ocrConfidence;
    const ocrProfile = ocrAttempt.ocrProfile;
    const ocrScannerVersion = ocrAttempt.ocrScannerVersion;
    const ocrFallbackError = ocrAttempt.ocrFallbackError;
    const diagnostics = buildScannerDiagnostics({
      stage: 'classify',
      parserProfile: initialLooksLikeRatingDecision ? 'va-rating-decision' : 'generic-va-document',
      classifier: 'va-rating-decision',
      usedOcr,
      ocrProfile,
      ocrConfidence,
      ocrScannerVersion,
      ocrFallbackError,
      warnings: ocrFallbackError ? ['OCR fallback failed during rating decision classification.'] : [],
      signals: [
        initialLooksLikeRatingDecision ? 'classification:initial-match' : 'classification:initial-ambiguous',
        usedOcr ? 'ocr:fallback-used' : 'ocr:text-layer-sufficient',
      ],
    });

    if (!looksLikeRatingDecisionNarrative(extractedText)) {
      return res.status(422).json({
        success: false,
        error: 'This document does not look like a VA Rating Decision narrative.',
        details: {
          usedOcr,
          ocrFallbackError,
        },
      });
    }

    // DEBUG: Check for dependent table headers in extracted text
    const hasDepTableHeader = /type\s+of\s+dependent\s+name\s+effective\s+date/i.test(extractedText);
    console.info(`[Scanner] ============================================`);
    console.info(`[Scanner] EXTRACTED TEXT INSPECTION`);
    console.info(`[Scanner] Has dependent table header: ${hasDepTableHeader}`);
    
    // Extract the dependent table section for inspection
    if (hasDepTableHeader) {
      const depTableMatch = extractedText.match(/type\s+of\s+dependent\s+name\s+effective\s+date([\s\S]{0,1500}?)(?:payment\s+start\s+date|we\s+will\s+remove|dependent\s+adjustments?|combined\s+rating|$)/i);
      if (depTableMatch) {
        const depTableSection = depTableMatch[1];
        const lineCount = (depTableSection.match(/\n/g) || []).length;
        console.info(`[Scanner] Dependent table section found`);
        console.info(`[Scanner]   - Length: ${depTableSection.length} chars`);
        console.info(`[Scanner]   - Newlines: ${lineCount}`);
        console.info(`[Scanner]   - Preview: ${depTableSection.substring(0, 200).replace(/\n/g, ' ')}`);
      }
    }
    console.info(`[Scanner] ============================================\n`);

    // Extract dependent information with monthly amounts (non-fatal)
    let dependentData = {
      dependents: [],
      added: [],
      removed: [],
      changed: [],
      dependentCount: null,
      familyStatus: null,
      totalDependentAmount: 0,
      validationWarnings: []
    };

    try {
      dependentData = extractDependents(extractedText);
    } catch (dependentError) {
      console.warn('[Scanner] Dependent extraction failed, continuing scan:', dependentError.message);
      dependentData.validationWarnings.push({
        message: `Dependent extraction partially failed: ${dependentError.message}`
      });
    }
    console.info(`[Scanner] ============================================`);
    console.info(`[Scanner] DEPENDENT EXTRACTION RESULTS`);
    console.info(`[Scanner] Extracted ${dependentData.dependents?.length || 0} merged dependents, ${dependentData.removed.length} removed dependents`);
    console.info(`[Scanner] Total dependent amount: $${dependentData.totalDependentAmount.toFixed(2)}/month`);
    
    if ((dependentData.dependents?.length || 0) > 0) {
      console.info(`[Scanner] --- Added Dependents ---`);
      (dependentData.dependents || []).forEach((dep, idx) => {
        console.info(`[Scanner] ${idx + 1}. NAME: "${dep.name}" | TYPE: ${dep.type} | AMOUNT: $${(dep.monthlyAmount || 0).toFixed(2)}/mo | EFFECTIVE: ${dep.effectiveDate || 'N/A'} | REMOVAL: ${dep.removalDate || 'N/A'}`);
        console.info(`[Scanner]    Structure: `, JSON.stringify(dep, null, 2));
      });
    } else {
      console.info(`[Scanner] NO DEPENDENTS FOUND in document`);
    }
    
    if (dependentData.removed.length > 0) {
      console.info(`[Scanner] --- Removed Dependents ---`);
      dependentData.removed.forEach((dep, idx) => {
        console.info(`[Scanner] ${idx + 1}. NAME: "${dep.name}" | TYPE: ${dep.type}`);
      });
    }
    
    if (dependentData.validationWarnings && dependentData.validationWarnings.length > 0) {
      console.info(`[Scanner] --- Validation Warnings ---`);
      dependentData.validationWarnings.forEach(warning => {
        console.info(`[Scanner] ⚠️ ${warning.message}`);
      });
    }
    console.info(`[Scanner] ============================================\n`);

    const parserProfile = determineParserProfile({
      scanType: req.body?.scanType,
      extractedText,
    });

    const scanData = scanVaDecision(extractedText);
    const ratingDecisionAnalysis = await buildRatingDecisionAnalysis(extractedText, scanData);

    const ratingPercent = scanData?.ratingCalculation?.calculatedCombinedRating || 0;
    let computedDependentCompensation = {
      dependents: dependentData.dependents || [],
      compensationTimeline: [],
      dependentAdjustments: [],
      finalMonthlyAmount: 0,
      warnings: []
    };

    if (ratingPercent > 0) {
      computedDependentCompensation = computeDependentCompensation(
        ratingPercent,
        dependentData.dependents || [],
        scanData
      );
    }

    const grantedDetectedSmc = Array.isArray(scanData?.smc?.detectedLevels)
      ? scanData.smc.detectedLevels
          .map((item) => ({
            ...item,
            level: String(item?.level || '').toUpperCase()
          }))
          .filter((item) => !!item.level)
      : [];

    const explicitGrantedSmc = grantedDetectedSmc.map((item) => `${item.level} - ${item.reason || `Explicitly granted SMC-${item.level}`}`);

    let compensation = null;
    try {
      const rating = scanData?.ratingCalculation?.calculatedCombinedRating || 0;
      const currentYear = new Date().getFullYear();
      
      if (rating > 0) {
        const smcCode = getHighestSmcCode(scanData);
        const ancillary = getAncillaryFlags(scanData);
        
        // Calculate compensation using RATE ESCALATOR (automatically uses current year rates)
        const baseRate = getDisabilityAmount(rating, currentYear);
        const smcRate = smcCode ? getSMCRate(smcCode, currentYear) : 0;
        const aidAndAttendanceRate = ancillary.aidAndAttendance ? getAncillaryRate('aidAndAttendance', currentYear) : 0;
        const houseboundRate = ancillary.housebound ? getAncillaryRate('housebound', currentYear) : 0;
        const dependentMonthly = computedDependentCompensation.finalMonthlyAmount > 0
          ? Math.max(0, computedDependentCompensation.finalMonthlyAmount - baseRate)
          : dependentData.totalDependentAmount;
        
        const totalMonthly = baseRate + dependentMonthly + smcRate + aidAndAttendanceRate + houseboundRate;
        
        compensation = {
          summary: {
            totalMonthly,
            totalYearly: totalMonthly * 12,
            year: currentYear,
            smcCode: smcCode || null,
            note: `Rates automatically calculated for ${currentYear} using VA COLA escalation`
          },
          components: {
            base: {
              baseMonthly: baseRate,
              dependentMonthly: dependentMonthly,
              totalMonthly: baseRate + dependentMonthly
            },
            smc: {
              smcMonthly: smcRate,
              code: smcCode
            },
            ancillary: {
              aidAndAttendance: aidAndAttendanceRate,
              housebound: houseboundRate,
              total: aidAndAttendanceRate + houseboundRate
            }
          },
          breakdown: {
            baseMonthly: baseRate,
            dependentMonthly: dependentMonthly,
            smcMonthly: smcRate,
            ancillaryMonthly: aidAndAttendanceRate + houseboundRate,
            totalMonthly,
            totalYearly: totalMonthly * 12
          }
        };
      }
    } catch (compensationError) {
      console.warn('[Scanner] Compensation calculation skipped:', compensationError.message);
    }
    
    const fileFingerprint = crypto
      .createHash('sha256')
      .update(`${req.file.originalname}:${req.file.size}:${numPages}:${extractedText.slice(0, 1000)}`)
      .digest('hex')
      .slice(0, 20);

    const evidenceSpans = buildEvidenceSpans({
      text: extractedText,
      scanData,
      dependentData,
    });

    const extractionContract = {
      schemaVersion: '1.0.0',
      parserProfile,
      sourceType: 'pdf-upload',
      recordIdentity: {
        fileName: req.file.originalname,
        fileFingerprint,
      },
      reviewed: false,
      evidenceSpans,
      createdAt: new Date().toISOString(),
    };

    const quality = buildExtractionQuality({
      scanData,
      dependentData,
      compensation,
      parserProfile,
    });

    const scanResult = {
      success: true,
      data: {
        ...scanData,
        ratingDecisionAnalysis,
        extractionContract,
        metadata: {
          ...(scanData.metadata || {}),
          fileName: req.file.originalname,
          fileSize: req.file.size,
          pagesScanned: numPages,
          extractedTextLength: extractedText.length,
          usedOcr,
          ocrConfidence,
          ocrProfile,
          ocrScannerVersion,
          ocrFallbackError,
          diagnostics,
          parserProfile,
          fileFingerprint,
        },
        smc: {
          ...(scanData.smc || {}),
          detectedLevels: grantedDetectedSmc,
          explicit: explicitGrantedSmc
        },
        dependents: dependentData.dependents || [],
        dependentsDetailed: {
          added: dependentData.added,
          removed: dependentData.removed,
          totalDependentAmount: dependentData.totalDependentAmount,
          validationWarnings: dependentData.validationWarnings || []
        },
        dependentAdjustments: computedDependentCompensation.dependentAdjustments || [],
        compensationTimeline: computedDependentCompensation.compensationTimeline || [],
        finalMonthlyAmount: computedDependentCompensation.finalMonthlyAmount || 0,
        compensationWarnings: computedDependentCompensation.warnings || [],
        extractionSummary: {
          ...(scanData.extractionSummary || {}),
          extractedAt: new Date().toISOString(),
          pagesScanned: numPages,
          usedOcr,
          ocrConfidence,
          diagnostics,
        }
      },
      compensation,
      quality,
      processingTime: {
        timestamp: new Date().toISOString()
      }
    };
    
    console.info(
      `[Scanner] Scan complete - found ${scanData.serviceConnected?.length || 0} service-connected, ${scanData.denied?.length || 0} denied, ${scanData.ratingCalculation?.calculatedCombinedRating ?? 0}% rating`
    );
    
    // RESPONSE VALIDATION LOGGING
    console.info(`[Scanner] ============================================`);
    console.info(`[Scanner] RESPONSE TO FRONTEND:`);
    console.info(`[Scanner] - Rating: ${scanData.ratingCalculation?.calculatedCombinedRating ?? 0}%`);
    console.info(`[Scanner] - Compensation Year: ${compensation?.summary?.year || 'N/A'}`);
    const responseDependents = Array.isArray(scanResult.data.dependents)
      ? scanResult.data.dependents
      : (scanResult.data.dependents?.added || []);
    console.info(`[Scanner] - Dependents in response: ${responseDependents.length}`);
    if (responseDependents.length > 0) {
      responseDependents.forEach((dep, idx) => {
        console.info(`  [${idx + 1}] NAME: "${dep.name}" | TYPE: ${dep.type} | MONTHLY: $${(dep.monthlyAmount || 0).toFixed(2)}`);
      });
    }
    console.info(`[Scanner] - Total Dependent Amount: $${scanResult.data.dependentsDetailed?.totalDependentAmount || 0}`);
    if (compensation) {
      console.info(`[Scanner] - Monthly Breakdown: Base $${compensation.breakdown.baseMonthly.toFixed(2)} + Dependents $${compensation.breakdown.dependentMonthly.toFixed(2)} + SMC $${compensation.breakdown.smcMonthly.toFixed(2)} = TOTAL $${compensation.breakdown.totalMonthly.toFixed(2)}`);
    }
    console.info(`[Scanner] ============================================\n`);
    
    res.json(scanResult);
    
  } catch (error) {
    console.error('[Scanner] Error processing PDF:', error.message);
    res.status(500).json({
      success: false,
      error: `Failed to process PDF: ${error.message}`
    });
  }
});

// ── Health check endpoint ─────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  const redisEnabled   = isRedisEnabled();
  const redisAvailable = isRedisAvailable();

  console.info(`[Scanner] GET /health — redis.enabled=${redisEnabled}, redis.available=${redisAvailable}`);

  res.json({
    success: true,
    scannerVersion: '2.0.0-authoritative',
    redis: {
      enabled: redisEnabled,
      available: redisAvailable,
    },
    asyncPdfQueue: {
      enabled: redisEnabled,
      degraded: !redisAvailable,
    },
    timestamp: new Date().toISOString(),
  });
});

// ── Async PDF queue — enqueue ─────────────────────────────────────────────────
router.post('/queue-pdf', scannerRateLimiter, upload.single('file'), async (req, res) => {
  console.info('[Scanner] POST /queue-pdf received');

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No PDF file provided' });
  }

  if (!isRedisAvailable()) {
    console.warn('[Scanner] POST /queue-pdf — Redis unavailable, returning 503');
    return res.status(503).json({
      success: false,
      error: 'Async PDF queue is currently unavailable; use synchronous scan endpoints (/scan-pdf or /scan-dd214).',
    });
  }

  const source = req.body?.source === 'scan-dd214' ? 'scan-dd214' : 'scan-pdf';

  try {
    const tempFileName = `scanner-pdf-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.pdf`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);
    await fsPromises.writeFile(tempFilePath, req.file.buffer);

    const jobId = await enqueuePdfJob({
      source,
      fileMeta: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
      },
      payload: { tempFilePath },
    });

    console.info(`[Scanner] PDF queued — jobId: ${jobId}, source: ${source}, file: ${req.file.originalname}`);

    return res.status(202).json({
      success: true,
      jobId,
      message: 'PDF queued for async processing.',
      statusEndpoint: `/api/scanner/queue-pdf/${jobId}`,
    });
  } catch (err) {
    console.error('[Scanner] Failed to enqueue PDF job:', err.message);
    return res.status(500).json({ success: false, error: `Failed to queue PDF: ${err.message}` });
  }
});

// ── Async PDF queue — poll status ─────────────────────────────────────────────
router.get('/queue-pdf/:jobId', async (req, res) => {
  const { jobId } = req.params;
  console.info(`[Scanner] GET /queue-pdf/${jobId}`);

  try {
    const job = await getJob(jobId);

    if (!job) {
      return res.status(404).json({ success: false, error: `Job ${jobId} not found` });
    }

    const response = {
      success: true,
      jobId: job.jobId,
      status: job.status,
      source: job.source,
      createdAt: job.createdAt,
    };

    if (job.status === 'completed') {
      response.resultMeta = job.resultMeta;
      response.completedAt = job.completedAt;
    }

    if (job.status === 'failed') {
      response.errorMessage = job.resultMeta?.errorMessage ?? 'Unknown error';
      response.failedAt = job.failedAt;
    }

    return res.json(response);
  } catch (err) {
    console.error(`[Scanner] Error fetching job ${jobId}:`, err.message);
    return res.status(500).json({ success: false, error: `Failed to fetch job: ${err.message}` });
  }
});

// ── VA Decision Scanner (text-based) ─────────────────────────────────────────
/**
 * POST /scan-va-decision
 * Accepts raw decision text and returns structured CFR-compliant analysis.
 * Formerly in vaDecisionAnalyzer.js — consolidated here per modernization.
 * Request: { "rawText": "..." }
 */
router.post('/scan-va-decision', scannerRateLimiter, express.json({ limit: '5mb' }), async (req, res) => {
  const startTime = Date.now();
  try {
    const { rawText } = req.body;
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Missing or empty rawText.', code: 'EMPTY_INPUT' });
    }
    if (rawText.trim().length < 20) {
      return res.status(400).json({ success: false, error: 'Decision text too short. Minimum 20 characters required.', code: 'TEXT_TOO_SHORT' });
    }
    const scanResult = scanVaDecision(rawText);
    const ratingDecisionAnalysis = await buildRatingDecisionAnalysis(rawText, scanResult);
    const response = _transformVaDecisionToApiContract(scanResult, startTime, ratingDecisionAnalysis);
    return res.json(response);
  } catch (err) {
    console.error('[VA Decision Scanner] Error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error.', code: 'PROCESSING_ERROR' });
  }
});

function _transformVaDecisionToApiContract(scanResult, startTime, ratingDecisionAnalysis = null) {
  let conditions = [];
  if (scanResult.serviceConnected?.conditions) {
    scanResult.serviceConnected.conditions.forEach(item => {
      conditions.push({
        name: item.condition || item.name || 'Unknown Condition',
        diagnosticCode: item.diagnosticCode || null,
        evaluationPercent: parseInt(item.rating || item.percent || item.evaluationPercent || 0),
        effectiveDate: item.effectiveDate || null,
        bodySystem: item.bodySystem || null,
        isServiceConnected: true,
        isBilateral: item.isBilateral || false,
        laterality: item.laterality || null,
      });
    });
  }
  conditions = enhanceWithPACTActFlags(conditions, scanResult.rawText || '');

  const deniedConditions = [];
  if (scanResult.denied?.conditions) {
    scanResult.denied.conditions.forEach(item => {
      deniedConditions.push({
        name: item.condition || item.name || 'Unknown Condition',
        denialReasons: item.reasons || item.denialReasons || ['No specific reason provided'],
        sourceText: item.sourceText || '',
        denialBasis: item.denialBasis || item.basis || '',
      });
    });
  }

  const ancillaryBenefits = [];
  if (scanResult.ancillaryBenefits?.benefits) {
    scanResult.ancillaryBenefits.benefits.forEach(item => {
      ancillaryBenefits.push({
        name: item.name || item.benefit || 'Unknown Benefit',
        status: item.status || 'potential',
        effectiveDate: item.effectiveDate || null,
        basis: item.basis || item.reason || '',
        sourceText: item.sourceText || '',
      });
    });
  }

  const smcAwards = [];
  if (scanResult.smcAwards?.awards) {
    scanResult.smcAwards.awards.forEach(item => {
      smcAwards.push({
        level: item.level || item.smcLevel || 'Unknown',
        basis: item.basis || item.reason || 'SMC Award',
        amount: item.amount || null,
        effectiveDate: item.effectiveDate || null,
        sourceText: item.sourceText || '',
      });
    });
  }

  const ratings = conditions.filter(c => c.evaluationPercent > 0).map(c => c.evaluationPercent);
  const bilateralConditions = conditions.filter(c => c.isBilateral && c.evaluationPercent > 0);
  let bilateralFactor = 0;
  let bilateralBonus = 0;
  if (bilateralConditions.length >= 2) {
    const bilateralRatings = bilateralConditions.map(c => c.evaluationPercent);
    const combinedBilateral = COMBINED_RATINGS_TABLE.combineMultiple(bilateralRatings);
    bilateralBonus = BILATERAL_FACTOR.calculateBonus(combinedBilateral);
    bilateralFactor = bilateralBonus;
    if (bilateralBonus > 0) ratings.push(bilateralBonus);
  }
  const cfrCombinedRating = COMBINED_RATINGS_TABLE.combineMultiple(ratings);
  const combinedRating = {
    percent: cfrCombinedRating,
    steps: ratings.map((r, i) => ({
      rating: r,
      condition: i < conditions.length ? conditions[i].name : 'Bilateral Factor',
      isBilateralFactor: i >= conditions.length,
    })),
    bilateralFactor,
    bilateralBonus,
    method: 'CFR § 4.25 Official Table' + (bilateralFactor > 0 ? ' + § 4.26 Bilateral Factor' : ''),
  };

  const pactActSummary = generatePACTActSummary(conditions);

  return {
    success: true,
    conditions,
    deniedConditions,
    combinedRating,
    smcAwards,
    ancillaryBenefits,
    ratingDecisionAnalysis,
    pactAct: pactActSummary,
    meta: {
      processingMs: Date.now() - startTime,
      version: '3.3.0-cfr-pact',
      itemsExtracted: conditions.length + deniedConditions.length + ancillaryBenefits.length,
      cfrCompliant: true,
      bilateralFactorApplied: combinedRating.bilateralBonus > 0,
      pactActScanned: true,
    },
  };
}

export default router;

