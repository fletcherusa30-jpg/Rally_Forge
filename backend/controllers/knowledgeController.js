import { initializeKnowledgeBase } from '../services/knowledgeBaseService.js';
import {
  loadKnowledgeLibraryBase,
  getKnowledgeLibraryStatus,
  validateKnowledgeNodes,
  listKnowledgeNodes,
  getKnowledgeNodeById,
  queryKnowledgeNodes,
  buildDecisionTrace,
  buildEvidenceChecklist,
} from '../services/knowledgeLibraryService.js';
import { getKnowledgeManifestIntegrity } from '../services/knowledgeManifestService.js';

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

export async function initializeKnowledge(_req, res) {
  const services = await getKnowledgeServices();
  res.json({
    success: true,
    message: 'Knowledge base initialized',
    stats: services.knowledgeBase.stats,
  });
}

export async function listKnowledgeCases(_req, res) {
  const services = await getKnowledgeServices();
  const cases = services.caseService.getAllCases();
  res.json({ success: true, cases, count: cases.length });
}

export async function listKnowledgeCasesTimeline(_req, res) {
  const services = await getKnowledgeServices();
  const cases = services.caseService.getAllCases();
  const timeline = {};

  for (const item of cases) {
    const year = String(item?.year || 'unknown');
    if (!timeline[year]) {
      timeline[year] = [];
    }
    timeline[year].push(item);
  }

  res.json({ success: true, timeline });
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

export async function searchKnowledgePart3(req, res) {
  const services = await getKnowledgeServices();
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
  }

  const sections = services.part3Service.searchSections(q);
  return res.json({ success: true, query: q, sections, count: sections.length });
}

export async function searchKnowledgeDiagnosticCodes(req, res) {
  const services = await getKnowledgeServices();
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
  }

  const diagnosticCodes = services.part4Service.searchDiagnosticCodes(q);
  return res.json({ success: true, query: q, diagnosticCodes, count: diagnosticCodes.length });
}

export async function getKnowledgeForCondition(req, res) {
  const services = await getKnowledgeServices();
  const { conditionName } = req.params;
  const knowledge = await services.searchService.getConditionKnowledge(conditionName);
  res.json({ success: true, ...knowledge });
}

export async function getPart3Section(req, res) {
  const services = await getKnowledgeServices();
  const rawSection = String(req.params.sectionNumber || '').trim();
  const normalizedSection = rawSection.startsWith('§') ? rawSection : `§${rawSection}`;
  const section = services.part3Service.getSectionByNumber(normalizedSection);
  if (!section) {
    return res.status(404).json({ success: false, error: `Section ${rawSection} not found in Part 3` });
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

export async function getKnowledgeLibraryBaseStatus(_req, res) {
  const status = await getKnowledgeLibraryStatus();
  res.json({ success: true, data: status });
}

export async function getKnowledgeLibraryIntegrity(_req, res) {
  const integrity = await getKnowledgeManifestIntegrity();
  const statusCode = integrity.success ? 200 : 503;
  res.status(statusCode).json({ success: integrity.success, data: integrity });
}

export async function validateKnowledgeLibrary(_req, res) {
  const base = await loadKnowledgeLibraryBase();
  const validation = validateKnowledgeNodes(base.schema, base.nodes);
  res.json({ success: true, data: validation });
}

export async function listLibraryNodes(req, res) {
  const base = await loadKnowledgeLibraryBase();
  const nodes = listKnowledgeNodes(base.nodes, req.query || {});
  res.json({ success: true, data: nodes, count: nodes.length });
}

export async function getLibraryNodeById(req, res) {
  const base = await loadKnowledgeLibraryBase();
  const node = getKnowledgeNodeById(base.nodes, req.params.id);
  if (!node) {
    return res.status(404).json({ success: false, error: `Knowledge node ${req.params.id} not found` });
  }
  return res.json({ success: true, data: node });
}

export async function queryLibraryNodes(req, res) {
  const base = await loadKnowledgeLibraryBase();
  const matches = queryKnowledgeNodes(base.nodes, req.body || {});
  res.json({ success: true, data: matches, count: matches.length });
}

export async function getLibraryDecisionTrace(req, res) {
  const base = await loadKnowledgeLibraryBase();
  const trace = buildDecisionTrace(base.nodes, req.body || {});
  res.json({ success: true, data: trace });
}

export async function getLibraryEvidenceChecklist(req, res) {
  const base = await loadKnowledgeLibraryBase();
  const checklist = buildEvidenceChecklist(base.nodes, req.body || {});
  res.json({ success: true, data: checklist });
}
