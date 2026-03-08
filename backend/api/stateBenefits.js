/**
 * State Benefits API Endpoints
 * 
 * Provides REST endpoints for accessing comprehensive state benefits
 * from the STATE_BENEFITS_DATABASE
 */

import express from 'express';
import { asyncHandler } from '../utils/errors.js';
import {
  getBenefitsByState,
  getVeteranBenefits,
  getAllStates,
  getBenefitsByCategory,
  searchBenefits,
  getDatabaseStatistics,
  compareBenefitsAcrossStates
} from '../services/stateBenefitsService.js';

const router = express.Router();

/**
 * GET /state-benefits/states
 * Get list of all available states
 */
router.get('/states', asyncHandler(async (req, res) => {
  const states = await getAllStates();
  res.json({
    success: true,
    data: states,
    count: states.length
  });
}));

/**
 * GET /state-benefits/stats
 * Get database statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await getDatabaseStatistics();
  res.json({
    success: true,
    data: stats
  });
}));

/**
 * GET /state-benefits/:stateCode
 * Get all benefits for a state
 */
router.get('/:stateCode', asyncHandler(async (req, res) => {
  const stateData = await getBenefitsByState(req.params.stateCode);
  
  if (!stateData) {
    return res.status(404).json({
      success: false,
      error: `State ${req.params.stateCode} not found`
    });
  }
  
  res.json({
    success: true,
    data: stateData
  });
}));

/**
 * GET /state-benefits/:stateCode/eligible
 * Get eligible benefits for a veteran in a state
 * Query params: rating=percentage
 */
router.get('/:stateCode/eligible', asyncHandler(async (req, res) => {
  const { rating } = req.query;
  
  if (rating === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Rating parameter required (?rating=percentage)'
    });
  }
  
  const combinedRating = parseInt(rating);
  if (isNaN(combinedRating) || combinedRating < 0 || combinedRating > 100) {
    return res.status(400).json({
      success: false,
      error: 'Rating must be a number between 0 and 100'
    });
  }
  
  const benefits = await getVeteranBenefits(req.params.stateCode, combinedRating);
  
  res.json({
    success: true,
    data: benefits
  });
}));

/**
 * GET /state-benefits/category/:categoryName
 * Get benefits by category across all states
 */
router.get('/category/:categoryName', asyncHandler(async (req, res) => {
  const category = decodeURIComponent(req.params.categoryName);
  const results = await getBenefitsByCategory(category);
  
  res.json({
    success: true,
    data: results,
    category,
    statesWithBenefits: Object.keys(results).length
  });
}));

/**
 * GET /state-benefits/search
 * Search benefits across all states
 * Query params: q=search_term
 */
router.get('/search', asyncHandler(async (req, res) => {
  const { q } = req.query;
  
  if (!q || q.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Search term required (?q=term)'
    });
  }
  
  const results = await searchBenefits(q);
  
  res.json({
    success: true,
    data: results,
    count: results.length,
    searchTerm: q
  });
}));

/**
 * POST /state-benefits/compare
 * Compare benefits across multiple states
 * Body: { states: ['CA', 'TX', 'NY'] }
 */
router.post('/compare', asyncHandler(async (req, res) => {
  const { states } = req.body;
  
  if (!Array.isArray(states) || states.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Array of state codes required'
    });
  }
  
  const comparison = await compareBenefitsAcrossStates(states);
  
  res.json({
    success: true,
    data: comparison
  });
}));

export default router;
