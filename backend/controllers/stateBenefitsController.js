import {
  getBenefitsByState,
  getVeteranBenefits,
  getAllStates,
  getBenefitsByCategory,
  searchBenefits,
  getDatabaseStatistics,
  compareBenefitsAcrossStates,
  getEligibleStructuredBenefits,
} from '../services/stateBenefitsService.js';

export async function listStates(_req, res) {
  const states = await getAllStates();
  res.json({ success: true, data: states, count: states.length });
}

export async function getStateBenefitsStats(_req, res) {
  const stats = await getDatabaseStatistics();
  res.json({ success: true, data: stats });
}

export async function getStateBenefitsByCode(req, res) {
  const stateData = await getBenefitsByState(req.params.stateCode);
  if (!stateData) {
    return res.status(404).json({ success: false, error: `State ${req.params.stateCode} not found` });
  }
  return res.json({ success: true, data: stateData });
}

export async function getEligibleStateBenefits(req, res) {
  const { rating } = req.query;
  if (rating === undefined) {
    return res.status(400).json({ success: false, error: 'Rating parameter required (?rating=percentage)' });
  }

  const combinedRating = parseInt(rating, 10);
  if (Number.isNaN(combinedRating) || combinedRating < 0 || combinedRating > 100) {
    return res.status(400).json({ success: false, error: 'Rating must be a number between 0 and 100' });
  }

  const benefits = await getVeteranBenefits(req.params.stateCode, combinedRating);
  return res.json({ success: true, data: benefits });
}

export async function getBenefitsByCategoryAcrossStates(req, res) {
  const category = decodeURIComponent(req.params.categoryName);
  const results = await getBenefitsByCategory(category);
  res.json({ success: true, data: results, category, statesWithBenefits: Object.keys(results).length });
}

export async function searchStateBenefits(req, res) {
  const { q } = req.query;
  if (!q || q.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Search term required (?q=term)' });
  }

  const results = await searchBenefits(q);
  return res.json({ success: true, data: results, count: results.length, searchTerm: q });
}

export async function compareStateBenefits(req, res) {
  const { states } = req.body;
  if (!Array.isArray(states) || states.length === 0) {
    return res.status(400).json({ success: false, error: 'Array of state codes required' });
  }

  const comparison = await compareBenefitsAcrossStates(states);
  return res.json({ success: true, data: comparison });
}

export async function getStructuredStateBenefitsEligibility(req, res) {
  const toBool = (value) => String(value).toLowerCase() === 'true';

  const data = await getEligibleStructuredBenefits({
    stateCode: req.params.stateCode,
    rating: Number(req.query.rating || 0),
    serviceConnected: toBool(req.query.serviceConnected),
    combatVeteran: toBool(req.query.combatVeteran),
    wartimeVeteran: toBool(req.query.wartimeVeteran),
    homeowner: toBool(req.query.homeowner),
  });

  return res.json({ success: true, data });
}
