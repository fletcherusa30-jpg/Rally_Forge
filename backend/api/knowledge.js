/**
 * KNOWLEDGE BASE API ROUTE
 * 
 * Provides access to complete VA knowledge base:
 * - 38 CFR Part 3 (Disability Compensation Regulations)
 * - 38 CFR Part 4 (Rating Schedule & Diagnostic Codes)
 * - CAVC Cases (Precedential Legal Decisions)
 */

import express from 'express';
import { asyncHandler } from '../utils/errors.js';
import { initializeKnowledgeBase } from '../services/knowledgeBaseService.js';

const router = express.Router();

// Initialize knowledge base services
let knowledgeServices = null;
const getKnowledgeServices = async () => {
  if (!knowledgeServices) {
    knowledgeServices = await initializeKnowledgeBase();
  }
  return knowledgeServices;
};

/**
 * GET /api/knowledge/status
 * Get knowledge base status and statistics
 */
router.get('/knowledge/status', asyncHandler(async (req, res) => {
  const services = await getKnowledgeServices();
  
  res.json({
    success: true,
    integrated: true,
    stats: services.knowledgeBase.stats,
    schema: services.knowledgeBase.schema
  });
}));

/**
 * GET /api/knowledge/cases
 * Get all CAVC cases
 */
router.get('/knowledge/cases', asyncHandler(async (req, res) => {
  const services = await getKnowledgeServices();
  const cases = services.caseService.getAllCases();
  
  res.json({
    success: true,
    cases,
    count: cases.length
  });
}));

/**
 * GET /api/knowledge/cases/:caseId
 * Get specific case details and content
 */
router.get('/knowledge/cases/:caseId', asyncHandler(async (req, res) => {
  const services = await getKnowledgeServices();
  const { caseId } = req.params;
  
  try {
    const caseData = await services.caseService.loadCaseContent(caseId);
    
    res.json({
      success: true,
      case: caseData
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * GET /api/knowledge/cases/year/:year
 * Get all cases from a specific year
 */
router.get('/knowledge/cases/year/:year', asyncHandler(async (req, res) => {
  const services = await getKnowledgeServices();
  const { year } = req.params;
  
  const cases = services.caseService.getCasesByYear(year);
  
  res.json({
    success: true,
    year,
    cases,
    count: cases.length
  });
}));

/**
 * GET /api/knowledge/search?q=<query>
 * Search across all knowledge base components
 */
router.get('/knowledge/search', asyncHandler(async (req, res) => {
  const services = await getKnowledgeServices();
  const { q } = req.query;
  
  if (!q || q.trim().length < 2) {
    return res.json({
      success: false,
      error: 'Search query must be at least 2 characters'
    });
  }

  const results = await services.searchService.searchAll(q);
  
  res.json({
    success: true,
    ...results
  });
}));

/**
 * GET /api/knowledge/condition/:conditionName
 * Get all knowledge (regulations, ratings, cases) for a specific condition
 */
router.get('/knowledge/condition/:conditionName', asyncHandler(async (req, res) => {
  const services = await getKnowledgeServices();
  const { conditionName } = req.params;
  
  const knowledge = await services.searchService.getConditionKnowledge(conditionName);
  
  res.json({
    success: true,
    ...knowledge
  });
}));

/**
 * GET /api/knowledge/part3/:sectionNumber
 * Get specific Part 3 section by number (e.g., 3.500)
 */
router.get('/knowledge/part3/:sectionNumber', asyncHandler(async (req, res) => {
  const services = await getKnowledgeServices();
  const { sectionNumber } = req.params;
  
  const section = services.part3Service.getSectionByNumber(sectionNumber);
  
  if (!section) {
    return res.status(404).json({
      success: false,
      error: `Section ${sectionNumber} not found in Part 3`
    });
  }
  
  res.json({
    success: true,
    section
  });
}));

/**
 * GET /api/knowledge/part4/:sectionNumber
 * Get specific Part 4 section by number (e.g., 4.130)
 */
router.get('/knowledge/part4/:sectionNumber', asyncHandler(async (req, res) => {
  const services = await getKnowledgeServices();
  const { sectionNumber } = req.params;
  
  const section = services.part4Service.getSectionByNumber(sectionNumber);
  
  if (!section) {
    return res.status(404).json({
      success: false,
      error: `Section ${sectionNumber} not found in Part 4`
    });
  }
  
  res.json({
    success: true,
    section
  });
}));

/**
 * GET /api/knowledge/diagnostic-code/:code
 * Get diagnostic code details
 */
router.get('/knowledge/diagnostic-code/:code', asyncHandler(async (req, res) => {
  const services = await getKnowledgeServices();
  const { code } = req.params;
  
  const diagnosticCode = services.part4Service.getDiagnosticCode(code);
  
  if (!diagnosticCode) {
    return res.status(404).json({
      success: false,
      error: `Diagnostic code ${code} not found`
    });
  }
  
  res.json({
    success: true,
    diagnosticCode
  });
}));

/**
 * GET /api/knowledge/part3/topic/:topic
 * Get Part 3 sections by topic (dependents, effective_dates, service_connection, etc.)
 */
router.get('/knowledge/part3/topic/:topic', asyncHandler(async (req, res) => {
  const services = await getKnowledgeServices();
  const { topic } = req.params;
  
  const sections = services.part3Service.getSectionsByTopic(topic);
  
  res.json({
    success: true,
    topic,
    sections,
    count: sections.length
  });
}));

/**
 * GET /api/knowledge/part4/body-system/:bodySystem
 * Get diagnostic codes by body system
 */
router.get('/knowledge/part4/body-system/:bodySystem', asyncHandler(async (req, res) => {
  const services = await getKnowledgeServices();
  const { bodySystem } = req.params;
  
  const codes = services.part4Service.getDiagnosticCodesByBodySystem(bodySystem);
  
  res.json({
    success: true,
    bodySystem,
    diagnosticCodes: codes,
    count: codes.length
  });
}));

export default router;

