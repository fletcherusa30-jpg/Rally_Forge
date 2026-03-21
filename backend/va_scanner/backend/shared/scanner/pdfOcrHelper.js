/**
 * PDF OCR Helper v2.0 - Advanced Preprocessing per .copilot-instructions.md
 *
 * Converts scanned PDF pages to images via Ghostscript, then OCRs with
 * Tesseract.js.  Enhanced preprocessing for deterministic text cleaning.
 *
 * Used when pdfjs-dist text extraction returns empty/near-empty text
 * (i.e. the PDF is a scanned image with no text layer).
 */

import { createWorker } from 'tesseract.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { preprocessImageForOcr } from './dd214ImageEnhancement.js';

const execFileAsync = promisify(execFile);

const OCR_PROFILES = {
  default: {
    name: 'default',
    dpi: 200,
    renderDevice: 'pnggray',
    textAlphaBits: 4,
    graphicsAlphaBits: 4,
    pageSegModes: [6],
  },
  dd214: {
    name: 'dd214',
    dpi: 300,
    renderDevice: 'pnggray',
    textAlphaBits: 4,
    graphicsAlphaBits: 4,
    pageSegModes: [6, 11],
  },
  ratingdecision: {
    name: 'ratingDecision',
    dpi: 300,
    renderDevice: 'pnggray',
    textAlphaBits: 4,
    graphicsAlphaBits: 4,
    pageSegModes: [4, 6, 11],
  },
};

const GS_PATHS = [
  'gswin64c',
  'gswin32c',
  'gs',
  'C:\\Program Files\\gs\\gs10.06.0\\bin\\gswin64c.exe',
  'C:\\Program Files (x86)\\gs\\gs10.06.0\\bin\\gswin32c.exe',
];

// Cache Ghostscript path after first successful probe so subsequent requests don't re-probe.
let _cachedGsPath = null;

async function findGhostscript() {
  if (_cachedGsPath) return _cachedGsPath;
  for (const gsPath of GS_PATHS) {
    try {
      await execFileAsync(gsPath, ['--version'], { timeout: 5000 });
      _cachedGsPath = gsPath;
      return gsPath;
    } catch {
      // continue
    }
  }
  return null;
}

/**
 * Render PDF buffer pages to PNG files using Ghostscript.
 * Returns an array of PNG file paths (caller is responsible for cleanup).
 */
function getOcrProfile(opts = {}) {
  const requestedName = String(opts.profile || 'default').toLowerCase();
  const baseProfile = OCR_PROFILES[requestedName] || OCR_PROFILES.default;
  return {
    ...baseProfile,
    dpi: Number.isFinite(Number(opts.dpi)) ? Number(opts.dpi) : baseProfile.dpi,
  };
}

async function renderPdfToImages(pdfBuffer, { dpi = 200, renderDevice = 'pnggray', textAlphaBits = 4, graphicsAlphaBits = 4 } = {}) {
  const gsPath = await findGhostscript();
  if (!gsPath) throw new Error('Ghostscript not found — cannot OCR scanned PDFs');

  const tmpDir = path.join(os.tmpdir(), 'rf_ocr_' + crypto.randomBytes(6).toString('hex'));
  fs.mkdirSync(tmpDir, { recursive: true });

  const pdfPath = path.join(tmpDir, 'input.pdf');
  const outPattern = path.join(tmpDir, 'page_%d.png');

  fs.writeFileSync(pdfPath, pdfBuffer);

  await execFileAsync(gsPath, [
    `-sDEVICE=${renderDevice}`,
    `-r${dpi}`,
    `-dTextAlphaBits=${textAlphaBits}`,
    `-dGraphicsAlphaBits=${graphicsAlphaBits}`,
    '-dAlignToPixels=0',
    '-dGridFitTT=2',
    '-dNOPAUSE',
    '-dBATCH',
    '-dSAFER',
    '-dUseCropBox',
    `-sOutputFile=${outPattern}`,
    pdfPath,
  ], { timeout: 120_000 });

  const files = fs.readdirSync(tmpDir)
    .filter((f) => f.startsWith('page_') && f.endsWith('.png'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0]);
      const numB = parseInt(b.match(/\d+/)[0]);
      return numA - numB;
    })
    .map((f) => path.join(tmpDir, f));

  return { files, tmpDir };
}

/**
 * Pre-process OCR output for deterministic text cleaning.
 * @param {string} rawOcrText - Raw OCR output from Tesseract
 * @returns {string} Cleaned, normalized text
 */
