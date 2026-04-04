/**
 * Scanner PDF async worker.
 *
 * Polls pdfQueue when Redis is available and runs each job through the same
 * extraction pipeline used by the synchronous /scan-pdf and /scan-dd214 endpoints.
 * When Redis is unavailable, every poll is a no-op — the worker never crashes.
 *
 * Usage:
 *   import { startWorker, stopWorker } from './pdfWorker.js';
 *   startWorker();   // called once on server startup
 */

import fs from 'node:fs/promises';
import { dequeuePdfJob, markJobCompleted, markJobFailed } from './pdfQueue.js';
import { ocrPdfBuffer, needsOcr } from '../backend/shared/scanner/pdfOcrHelper.js';
import { parseDD214, looksLikeDD214 } from '../backend/shared/scanner/dd214Scanner.js';
import { mapDD214ToStepOne } from '../backend/shared/scanner/dd214StepOneMapper.js';
import { scanCurrentTreatmentDeterministic } from '../backend/shared/scanner/currentTreatmentScanner.js';
import { scanVaDecisionWithMetadata, looksLikeRatingDecisionNarrative } from '../engine/vaSuperScannerAdapter.js';
import { extractPdfTextFromBuffer } from '../../utils/pdfTextExtractor.js';
import { scanSTRText, validateScanResult } from '../../engine/strs/index.js';

const DETERMINISTIC_SCAN_TIMESTAMP = '2000-01-01T00:00:00.000Z';

const POLL_INTERVAL_MS = Number(process.env.SCANNER_WORKER_POLL_INTERVAL_MS || 1000);
const WORKER_CONCURRENCY = Math.max(1, Number(process.env.SCANNER_PDF_WORKER_CONCURRENCY || 2));

let _pollTimer = null;
let _running = false;
let _activeJobs = 0;

