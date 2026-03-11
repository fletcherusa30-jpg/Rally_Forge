import express from "express";
import multer from "multer";
import fs from "fs/promises";

// Polyfill for Promise.withResolvers (required for Node.js < 22)
// This is needed by pdfjs-dist
if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { asyncHandler } from "../../core/index.js";
import { getLatestNewScannerOutput } from "./services/newScannerService.js";
import { recordScan, getScanHistory, getScanStatistics } from "./services/scanHistoryService.js";
import { scanVaDecision, looksLikeRatingDecisionNarrative } from "../engine/vaSuperScanner.js";
import { performComprehensiveValidation, getFlaggedItems } from "../engine/cfrValidation.js";
import { ExtractionScorer } from "../engine/confidenceScorer.js";
import { compensationEngine } from "../../domain/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure PDF.js worker for Node.js environment
const workerPath = path.resolve(__dirname, '../../../node_modules/pdfjs-dist/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

// Configure multer for file uploads (store in memory for processing)
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

const router = express.Router();

// Path for latest scan result
const LATEST_SCAN_PATH = path.join(__dirname, 'data/latest_scan.json');

/**
 * Save latest scan result for financial planner access
 */
async function saveLatestScan(scanData, compensation) {
  try {
    const latestScan = {
      timestamp: new Date().toISOString(),
      veteranName: scanData.metadata?.veteranName || 'Unknown',
      fileNumber: scanData.metadata?.fileNumber || 'Unknown',
      decisionDate: scanData.metadata?.decisionDate || null,
      effectiveDate: scanData.metadata?.effectiveDate || null,
      combinedRating: scanData.ratingCalculation?.calculatedCombinedRating || 0,
      serviceConnectedConditions: scanData.serviceConnected?.length || 0,
      compensation: compensation,
      dependents: scanData.dependents || {},
      metadata: scanData.metadata || {}
    };
    
    // Ensure directory exists
    const dir = path.dirname(LATEST_SCAN_PATH);
    await fs.mkdir(dir, { recursive: true });
    
    // Write to file
    await fs.writeFile(LATEST_SCAN_PATH, JSON.stringify(latestScan, null, 2));
    console.log('[Scanner API] Saved latest scan to', LATEST_SCAN_PATH);
  } catch (error) {
    console.error('[Scanner API] Failed to save latest scan:', error.message);
  }
}

/**
 * Extract compensation data from scan results
 * Handles missing or invalid data gracefully
 */
function calculateCompensation(scanData) {
  if (!scanData || !scanData.ratingCalculation) {
    return {
      success: false,
      error: "No rating data available for compensation calculation"
    };
  }

  try {
    const rating = scanData.ratingCalculation.calculatedCombinedRating;
    const effectiveDate = scanData.metadata?.effectiveDate;
    const dependents = scanData.dependents || {};
    const smcCode = scanData.smc?.code || null;

    // Validate required rating
    if (rating === null || rating === undefined || rating < 0 || rating > 100) {
      return {
        success: false,
        error: "Invalid or missing combined rating"
      };
    }

    // Normalize dependent count (VA uses binary spouse, count for children/parents)
    const dependentConfig = {
      spouse: dependents.spouse ? 1 : 0,
      children: dependents.dependentChildren || 0,
      parents: dependents.dependentParents || 0
    };

    // Build compensation input
    const compensationInput = {
      rating: Math.round(rating / 10) * 10, // Ensure 10% increments
      dependents: dependentConfig,
      smcCode: smcCode || null,
      effectiveDate: effectiveDate || null,
      ancillary: {
        aidAndAttendance: scanData.ancillaryBenefits?.some(b => /aid.*attendance|a&a/i.test(b.description)) || false,
        housebound: scanData.ancillaryBenefits?.some(b => /housebound/i.test(b.description)) || false
      }
    };

    // Calculate compensation
    const compensation = compensationEngine.calculateVeteran(compensationInput);

    return {
      success: true,
      compensation: compensation,
      input: compensationInput,
      ratedConditions: scanData.serviceConnected?.length || 0
    };
  } catch (error) {
    console.error("[Compensation Engine Error]", error.message);
    return {
      success: false,
      error: `Compensation calculation failed: ${error.message}`
    };
  }
}

function scanServiceTreatmentRecords(text) {
  const start = Date.now();
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const conditions = [];
  const seen = new Set();

  const pushCondition = (value) => {
    const clean = String(value || "")
      .replace(/^[\-•*\d\.\)\(\s]+/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean || clean.length < 3 || clean.length > 140) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    conditions.push({
      condition: clean,
      percentage: 0,
      rating: "0%",
      effectiveDate: null,
      source: "STR"
    });
  };

  const extractPatterns = [
    /(?:assessment|impression|diagnosis|diagnoses|problem list|chief complaint)\s*[:\-]\s*(.+)$/i,
    /(?:history of|hx of)\s+(.+)$/i,
    /(?:treated for|seen for|complains? of|complaint of)\s+(.+)$/i
  ];

  lines.forEach((line) => {
    for (const pattern of extractPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const parts = match[1].split(/[,;]|\band\b/i).map((part) => part.trim()).filter(Boolean);
        parts.forEach(pushCondition);
      }
    }
  });

  const evidence = lines
    .filter((line) => /assessment|impression|diagnosis|problem list|complaint|history of|treated for/i.test(line))
    .slice(0, 50);

  return {
    scannerVersion: "3.2.0-str",
    metadata: {
      documentType: "serviceTreatmentRecords",
      ratingDecisionDate: null,
      effectiveDate: null,
      allEffectiveDates: []
    },
    serviceConnected: conditions,
    denied: [],
    ancillaryBenefits: [],
    smc: { explicit: [], inferred: [], summary: { hasAnySMC: false } },
    dependents: [],
    payments: [],
    evidence,
    evidenceByType: {
      "Service Treatment Records": evidence
    },
    ratingCalculation: null,
    extractionSummary: {
      totalServiceConnected: conditions.length,
      totalDenied: 0,
      totalAncillary: 0,
      totalDependents: 0,
      totalPayments: 0,
      totalEvidence: evidence.length,
      totalItems: conditions.length + evidence.length,
      executionTime: Date.now() - start,
      extractedAt: new Date().toISOString(),
      evidenceByTypeCount: evidence.length > 0 ? 1 : 0
    }
  };
}