function preprocessOcrOutput(rawOcrText) {
  if (!rawOcrText || typeof rawOcrText !== 'string') return '';
  
  let cleaned = rawOcrText
    // Remove zero-width chars
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Normalize whitespace
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    // Normalize continuation cues and label drift common in OCR output
    .replace(/\bCONT\s+IN\s+BLOCK\s*(\d+)/gi, 'CONT FROM BLOCK $1')
    .replace(/\bperlods\b/gi, 'periods')
    .replace(/\bAUTH0RIZED\b/g, 'AUTHORIZED')
    .replace(/\bRIBB0NS\b/g, 'RIBBONS')
    // Fix common OCR misrecognitions
    .replace(/\bl\s*0\s*(?=\d)/g, '10')  // "l 0" → "10"
    .replace(/(?<=\d)\s*o\s*(?=%)/g, '0') // "7 o %" → "70%"
    // Clean excessive line breaks
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return cleaned;
}

function scoreOcrCandidate(text, confidence, profileName) {
  const normalized = preprocessOcrOutput(text);
  const alphaNumCount = (normalized.match(/[A-Z0-9]/gi) || []).length;
  const lineCount = normalized.split(/\n+/).filter(Boolean).length;
  const dd214Signals = profileName === 'dd214'
    ? (normalized.match(/\b(?:DD\s*FORM\s*214|DATE\s+ENTERED|SEPARATION\s+DATE|PRIMARY\s+SPECIALTY|CHARACTER\s+OF\s+SERVICE|SEPARATION\s+AUTHORITY|REENTRY\s+CODE|NARRATIVE\s+REASON)\b/gi) || []).length
    : 0;

  return Number(confidence || 0)
    + Math.min(alphaNumCount / 40, 18)
    + Math.min(lineCount, 12)
    + (dd214Signals * 4);
}

async function recognizePageWithFallback(worker, imageBuffer, profile) {
  // Apply image enhancement for better OCR quality on degraded scans
  let enhancementResult = null;
  let processedImageBuffer = imageBuffer;
  
  try {
    enhancementResult = preprocessImageForOcr(imageBuffer, profile.name);
    processedImageBuffer = enhancementResult.enhanced;
  } catch (err) {
    // Enhancement is optional; if it fails, continue with original image
    console.warn('[OCR] Image enhancement failed, continuing with original:', err.message);
  }

  const candidates = [];

  for (const pageSegMode of profile.pageSegModes) {
    await worker.setParameters({
      tessedit_pageseg_mode: pageSegMode,
      preserve_interword_spaces: '1',
      user_defined_dpi: String(profile.dpi),
      tessedit_do_invert: '0',
    });

    const result = await worker.recognize(processedImageBuffer);
    candidates.push({
      text: result.data.text,
      confidence: Number(result.data.confidence || 0),
      score: scoreOcrCandidate(result.data.text, result.data.confidence, profile.name),
      pageSegMode,
      imageQuality: enhancementResult?.qualityAssessment,
      appliedEnhancements: enhancementResult?.appliedEnhancements,
    });
  }

  return candidates.sort((left, right) => right.score - left.score)[0];
}

/**
 * OCR a PDF buffer with v2 preprocessing.
 *
 * @param {Buffer} pdfBuffer - Raw PDF bytes
 * @param {object} [opts]
 * @param {number} [opts.dpi=150] - Render resolution (150 dpi is sufficient for text extraction and ~4x faster than 300)
 * @returns {{ text: string, pageCount: number, ocrConfidence: number }}
 */
export async function ocrPdfBuffer(pdfBuffer, opts = {}) {
  const profile = getOcrProfile(opts);
  const { files, tmpDir } = await renderPdfToImages(pdfBuffer, profile);

  if (files.length === 0) {
    cleanupTmpDir(tmpDir);
    return { text: '', pageCount: 0, ocrConfidence: 0, profile: profile.name };
  }

  let fullText = '';
  let totalConfidence = 0;
  let imageEnhancementApplied = false;
  let qualityAssessments = [];
  const worker = await createWorker('eng');

  try {
    for (const filePath of files) {
      const imgBuffer = fs.readFileSync(filePath);
      const result = await recognizePageWithFallback(worker, imgBuffer, profile);
      fullText += result.text + '\n\n';
      totalConfidence += result.confidence;
      
      if (result.appliedEnhancements) {
        imageEnhancementApplied = true;
        qualityAssessments.push({
          quality: result.imageQuality?.quality,
          confidence: result.imageQuality?.confidence,
          appliedEnhancements: result.appliedEnhancements,
        });
      }
    }
  } finally {
    await worker.terminate();
    cleanupTmpDir(tmpDir);
  }

  return {
    text: preprocessOcrOutput(fullText).trim(),
    pageCount: files.length,
    ocrConfidence: files.length > 0 ? totalConfidence / files.length : 0,
    preprocessingApplied: true,
    scannerVersion: '3.0.0',
    profile: profile.name,
    imageEnhancementApplied,
    qualityAssessments: imageEnhancementApplied ? qualityAssessments : undefined,
  };
}

function cleanupTmpDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // non-fatal
  }
}

/**
 * Returns true when pdfjs text extraction yielded too little content
 * to be useful (likely a scanned/image PDF).
 */
export function needsOcr(extractedText) {
  const stripped = String(extractedText || '').replace(/\s+/g, '').trim();
  return stripped.length < 50;
}
