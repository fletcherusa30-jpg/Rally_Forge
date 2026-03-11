/**
 * Cases API Endpoints
 * 
 * Provides REST endpoints for accessing CAVC precedential decisions
 * and their integration with regulatory authorities.
 */

import express from 'express';
import { asyncHandler } from '../core/index.js';
import {
  listCases,
  timelineCases,
  getCaseById,
  listCasesByYear,
  listCasesByTopic,
  searchCasesByText,
  createRegulatoryReferences,
} from '../controllers/casesController.js';

const router = express.Router();

/**
 * GET /cases
 * Get all cases
 */
router.get('/', asyncHandler(listCases));

/**
 * GET /cases/timeline
 * Get cases organized by year
 */
router.get('/timeline', asyncHandler(timelineCases));

/**
 * GET /cases/year/:year
 * Get cases by year
 */
router.get('/year/:year', asyncHandler(listCasesByYear));

/**
 * GET /cases/topic/:topic
 * Get cases related to a specific topic
 */
router.get('/topic/:topic', asyncHandler(listCasesByTopic));

/**
 * GET /cases/search
 * Search cases by text content
 * Query params: q=search_term
 */
router.get('/search', asyncHandler(searchCasesByText));

/**
 * POST /cases/regulatory-references
 * Build cross-references between CFR citations and cases
 * Body: { citations: ['38 CFR 3.502', '38 CFR 4.1', ...] }
 */
router.post('/regulatory-references', asyncHandler(createRegulatoryReferences));

/**
 * GET /cases/:caseId
 * Get case details by CAVC ID (e.g., CAVC-14-3611)
 */
router.get('/:caseId', asyncHandler(getCaseById));

export default router;
