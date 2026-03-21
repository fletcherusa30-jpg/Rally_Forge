/**
 * AI Analysis Router
 * Handles Claude API calls for analyzing denied conditions and identifying alternate theories of entitlement
 */

import express from 'express';
import aiHandler from './aiAnalysisHandler.js';

const router = express.Router();

/**
 * POST /api/ai/analyze-denied-condition
 * Analyze a single denied condition for alternate theories of entitlement
 */
router.post('/analyze-denied-condition', async (req, res, next) => {
  try {
    await aiHandler.handleAnalyzeDeniedCondition(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/analyze-bulk
 * Analyze multiple denied conditions at once
 */
router.post('/analyze-bulk', async (req, res, next) => {
  try {
    await aiHandler.handleBulkAnalyze(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ai/health
 * Health check for Claude API connectivity
 */
router.get('/health', async (req, res, next) => {
  try {
    await aiHandler.handleHealthCheck(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;