router.get(
  "/scanner/latest",
  asyncHandler(async (req, res) => {
    const data = await getLatestNewScannerOutput();
    res.json({ success: true, data });
  })
);

router.post(
  "/scanner/scan-text",
  asyncHandler(async (req, res) => {
    const start = Date.now();
    const text = req.body?.text || "";
    const scanType = req.body?.scanType || "ratingDecision";
    const isServiceRecords = scanType === "serviceRecords";
    
    console.log("[Scanner API] POST /scanner/scan-text RECEIVED - requestId:", req.requestId, "textLength:", text.length);
    console.log("[Scanner API] Payload size:", JSON.stringify(req.body).length, "bytes");
    console.log("[Scanner API] First 200 chars:", text.substring(0, 200).replace(/\n/g, ' '));
    
    // === ENHANCED INPUT VALIDATION ===
    
    // Type validation
    if (text === null || text === undefined || typeof text !== 'string') {
      console.warn("[Scanner API] Invalid text type:", typeof text);
      return res.status(400).json({
        success: false,
        error: "Invalid input: text must be a string",
        details: {
          providedType: typeof text,
          expectedType: "string"
        }
      });
    }
    
    // Length validation
    const trimmedLength = text.trim().length;
    if (trimmedLength === 0) {
      console.warn("[Scanner API] Empty text provided");
      return res.status(400).json({
        success: false,
        error: "No text provided. Please paste or upload a VA rating decision.",
        hint: "Make sure you're pasting the actual decision text, not a file path."
      });
    }
    
    if (trimmedLength < 20) {
      console.warn("[Scanner API] Text too short:", trimmedLength, "chars");
      return res.status(400).json({
        success: false,
        error: "Text is too short to be a valid VA decision.",
        details: {
          providedLength: trimmedLength,
          minimumRequired: 20,
          hint: "A typical VA Rating Decision is several pages long. Please check your input."
        }
      });
    }
    
    // Maximum length check (prevent DoS)
    const MAX_TEXT_LENGTH = 5 * 1024 * 1024; // 5MB of text
    if (text.length > MAX_TEXT_LENGTH) {
      console.warn("[Scanner API] Text too large:", text.length, "bytes");
      return res.status(413).json({
        success: false,
        error: "Text input exceeds maximum size",
        details: {
          providedSize: text.length,
          maxSize: MAX_TEXT_LENGTH,
          hint: "If you have a very large PDF, try uploading it directly instead of pasting text."
        }
      });
    }

    // Binary content detection
    const nonPrintable = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length;
    const printable = (text.match(/[\x20-\x7E]/g) || []).length;
    const printableRatio = printable / Math.max(1, printable + nonPrintable);
    const looksLikePdfBinary = /FlateDecode|endstream|endobj|xref|\/Filter\//i.test(text);
    
    console.log("[Scanner API] Binary check - printable ratio:", printableRatio.toFixed(2), "looks like PDF binary:", looksLikePdfBinary);
    
    if (printableRatio < 0.85 || looksLikePdfBinary) {
     console.warn("[Scanner API] Rejected - binary content");
      return res.status(400).json({
        success: false,
        error: "Input appears to be raw PDF/binary data, not readable text.",
        hint: "Please upload the PDF file directly, or use a PDF reader to copy the text content.",
        details: {
          printableRatio: printableRatio.toFixed(2),
          detectsBinaryMarkers: looksLikePdfBinary
        }
      });
    }

    // Document type validation (only enforce rating-decision checks for rating-decision scans)
    if (!isServiceRecords) {
      console.log("[Scanner API] Checking if looks like rating decision...");
      if (!looksLikeRatingDecisionNarrative(text)) {
        console.warn("[Scanner API] Rejected - not a rating decision");
        return res.status(422).json({
          success: false,
          error: "This document doesn't appear to be a VA Rating Decision.",
          hint: "Make sure you're uploading a Rating Decision letter, not an appeal form (NOD), claim form, or other VA document.",
          expectedIndicators: "Look for phrases like 'Service connection for...is granted', 'Combined rating', or 'Decision Date'"
        });
      }
    }

    // === PROCESSING ===
    console.log("[Scanner API] Validation passed. Running scanner for scanType:", scanType);
    let data;
    try {
      data = isServiceRecords ? scanServiceTreatmentRecords(text) : scanVaDecision(text);
      console.log("[Scanner API] Scanner returned successfully - items extracted:", data?.extractionSummary?.totalItems || 0);
    } catch (error) {
      console.error("[Scanner API] Scanner threw error:", error.message);
      console.error("[Scanner API] Error stack:", error.stack);
      console.error(JSON.stringify({
        level: "error",
        event: "scanner_failure",
        message: error.message,
        timestamp: new Date().toISOString()
      }));
      return res.status(500).json({
        success: false,
        error: `Scanner processing failed: ${error.message}`,
        hint: "This might be a formatting issue with the document. Try uploading the PDF directly if you pasted text.",
        support: "If this persists, please report the issue with a sample of your document."
      });
    }
    
    // Record scan in history
    try {
      await recordScan(text, data);
      console.log("[Scanner API] Scan recorded to history");
    } catch (error) {
      console.error('[Scanner API] Failed to record scan:', error.message);
      // Don't fail the request if history fails
    }

    console.log(JSON.stringify({
      level: "info",
      event: "scanner_success",
      extractedItems: data?.extractionSummary?.totalItems || 0,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString()
    }));
    
    // Add comprehensive validation and confidence scoring for rating decisions only
    const validation = isServiceRecords ? null : performComprehensiveValidation(data);
    const confidenceReport = isServiceRecords ? null : ExtractionScorer.generateConfidenceReport(data);
    const flaggedItems = isServiceRecords ? [] : getFlaggedItems(validation);
    
    if (!isServiceRecords && confidenceReport) {
      console.log("[Scanner API] Validation complete - Overall Confidence:", confidenceReport.overallConfidence + "%");
    }
    console.log("[Scanner API] Flagged items:", flaggedItems.length);
    console.log("[Scanner API] Returning success response - duration:", Date.now() - start, "ms");
    
    // Calculate compensation for rating decisions only
    const compensation = isServiceRecords ? null : calculateCompensation(data);
    
    // Save latest scan for financial planner (rating decisions only)
    if (!isServiceRecords) {
      await saveLatestScan(data, compensation);
    }
    
    res.json({ 
      success: true, 
      data,
      compensation: compensation,
      quality: {
        validation,
        confidence: confidenceReport,
        flaggedItems,
        warnings: confidenceReport?.qualityFlags || []
      },
      processingTime: {
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString()
      }
    });
  })
);

