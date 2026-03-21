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
import { isRedisAvailable } from '../../config/redisConfig.js';
import { dequeuePdfJob, markJobCompleted, markJobFailed } from './pdfQueue.js';
import { ocrPdfBuffer, needsOcr } from '../backend/shared/scanner/pdfOcrHelper.js';
import { parseDD214, looksLikeDD214 } from '../backend/shared/scanner/dd214Scanner.js';
import { mapDD214ToStepOne } from '../backend/shared/scanner/dd214StepOneMapper.js';
import { scanVaDecision, looksLikeRatingDecisionNarrative } from '../engine/vaSuperScanner.js';
import { extractPdfTextFromBuffer } from '../../utils/pdfTextExtractor.js';

const POLL_INTERVAL_MS = 2000;

let _pollTimer = null;
let _running = false;

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

  let { text: extractedText, numPages } = await extractPdfTextFromBuffer(buffer);

  let usedOcr = false;
  let ocrConfidence = null;
  if (needsOcr(extractedText)) {
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
  } else {
    if (!looksLikeRatingDecisionNarrative(extractedText)) {
      throw new Error('Document does not look like a VA Rating Decision narrative');
    }
    const scanData = scanVaDecision(extractedText);
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
      },
      scanData,
    };
  }

  try {
    await fs.unlink(tempFilePath);
  } catch {
    console.warn(`[PdfWorker] Could not delete temp file: ${tempFilePath}`);
  }

  return resultMeta;
}

async function _poll() {
  if (!isRedisAvailable()) return;

  const job = await dequeuePdfJob();
  if (!job) return;

  try {
    const resultMeta = await _processJob(job);
    await markJobCompleted(job.jobId, resultMeta);
    console.log(`[PdfWorker] Job ${job.jobId} completed successfully`);
  } catch (err) {
    console.error(`[PdfWorker] Job ${job.jobId} failed: ${err.message}`);
    await markJobFailed(job.jobId, err.message);
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
  console.log(`[PdfWorker] Worker started — polling every ${POLL_INTERVAL_MS}ms`);
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