async function _processJob(job) {
  const { jobId, source, fileMeta, payload } = job;
  console.log(`[PdfWorker] Processing job ${jobId} (source: ${source}, file: ${fileMeta?.fileName})`);

  const tempFilePath = payload?.tempFilePath;
  if (!tempFilePath) {
    throw new Error(`Job ${jobId} missing tempFilePath in payload`);
  }

  let buffer;
  try {
    buffer = await fs.readFile(tempFilePath);
  } catch (err) {
    throw new Error(`Failed to read temp file for job ${jobId}: ${err.message}`);
  }

  // Always delete the temp file, whether extraction succeeds or throws (B-02).
  try {
    const isStrSource = source === 'scan-str';
    const treatAsText = isStrSource && Boolean(payload?.isText);

    let extractedText = '';
    let numPages = 1;

    if (treatAsText) {
      extractedText = buffer.toString('utf-8');
    } else {
      const pdfExtraction = await extractPdfTextFromBuffer(buffer);
      extractedText = pdfExtraction.text;
      numPages = pdfExtraction.numPages;
    }

    let usedOcr = false;
    let ocrConfidence = null;
    if (!treatAsText && needsOcr(extractedText)) {
      console.log(`[PdfWorker] Job ${jobId} — text layer thin, falling back to OCR`);
      const ocrResult = await ocrPdfBuffer(buffer, { profile: source === 'scan-dd214' ? 'dd214' : 'default' });
      extractedText = ocrResult.text;
      usedOcr = true;
      ocrConfidence = ocrResult.ocrConfidence;
      numPages = ocrResult.pageCount;
    }

    let resultMeta;

    if (source === 'scan-dd214') {
      if (!looksLikeDD214(extractedText)) {
        throw new Error('Document does not appear to be a DD-214 or similar discharge document');
      }
      const dd214Data = parseDD214(extractedText);
      const mapping = mapDD214ToStepOne(dd214Data);
      resultMeta = {
        success: true,
        source: 'scan-dd214',
        extractionMeta: {
          ...dd214Data.extractionMeta,
          fileName: fileMeta?.fileName,
          fileSize: fileMeta?.fileSize,
          pagesScanned: numPages,
          usedOcr,
          ocrConfidence,
          processedAt: new Date().toISOString(),
        },
        dd214: dd214Data,
        stepOneMapping: mapping?.stepOneFields ?? null,
      };
    } else if (source === 'scan-current-treatment-pdf') {
      const currentTreatmentData = scanCurrentTreatmentDeterministic(extractedText);
      resultMeta = {
        success: true,
        source: 'scan-current-treatment-pdf',
        extractionMeta: {
          ...currentTreatmentData.extractionMeta,
          fileName: fileMeta?.fileName,
          fileSize: fileMeta?.fileSize,
          pagesScanned: numPages,
          usedOcr,
          ocrConfidence,
          processedAt: new Date().toISOString(),
        },
        currentTreatmentData,
      };
    } else if (source === 'scan-str') {
      const scanResult = scanSTRText(extractedText);
      const validation = validateScanResult(scanResult);

      if (!validation?.isValid) {
        throw new Error('STR schema validation failed during async processing');
      }

      resultMeta = {
        success: true,
        source: 'scan-str',
        result: {
          ...scanResult,
          Timestamp: DETERMINISTIC_SCAN_TIMESTAMP,
          metadata: {
            fileName: fileMeta?.fileName,
            fileSize: fileMeta?.fileSize,
            extractedLength: String(extractedText || '').length,
            isPdf: Boolean(payload?.isPdf),
            processedAt: DETERMINISTIC_SCAN_TIMESTAMP,
            aiAnalysisEnabled: false,
            processingMode: 'async',
          },
        },
        extractionMeta: {
          fileName: fileMeta?.fileName,
          fileSize: fileMeta?.fileSize,
          pagesScanned: numPages,
          usedOcr,
          ocrConfidence,
          extractedAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
        },
      };
    } else {
      if (!looksLikeRatingDecisionNarrative(extractedText)) {
        throw new Error('Document does not look like a VA Rating Decision narrative');
      }
      const scanResult = scanVaDecisionWithMetadata(extractedText, {
        logDiagnostics: true,
        requestId: jobId
      });
      resultMeta = {
        success: true,
        source: 'scan-pdf',
        extractionMeta: {
          fileName: fileMeta?.fileName,
          fileSize: fileMeta?.fileSize,
          pagesScanned: numPages,
          usedOcr,
          ocrConfidence,
          extractedAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
          executionTimeMs: scanResult._metadata?.executionTimeMs
        },
        scanData: scanResult,
      };
    }

    return resultMeta;
  } finally {
    await fs.unlink(tempFilePath).catch((err) => {
      console.warn(`[PdfWorker] Could not delete temp file: ${tempFilePath} — ${err.message}`);
    });
  }
}

async function _poll() {
  while (_running && _activeJobs < WORKER_CONCURRENCY) {
    const job = await dequeuePdfJob();
    if (!job) return;

    _activeJobs += 1;
    _processJob(job)
      .then(async (resultMeta) => {
        await markJobCompleted(job.jobId, resultMeta);
        console.log(`[PdfWorker] Job ${job.jobId} completed successfully`);
      })
      .catch(async (err) => {
        console.error(`[PdfWorker] Job ${job.jobId} failed: ${err.message}`);
        await markJobFailed(job.jobId, err.message);
      })
      .finally(() => {
        _activeJobs = Math.max(0, _activeJobs - 1);
        if (_running) {
          setImmediate(() => {
            _poll().catch(() => {});
          });
        }
      });
  }
}

/**
 * Start the worker polling loop.
 * Safe to call even when Redis is not available — each poll is a no-op until
 * Redis becomes ready.
 */
export function startWorker() {
  if (_running) return;
  _running = true;
  console.log(`[PdfWorker] Worker started — polling every ${POLL_INTERVAL_MS}ms (concurrency=${WORKER_CONCURRENCY})`);
  _poll().catch(() => {});
  _pollTimer = setInterval(() => { _poll().catch(() => {}); }, POLL_INTERVAL_MS);
}

/**
 * Stop the worker polling loop.
 */
export function stopWorker() {
  if (!_running) return;
  _running = false;
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
  console.log('[PdfWorker] Worker stopped');
}
