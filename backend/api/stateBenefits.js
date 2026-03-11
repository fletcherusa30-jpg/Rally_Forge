/**
 * State Benefits API Endpoints
 * 
 * Provides REST endpoints for accessing comprehensive state benefits
 * from the STATE_BENEFITS_DATABASE
 */

import express from 'express';
import { asyncHandler } from '../core/index.js';
import {
  listStates,
  getStateBenefitsStats,
  getStateBenefitsByCode,
  getEligibleStateBenefits,
  getBenefitsByCategoryAcrossStates,
  searchStateBenefits,
  compareStateBenefits,
} from '../controllers/stateBenefitsController.js';

const router = express.Router();

/**
 * GET /state-benefits/states
 * Get list of all available states
 */
router.get('/states', asyncHandler(listStates));

/**
 * GET /state-benefits/stats
 * Get database statistics
 */
router.get('/stats', asyncHandler(getStateBenefitsStats));

/**
 * GET /state-benefits/:stateCode/eligible
 * Get eligible benefits for a veteran in a state
 * Query params: rating=percentage
 */
router.get('/:stateCode/eligible', asyncHandler(getEligibleStateBenefits));

/**
 * GET /state-benefits/category/:categoryName
 * Get benefits by category across all states
 */
router.get('/category/:categoryName', asyncHandler(getBenefitsByCategoryAcrossStates));

/**
 * GET /state-benefits/search
 * Search benefits across all states
 * Query params: q=search_term
 */
router.get('/search', asyncHandler(searchStateBenefits));

/**
 * POST /state-benefits/compare
 * Compare benefits across multiple states
 * Body: { states: ['CA', 'TX', 'NY'] }
 */
router.post('/compare', asyncHandler(compareStateBenefits));

/**
 * GET /state-benefits/:stateCode
 * Get all benefits for a state
 */
router.get('/:stateCode', asyncHandler(getStateBenefitsByCode));

export default router;
