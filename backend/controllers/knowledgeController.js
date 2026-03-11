import { initializeKnowledgeBase } from '../services/knowledgeBaseService.js';

let knowledgeServices = null;

async function getKnowledgeServices() {
  if (!knowledgeServices) {
    knowledgeServices = await initializeKnowledgeBase();
  }
  return knowledgeServices;
}

export async function getKnowledgeStatus(_req, res) {
  const services = await getKnowledgeServices();
  res.json({
    success: true,
    integrated: true,
    stats: services.knowledgeBase.stats,
    schema: services.knowledgeBase.schema,
  });
}

export async function listKnowledgeCases(_req, res) {
  const services = await getKnowledgeServices();
  const cases = services.caseService.getAllCases();
  res.json({ success: true, cases, count: cases.length });
}

export async function getKnowledgeCaseById(req, res) {
  const services = await getKnowledgeServices();
  const { caseId } = req.params;
  try {
    const caseData = await services.caseService.loadCaseContent(caseId);
    return res.json({ success: true, case: caseData });
  } catch (error) {
    return res.status(404).json({ success: false, error: error.message });
  }
}

export async function listKnowledgeCasesByYear(req, res) {
  const services = await getKnowledgeServices();
  const { year } = req.params;
  const cases = services.caseService.getCasesByYear(year);
  res.json({ success: true, year, cases, count: cases.length });
}

export async function searchKnowledge(req, res) {
  const services = await getKnowledgeServices();
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.json({ success: false, error: 'Search query must be at least 2 characters' });
  }

  const results = await services.searchService.searchAll(q);
  return res.json({ success: true, ...results });
}

export async function getKnowledgeForCondition(req, res) {
  const services = await getKnowledgeServices();
  const { conditionName } = req.params;
  const knowledge = await services.searchService.getConditionKnowledge(conditionName);
  res.json({ success: true, ...knowledge });
}

export async function getPart3Section(req, res) {
  const services = await getKnowledgeServices();
  const { sectionNumber } = req.params;
  const section = services.part3Service.getSectionByNumber(sectionNumber);
  if (!section) {
    return res.status(404).json({ success: false, error: `Section ${sectionNumber} not found in Part 3` });
  }
  return res.json({ success: true, section });
}

export async function getPart4Section(req, res) {
  const services = await getKnowledgeServices();
  const { sectionNumber } = req.params;
  const section = services.part4Service.getSectionByNumber(sectionNumber);
  if (!section) {
    return res.status(404).json({ success: false, error: `Section ${sectionNumber} not found in Part 4` });
  }
  return res.json({ success: true, section });
}

export async function getDiagnosticCode(req, res) {
  const services = await getKnowledgeServices();
  const { code } = req.params;
  const diagnosticCode = services.part4Service.getDiagnosticCode(code);
  if (!diagnosticCode) {
    return res.status(404).json({ success: false, error: `Diagnostic code ${code} not found` });
  }
  return res.json({ success: true, diagnosticCode });
}

export async function getPart3ByTopic(req, res) {
  const services = await getKnowledgeServices();
  const { topic } = req.params;
  const sections = services.part3Service.getSectionsByTopic(topic);
  res.json({ success: true, topic, sections, count: sections.length });
}

export async function getPart4ByBodySystem(req, res) {
  const services = await getKnowledgeServices();
  const { bodySystem } = req.params;
  const codes = services.part4Service.getDiagnosticCodesByBodySystem(bodySystem);
  res.json({ success: true, bodySystem, diagnosticCodes: codes, count: codes.length });
}
