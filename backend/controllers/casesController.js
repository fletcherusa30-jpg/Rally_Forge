import {
  getCasesByYear,
  getAllCases,
  getCaseDetails,
  getCasesByTopic,
  getCaseTimeline,
  searchCases,
  buildRegulatoryReferences,
} from '../services/caseLookupService.js';

export async function listCases(_req, res) {
  const cases = await getAllCases();
  res.json({ success: true, data: cases, count: cases.length });
}

export async function timelineCases(_req, res) {
  const timeline = await getCaseTimeline();
  res.json({ success: true, data: timeline });
}

export async function getCaseById(req, res) {
  const caseDetails = await getCaseDetails(req.params.caseId);
  if (!caseDetails) {
    return res.status(404).json({ success: false, error: `Case ${req.params.caseId} not found` });
  }
  return res.json({ success: true, data: caseDetails });
}

export async function listCasesByYear(req, res) {
  const year = parseInt(req.params.year, 10);
  if (Number.isNaN(year)) {
    return res.status(400).json({ success: false, error: 'Invalid year format' });
  }
  const cases = await getCasesByYear(year);
  return res.json({ success: true, data: cases, count: cases.length });
}

export async function listCasesByTopic(req, res) {
  const cases = await getCasesByTopic(req.params.topic);
  return res.json({ success: true, data: cases, count: cases.length });
}

export async function searchCasesByText(req, res) {
  const searchTerm = req.query.q;
  if (!searchTerm || searchTerm.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Search term required (use ?q=term)' });
  }
  const results = await searchCases(searchTerm);
  return res.json({ success: true, data: results, count: results.length, searchTerm });
}

export async function createRegulatoryReferences(req, res) {
  const { citations } = req.body;
  if (!Array.isArray(citations) || citations.length === 0) {
    return res.status(400).json({ success: false, error: 'Array of CFR citations required' });
  }
  const references = await buildRegulatoryReferences(citations);
  return res.json({
    success: true,
    data: references,
    citationsWithMatches: Object.keys(references).length,
    totalMatches: Object.values(references).reduce((sum, items) => sum + items.length, 0),
  });
}