// PDF file upload and scan endpoint
router.post(
  "/scanner/scan-pdf",
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const start = Date.now();
    const scanType = req.body?.scanType || "ratingDecision";
    const isServiceRecords = scanType === "serviceRecords";
    
    if (!req.file) {
      console.warn("[Scanner API] POST /scanner/scan-pdf - No file provided");
      return res.status(400).json({
        success: false,
        error: "No PDF file provided"
      });
    }

    console.log("[Scanner API] POST /scanner/scan-pdf RECEIVED - requestId:", req.requestId, "fileName:", req.file.originalname, "fileSize:", req.file.size);
    console.log("[Scanner API] PDF payload size:", req.file.size, "bytes");
    
    try {
      // Validate PDF buffer
      if (!req.file.buffer || req.file.buffer.length === 0) {
        console.error("[Scanner API] PDF buffer is empty");
        return res.status(400).json({
          success: false,
          error: "PDF file is empty or corrupted"
        });
      }
      
      // Extract text from PDF
      console.log("[Scanner API] Extracting text from PDF...");
      const pdfBuffer = req.file.buffer;
      const pdfData = new Uint8Array(pdfBuffer);
      
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
      let extractedText = '';
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        extractedText += pageText + '\n\n';
        console.log(`[Scanner API] Extracted page ${pageNum} of ${pdf.numPages}`);
      }
      
      console.log(`[Scanner API] PDF extraction complete - ${extractedText.length} chars extracted`);
      console.log("[Scanner API] PDF extraction succeeded: YES");
      console.log("[Scanner API] First 200 chars of extracted text:", extractedText.substring(0, 200).replace(/\n/g, ' '));
      
      // Validate extracted text
      if (extractedText === null || extractedText === undefined || typeof extractedText !== 'string') {
        console.error("[Scanner API] PDF extraction returned invalid type:", typeof extractedText);
        return res.status(500).json({
          success: false,
          error: "PDF text extraction failed - invalid result type"
        });
      }
      
      if (!extractedText || extractedText.trim().length < 20) {
        console.warn("[Scanner API] Extracted text too short:", extractedText.length);
        return res.status(400).json({
          success: false,
          error: "PDF does not contain sufficient readable text (minimum 20 characters required)"
        });
      }
      
      if (!isServiceRecords) {
        console.log("[Scanner API] Checking if looks like rating decision...");
        if (!looksLikeRatingDecisionNarrative(extractedText)) {
          console.warn("[Scanner API] Rejected - not a rating decision");
          return res.status(422).json({
            success: false,
            error: "This document does not look like a VA Rating Decision narrative. Please upload the rating decision, not an appeal form."
          });
        }
      }
      
      console.log("[Scanner API] Validation passed. Running scanner for scanType:", scanType);
      let data;
      try {
        data = isServiceRecords ? scanServiceTreatmentRecords(extractedText) : scanVaDecision(extractedText);
        console.log("[Scanner API] Scanner returned successfully - items extracted:", data?.extractionSummary?.totalItems || 0);
      } catch (error) {
        console.error("[Scanner API] Scanner threw error:", error.message);
        console.error("[Scanner API] Error stack:", error.stack);
        return res.status(500).json({
          success: false,
          error: `Scanner processing failed: ${error.message}`
        });
      }
      
      // Record scan in history
      try {
        await recordScan(extractedText, data);
        console.log("[Scanner API] Scan recorded to history");
      } catch (error) {
        console.error('[Scanner API] Failed to record scan:', error.message);
        // Don't fail the request if history fails
      }
      
      console.log(JSON.stringify({
        level: "info",
        event: "pdf_scan_success",
        fileName: req.file.originalname,
        extractedItems: data?.extractionSummary?.totalItems || 0,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString()
      }));
      
      // Add comprehensive validation and confidence scoring for rating decisions only
      const validation = isServiceRecords ? null : performComprehensiveValidation(data);
      const confidenceReport = isServiceRecords ? null : ExtractionScorer.generateConfidenceReport(data);
      const flaggedItems = isServiceRecords ? [] : getFlaggedItems(validation);
      
      if (!isServiceRecords && confidenceReport) {
        console.log("[Scanner API] Validation complete - Overall Confidence:", confidenceReport.overallConfidence + "%");
      }
      console.log("[Scanner API] Flagged items:", flaggedItems.length);
      console.log("[Scanner API] Returning success response - duration:", Date.now() - start, "ms");
      
      // Calculate compensation for rating decisions only
      const compensation = isServiceRecords ? null : calculateCompensation(data);
      
      // Save latest scan for financial planner (rating decisions only)
      if (!isServiceRecords) {
        await saveLatestScan(data, compensation);
      }
      
      res.json({ 
        success: true, 
        data,
        compensation: compensation,
        quality: {
          validation,
          confidence: confidenceReport,
          flaggedItems,
          warnings: confidenceReport?.qualityFlags || []
        },
        processingTime: {
          durationMs: Date.now() - start,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error("[Scanner API] PDF processing error:", error.message);
      console.error("[Scanner API] Error stack:", error.stack);
      console.error(JSON.stringify({
        level: "error",
        event: "pdf_scan_failure",
        message: error.message,
        timestamp: new Date().toISOString()
      }));
      
      // Ensure we always return JSON, never HTML
      return res.status(500).json({
        success: false,
        error: `Failed to process PDF: ${error.message}`
      });
    }
  })
);

