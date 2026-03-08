import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { asyncHandler } from "../utils/errors.js";
import {
  extractTextFromPdf,
  normalizeText,
  scanSTRText,
  validateScanResult
} from "../engine/strs/strs-engine.js";
import { analyzeMultipleConditions } from "../services/strsAiAnalyzerService.js";
import {
  submitPdfForProcessing,
  getJobStatus,
  getJobStatuses,
  getQueueStats
} from "../queue/pdfQueue.js";
import { optionalAuth } from "../middleware/auth.js";
import { createLogger } from "../middleware/logging.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = createLogger('strs-api');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const isPdf = file.mimetype === "application/pdf" || ext === ".pdf";
    const isText = file.mimetype === "text/plain" || ext === ".txt";
    if (!isPdf && !isText) {
      cb(new Error("Only PDF or TXT files are allowed"));
      return;
    }
    cb(null, true);
  }
});

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const router = express.Router();

/**
 * POST /api/strs/upload
 * Queue a PDF/TXT file for async processing
 * Returns job ID immediately for polling
 */
router.post(
  "/upload",
  optionalAuth,
  upload.single("strs"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No STRS file provided",
        code: "NO_FILE"
      });
    }

    const fileName = req.file.originalname || "strs";
    const extension = path.extname(fileName).toLowerCase();
    const isPdf = req.file.mimetype === "application/pdf" || extension === ".pdf";
    const isText = req.file.mimetype === "text/plain" || extension === ".txt";

    if (!isPdf && !isText) {
      return res.status(400).json({
        success: false,
        error: "Unsupported file type. Upload PDF or TXT.",
        code: "INVALID_FILE_TYPE"
      });
    }

    try {
      // Save file temporarily
      const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');
      await ensureDir(uploadsDir);
      
      const filePath = path.join(uploadsDir, `${Date.now()}-${fileName}`);
      await fs.writeFile(filePath, req.file.buffer);

      logger.info('File saved for processing', {
        veteranId: req.veteranId,
        fileName,
        fileSize: req.file.size,
        filePath
      });

      // Submit to queue (or fallback if queue unavailable)
      const result = await submitPdfForProcessing(
        filePath,
        fileName,
        req.veteranId
      );

      res.status(202).json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Failed to queue PDF', error, {
        veteranId: req.veteranId,
        fileName
      });

      return res.status(500).json({
        success: false,
        error: `Failed to process STRS file: ${error.message}`,
        code: 'PROCESSING_ERROR'
      });
    }
  })
);

/**
 * GET /api/strs/upload (Legacy - direct processing)
 * For backward compatibility, allows synchronous processing
 * (Not recommended for large files)
 */
