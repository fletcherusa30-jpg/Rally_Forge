/**
 * KNOWLEDGE BASE API ROUTE
 * 
 * Provides access to complete VA knowledge base:
 * - 38 CFR Part 3 (Disability Compensation Regulations)
 * - 38 CFR Part 4 (Rating Schedule & Diagnostic Codes)
 * - CAVC Cases (Precedential Legal Decisions)
 */

import express from 'express';
import { asyncHandler } from '../core/index.js';
import {
  getKnowledgeStatus,
  listKnowledgeCases,
  getKnowledgeCaseById,
  listKnowledgeCasesByYear,
  searchKnowledge,
  getKnowledgeForCondition,
  getPart3Section,
  getPart4Section,
  getDiagnosticCode,
  getPart3ByTopic,
  getPart4ByBodySystem,
} from '../controllers/knowledgeController.js';

const router = express.Router();

/**
 * GET /api/knowledge/status
 * Get knowledge base status and statistics
 */
router.get('/knowledge/status', asyncHandler(getKnowledgeStatus));

/**
 * GET /api/knowledge/cases
 * Get all CAVC cases
 */
router.get('/knowledge/cases', asyncHandler(listKnowledgeCases));

/**
 * GET /api/knowledge/cases/:caseId
 * Get specific case details and content
 */
router.get('/knowledge/cases/:caseId', asyncHandler(getKnowledgeCaseById));

/**
 * GET /api/knowledge/cases/year/:year
 * Get all cases from a specific year
 */
router.get('/knowledge/cases/year/:year', asyncHandler(listKnowledgeCasesByYear));

/**
 * GET /api/knowledge/search?q=<query>
 * Search across all knowledge base components
 */
router.get('/knowledge/search', asyncHandler(searchKnowledge));

/**
 * GET /api/knowledge/condition/:conditionName
 * Get all knowledge (regulations, ratings, cases) for a specific condition
 */
router.get('/knowledge/condition/:conditionName', asyncHandler(getKnowledgeForCondition));

/**
 * GET /api/knowledge/part3/:sectionNumber
 * Get specific Part 3 section by number (e.g., 3.500)
 */
router.get('/knowledge/part3/:sectionNumber', asyncHandler(getPart3Section));

/**
 * GET /api/knowledge/part4/:sectionNumber
 * Get specific Part 4 section by number (e.g., 4.130)
 */
router.get('/knowledge/part4/:sectionNumber', asyncHandler(getPart4Section));

/**
 * GET /api/knowledge/diagnostic-code/:code
 * Get diagnostic code details
 */
router.get('/knowledge/diagnostic-code/:code', asyncHandler(getDiagnosticCode));

/**
 * GET /api/knowledge/part3/topic/:topic
 * Get Part 3 sections by topic (dependents, effective_dates, service_connection, etc.)
 */
router.get('/knowledge/part3/topic/:topic', asyncHandler(getPart3ByTopic));

/**
 * GET /api/knowledge/part4/body-system/:bodySystem
 * Get diagnostic codes by body system
 */
router.get('/knowledge/part4/body-system/:bodySystem', asyncHandler(getPart4ByBodySystem));

export default router;

