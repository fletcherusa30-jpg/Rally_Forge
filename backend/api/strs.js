import express from "express";
import multer from "multer";
import path from "path";
import { asyncHandler } from "../core/index.js";
import { optionalAuth } from "../middleware/auth.js";
import {
  uploadStrs,
  uploadStrsSync,
  getStrsJobStatus,
  getStrsBatchJobStatus,
  getStrsQueueStats,
  getStrsHealth,
} from "../controllers/strsController.js";
import {
  submitStrsFeedback,
  getRecentStrsFeedback,
  getStrsFeedbackSummary,
} from '../controllers/strsFeedbackController.js';

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
  asyncHandler(uploadStrs)
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
  asyncHandler(uploadStrsSync)
);

/**
 * GET /api/strs/status/:jobId
 * Get job status and progress
 */
router.get(
  "/status/:jobId",
  optionalAuth,
  asyncHandler(getStrsJobStatus)
);

/**
 * POST /api/strs/status/batch
 * Get multiple job statuses at once
 */
router.post(
  "/status/batch",
  optionalAuth,
  asyncHandler(getStrsBatchJobStatus)
);

/**
 * GET /api/strs/queue/stats
 * Get queue statistics
 */
router.get(
  "/queue/stats",
  optionalAuth,
  asyncHandler(getStrsQueueStats)
);

// Health check endpoint
router.get(
  "/health",
  asyncHandler(getStrsHealth)
);

router.post(
  '/feedback',
  optionalAuth,
  express.json({ limit: '256kb' }),
  asyncHandler(submitStrsFeedback)
);

router.get(
  '/feedback/summary',
  optionalAuth,
  asyncHandler(getStrsFeedbackSummary)
);

router.get(
  '/feedback/recent',
  optionalAuth,
  asyncHandler(getRecentStrsFeedback)
);

export default router;