router.post(
  "/upload-sync",
  optionalAuth,
  upload.single("strs"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No STRS file provided"
      });
    }

    const fileName = req.file.originalname || "strs";
    const extension = path.extname(fileName).toLowerCase();
    const isPdf = req.file.mimetype === "application/pdf" || extension === ".pdf";
    const isText = req.file.mimetype === "text/plain" || extension === ".txt";

    if (!isPdf && !isText) {
      return res.status(400).json({
        success: false,
        error: "Unsupported file type. Upload PDF or TXT."
      });
    }

    let extractedText = '';

    try {
      logger.info('Processing STRS synchronously', {
        fileName,
        fileSize: req.file.size,
        isPdf
      });
      
      if (isPdf) {
        extractedText = await extractTextFromPdf(req.file.buffer);
      } else {
        extractedText = req.file.buffer.toString('utf-8');
      }

      if (!extractedText || extractedText.trim().length === 0) {
        return res.status(422).json({
          success: false,
          error: 'File is empty or text could not be extracted'
        });
      }

      logger.debug('Text extracted', {
        textLength: extractedText.length,
        fileName
      });

      // DETERMINISTIC: Scan STR text using rule-based engine
      const scanResult = scanSTRText(extractedText);
      
      // Validate output schema compliance
      const validation = validateScanResult(scanResult);
      if (!validation.isValid) {
        logger.error('Schema validation failed', new Error('Validation error'), {
          errors: validation.errors
        });
        return res.status(500).json({
          success: false,
          error: 'Internal: invalid scan output schema',
          details: validation.errors
        });
      }

      // AI ANALYSIS: Analyze service connection for each condition (if enabled)
      let aiAnalyses = [];
      if (process.env.ANTHROPIC_API_KEY && scanResult.Extracted.Diagnoses.length > 0) {
        logger.info('Running AI analysis', {
          diagnoses: scanResult.Extracted.Diagnoses.length
        });
        try {
          aiAnalyses = await analyzeMultipleConditions(
            scanResult.Extracted.Diagnoses,
            scanResult.__rawText || extractedText,
            { fileName, fileSize: req.file.size }
          );
          logger.info('AI analysis complete', {
            analyzed: aiAnalyses.length
          });
        } catch (aiError) {
          logger.warning('AI analysis failed, continuing', aiError, {
            fileName
          });
        }
      }

      // Add file metadata
      const response = {
        ...scanResult,
        AIAnalysis: aiAnalyses,
        metadata: {
          fileName,
          fileSize: req.file.size,
          extractedLength: extractedText.length,
          isPdf,
          processedAt: new Date().toISOString(),
          aiAnalysisEnabled: aiAnalyses.length > 0,
          processingMode: 'sync'
        }
      };

      delete response.__rawText;

      logger.info('STRS scan complete', {
        diagnoses: response.Extracted.Diagnoses?.length || 0,
        injuries: response.Extracted.Injuries?.length || 0,
        opportunities: response.Analysis.ServiceConnectionOpportunities?.length || 0
      });

      res.json(response);

    } catch (error) {
      logger.error('Processing error', error, {
        fileName
      });
      
      return res.status(500).json({
        success: false,
        error: `Failed to process STRS file: ${error.message}`,
        parse_warnings: [error.message],
        Extracted: {
          Diagnoses: [],
          Injuries: [],
          Events: [],
          Medications: [],
          Procedures: [],
          Chronicity: {},
          Continuity: {}
        },
        Analysis: {
          DiagnosesFound: 0,
          InjuriesFound: 0,
          EventsFound: 0,
          ChronicConditions: 0,
          MedicationsFound: 0,
          ProceduresFound: 0,
          ServiceConnectionOpportunities: [],
          Flags: ['Processing error']
        },
        NLP: {},
        Timestamp: new Date().toISOString()
      });
    }
  })
);

/**
 * GET /api/strs/status/:jobId
 * Get job status and progress
 */
router.get(
  "/status/:jobId",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    try {
      const status = await getJobStatus(jobId);
      res.json({
        success: true,
        ...status
      });
    } catch (error) {
      logger.error('Failed to get job status', error);
      res.status(503).json({
        success: false,
        error: 'Job queue service unavailable. Redis connection required.',
        code: 'QUEUE_UNAVAILABLE'
      });
    }
  })
);

/**
 * POST /api/strs/status/batch
 * Get multiple job statuses at once
 */
router.post(
  "/status/batch",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { jobIds } = req.body;

    if (!Array.isArray(jobIds)) {
      return res.status(400).json({
        success: false,
        error: 'jobIds must be an array'
      });
    }

    try {
      const statuses = await getJobStatuses(jobIds);
      res.json({
        success: true,
        jobs: statuses
      });
    } catch (error) {
      logger.error('Failed to get batch job statuses', error);
      res.status(503).json({
        success: false,
        error: 'Job queue service unavailable. Redis connection required.',
        code: 'QUEUE_UNAVAILABLE'
      });
    }
  })
);

/**
 * GET /api/strs/queue/stats
 * Get queue statistics
 */
router.get(
  "/queue/stats",
  optionalAuth,
  asyncHandler(async (req, res) => {
    try {
      const stats = await getQueueStats();
      res.json({
        success: true,
        queue: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get queue stats', error);
      res.status(503).json({
        success: false,
        error: 'Job queue service unavailable. Redis connection required.',
        code: 'QUEUE_UNAVAILABLE',
        message: 'To enable async PDF processing, start Redis: docker run -d -p 6379:6379 redis:7'
      });
    }
  })
);

// Health check endpoint
router.get(
  "/health",
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      status: "ok",
      engine: "JavaScript STRS deterministic engine with async queue",
      version: "2.0.0",
      time: new Date().toISOString()
    });
  })
);

export default router;