// Get scan history
router.get(
  "/scanner/history",
  asyncHandler(async (req, res) => {
    const options = {
      veteranName: req.query.veteranName,
      fileNumber: req.query.fileNumber,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: parseInt(req.query.limit) || 100
    };
    
    const history = await getScanHistory(options);
    res.json({ success: true, ...history });
  })
);

// Get scan statistics
router.get(
  "/scanner/statistics",
  asyncHandler(async (req, res) => {
    const stats = await getScanStatistics();
    res.json({ success: true, statistics: stats });
  })
);

// Export scan results
router.post(
  "/scanner/export/:format",
  asyncHandler(async (req, res) => {
    const { format } = req.params;
    const { scanResults, fileName } = req.body;
    
    if (!scanResults) {
      return res.status(400).json({
        success: false,
        error: 'scanResults required'
      });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const safeName = `${(fileName || 'scan_results').replace(/[^a-zA-Z0-9-_]/g, '_')}_${timestamp}`;
    
    let content, mimeType, extension;
    
    switch (format.toLowerCase()) {
      case 'json':
        content = JSON.stringify(scanResults, null, 2);
        mimeType = 'application/json';
        extension = 'json';
        break;
        
      case 'csv': {
        const lines = [];
        lines.push('Category,Item,Value,Details,Effective Date');
        
        const scConditions = scanResults.serviceConnected?.conditions || scanResults.serviceConnected || [];
        scConditions.forEach(cond => {
          const name = (cond.condition || '').replace(/"/g, '""');
          const date = (cond.effectiveDate || 'N/A').replace(/"/g, '""');
          lines.push(`Service-Connected,"${name}",${cond.percentage}%,,"${date}"`);
        });
        
        const deniedConditions = scanResults.denied?.conditions || scanResults.denied || [];
        deniedConditions.forEach(cond => {
          const name = (cond.condition || '').replace(/"/g, '""');
          const reason = (cond.reason || '').replace(/"/g, '""');
          lines.push(`Denied,"${name}",,"${reason}",`);
        });
        
        content = lines.join('\n');
        mimeType = 'text/csv';
        extension = 'csv';
        break;
      }
        
      case 'txt':
      case 'text': {
        const reportLines = [];
        reportLines.push('='.repeat(80));
        reportLines.push('VA DECISION LETTER - SCAN RESULTS');
        reportLines.push('='.repeat(80));
        reportLines.push('');
        
        if (scanResults.metadata) {
          reportLines.push(`Veteran: ${scanResults.metadata.veteranName || 'Unknown'}`);
          reportLines.push(`File Number: ${scanResults.metadata.fileNumber || 'Unknown'}`);
          reportLines.push(`Combined Rating: ${scanResults.metadata.combinedRating || 'Unknown'}%`);
          reportLines.push('');
        }
        
        const scConditions = scanResults.serviceConnected?.conditions || scanResults.serviceConnected || [];
        if (scConditions.length > 0) {
          reportLines.push(`SERVICE-CONNECTED CONDITIONS (${scConditions.length}):`);
          scConditions.forEach((cond, i) => {
            reportLines.push(`  ${i + 1}. ${cond.condition} - ${cond.percentage}%`);
          });
          reportLines.push('');
        }
        
        content = reportLines.join('\n');
        mimeType = 'text/plain';
        extension = 'txt';
        break;
      }
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid format',
          validFormats: ['json', 'csv', 'txt']
        });
    }
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.${extension}"`);
    res.send(content);
  })
);

// Test endpoint to confirm backend is running
router.get(
  "/scanner/test",
  (req, res) => {
    console.log("[Scanner Test] GET /scanner/test - ping from backend");
    res.json({
      success: true,
      message: "scanner OK",
      scannerVersion: "3.2.0-bilateral",
      timestamp: new Date().toISOString()
    });
  }
);

export default router;

