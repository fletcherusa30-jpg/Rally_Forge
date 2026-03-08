/**
 * Cases API Endpoints
 * 
 * Provides REST endpoints for accessing CAVC precedential decisions
 * and their integration with regulatory authorities.
 */

import express from 'express';
import { asyncHandler } from '../utils/errors.js';
import {
  getCasesByYear,
  getAllCases,
  getCaseDetails,
  getCasesByTopic,
  getCaseTimeline,
  searchCases,
  buildRegulatoryReferences
} from '../services/caseLookupService.js';

const router = express.Router();

/**
 * GET /cases
 * Get all cases
 */
router.get('/', asyncHandler(async (req, res) => {
  const cases = await getAllCases();
  res.json({
    success: true,
    data: cases,
    count: cases.length
  });
}));

/**
 * GET /cases/timeline
 * Get cases organized by year
 */
router.get('/timeline', asyncHandler(async (req, res) => {
  const timeline = await getCaseTimeline();
  res.json({
    success: true,
    data: timeline
  });
}));

/**
 * GET /cases/:caseId
 * Get case details by CAVC ID (e.g., CAVC-14-3611)
 */
router.get('/:caseId', asyncHandler(async (req, res) => {
  const caseDetails = await getCaseDetails(req.params.caseId);
  
  if (!caseDetails) {
    return res.status(404).json({
      success: false,
      error: `Case ${req.params.caseId} not found`
    });
  }
  
  res.json({
    success: true,
    data: caseDetails
  });
}));

/**
 * GET /cases/year/:year
 * Get cases by year
 */
router.get('/year/:year', asyncHandler(async (req, res) => {
  const year = parseInt(req.params.year);
  
  if (isNaN(year)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid year format'
    });
  }
  
  const cases = await getCasesByYear(year);
  res.json({
    success: true,
    data: cases,
    count: cases.length
  });
}));

/**
 * GET /cases/topic/:topic
 * Get cases related to a specific topic
 */
router.get('/topic/:topic', asyncHandler(async (req, res) => {
  const cases = await getCasesByTopic(req.params.topic);
  res.json({
    success: true,
    data: cases,
    count: cases.length
  });
}));

/**
 * GET /cases/search
 * Search cases by text content
 * Query params: q=search_term
 */
router.get('/search', asyncHandler(async (req, res) => {
  const searchTerm = req.query.q;
  
  if (!searchTerm || searchTerm.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Search term required (use ?q=term)'
    });
  }
  
  const results = await searchCases(searchTerm);
  res.json({
    success: true,
    data: results,
    count: results.length,
    searchTerm
  });
}));

/**
 * POST /cases/regulatory-references
 * Build cross-references between CFR citations and cases
 * Body: { citations: ['38 CFR 3.502', '38 CFR 4.1', ...] }
 */
router.post('/regulatory-references', asyncHandler(async (req, res) => {
  const { citations } = req.body;
  
  if (!Array.isArray(citations) || citations.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Array of CFR citations required'
    });
  }
  
  const references = await buildRegulatoryReferences(citations);
  res.json({
    success: true,
    data: references,
    citationsWithMatches: Object.keys(references).length,
    totalMatches: Object.values(references).reduce((sum, cases) => sum + cases.length, 0)
  });
}));

export default router;
