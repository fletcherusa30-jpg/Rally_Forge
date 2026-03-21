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
  initializeKnowledge,
  listKnowledgeCases,
  listKnowledgeCasesTimeline,
  getKnowledgeCaseById,
  listKnowledgeCasesByYear,
  searchKnowledge,
  searchKnowledgePart3,
  searchKnowledgeDiagnosticCodes,
  getKnowledgeForCondition,
  getPart3Section,
  getPart4Section,
  getDiagnosticCode,
  getPart3ByTopic,
  getPart4ByBodySystem,
  getKnowledgeLibraryBaseStatus,
  getKnowledgeLibraryIntegrity,
  validateKnowledgeLibrary,
  listLibraryNodes,
  getLibraryNodeById,
  queryLibraryNodes,
  getLibraryDecisionTrace,
  getLibraryEvidenceChecklist,
} from '../controllers/knowledgeController.js';

const router = express.Router();

/**
 * GET /api/knowledge/status
 * Get knowledge base status and statistics
 */
router.get('/status', asyncHandler(getKnowledgeStatus));

/**
 * POST /api/knowledge/init
 * Backward-compatible initializer endpoint
 */
router.post('/init', asyncHandler(initializeKnowledge));

/**
 * GET /api/knowledge/cases
 * Get all CAVC cases
 */
router.get('/cases', asyncHandler(listKnowledgeCases));

/**
 * GET /api/knowledge/cases/timeline
 * Get cases grouped by year
 */
router.get('/cases/timeline', asyncHandler(listKnowledgeCasesTimeline));

/**
 * GET /api/knowledge/cases/:caseId
 * Get specific case details and content
 */
router.get('/cases/:caseId', asyncHandler(getKnowledgeCaseById));

/**
 * GET /api/knowledge/cases/year/:year
 * Get all cases from a specific year
 */
router.get('/cases/year/:year', asyncHandler(listKnowledgeCasesByYear));

/**
 * GET /api/knowledge/search?q=<query>
 * Search across all knowledge base components
 */
router.get('/search', asyncHandler(searchKnowledge));

/**
 * POST /api/knowledge/validate
 * Backward-compatible validator endpoint
 */
router.post('/validate', asyncHandler(validateKnowledgeLibrary));

/**
 * GET /api/knowledge/part3/search?q=<query>
 * Search Part 3 sections only
 */
router.get('/part3/search', asyncHandler(searchKnowledgePart3));

/**
 * GET /api/knowledge/part4/diagnostic/search?q=<query>
 * Search diagnostic codes only
 */
router.get('/part4/diagnostic/search', asyncHandler(searchKnowledgeDiagnosticCodes));

/**
 * GET /api/knowledge/condition/:conditionName
 * Get all knowledge (regulations, ratings, cases) for a specific condition
 */
router.get('/condition/:conditionName', asyncHandler(getKnowledgeForCondition));

/**
 * GET /api/knowledge/part3/:sectionNumber
 * Get specific Part 3 section by number (e.g., 3.500)
 */
router.get('/part3/:sectionNumber', asyncHandler(getPart3Section));

/**
 * GET /api/knowledge/part4/:sectionNumber
 * Get specific Part 4 section by number (e.g., 4.130)
 */
router.get('/part4/:sectionNumber', asyncHandler(getPart4Section));

/**
 * GET /api/knowledge/diagnostic-code/:code
 * Get diagnostic code details
 */
router.get('/diagnostic-code/:code', asyncHandler(getDiagnosticCode));

/**
 * GET /api/knowledge/part4/diagnostic/:code
 * Compatibility alias for diagnostic-code route
 */
router.get('/part4/diagnostic/:code', asyncHandler(getDiagnosticCode));

/**
 * GET /api/knowledge/part3/topic/:topic
 * Get Part 3 sections by topic (dependents, effective_dates, service_connection, etc.)
 */
router.get('/part3/topic/:topic', asyncHandler(getPart3ByTopic));

/**
 * GET /api/knowledge/part4/body-system/:bodySystem
 * Get diagnostic codes by body system
 */
router.get('/part4/body-system/:bodySystem', asyncHandler(getPart4ByBodySystem));

/**
 * GET /api/knowledge/library/status
 * Get canonical knowledge library manifest/schema/taxonomy status
 */
router.get('/library/status', asyncHandler(getKnowledgeLibraryBaseStatus));

/**
 * GET /api/knowledge/library/integrity
 * Validate release manifest file references and checksum consistency
 */
router.get('/library/integrity', asyncHandler(getKnowledgeLibraryIntegrity));

/**
 * GET /api/knowledge/library/validate
 * Validate canonical knowledge nodes against schema requirements
 */
router.get('/library/validate', asyncHandler(validateKnowledgeLibrary));

/**
 * GET /api/knowledge/nodes
 * List canonical library nodes with optional query params (domain, authority, tag, q)
 */
router.get('/nodes', asyncHandler(listLibraryNodes));

/**
 * GET /api/knowledge/node/:id
 * Get canonical knowledge node by id
 */
router.get('/node/:id', asyncHandler(getLibraryNodeById));

/**
 * POST /api/knowledge/query
 * Deterministic node query using domains/authorities/tags/condition filters
 */
router.post('/query', asyncHandler(queryLibraryNodes));

/**
 * POST /api/knowledge/decision-trace
 * Build deterministic decision trace from canonical nodes
 */
router.post('/decision-trace', asyncHandler(getLibraryDecisionTrace));

/**
 * POST /api/knowledge/evidence-checklist
 * Build deterministic evidence checklist from canonical nodes
 */
router.post('/evidence-checklist', asyncHandler(getLibraryEvidenceChecklist));

export default router;

