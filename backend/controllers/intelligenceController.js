const RISK_KEYWORDS = [
  'denied',
  'appeal',
  'overpayment',
  'debt',
  'reduction',
  'severance',
  'remand',
];

const OPPORTUNITY_KEYWORDS = [
  'service connection',
  'nexus',
  'presumptive',
  'secondary',
  'increase',
  'evidence',
  'new claim',
];

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function keywordMatches(text, keywords) {
  const haystack = String(text || '').toLowerCase();
  return keywords.filter((keyword) => haystack.includes(keyword));
}

export async function getIntelligenceStatus(_req, res) {
  res.json({
    success: true,
    service: 'intelligence',
    status: 'ready',
    endpoints: ['GET /api/intelligence', 'POST /api/intelligence/analyze'],
    timestamp: new Date().toISOString(),
  });
}

export async function analyzeIntelligence(req, res) {
  const text = String(req.body?.text || '').trim();
  const domain = String(req.body?.domain || 'general').trim();
  const tags = Array.isArray(req.body?.tags)
    ? req.body.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];

  if (!text) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: [{ field: 'text', message: 'text is required' }],
    });
  }

  if (text.length > 25000) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: [{ field: 'text', message: 'text exceeds max length (25000)' }],
    });
  }

  const riskHits = keywordMatches(text, RISK_KEYWORDS);
  const opportunityHits = keywordMatches(text, OPPORTUNITY_KEYWORDS);
  const tokenCount = tokenize(text).length;

  const riskScore = Math.min(100, riskHits.length * 20);
  const opportunityScore = Math.min(100, opportunityHits.length * 20);

  const recommendations = [];
  if (riskHits.length > 0) {
    recommendations.push('Review denial and appeal timelines for deadline risks.');
  }
  if (opportunityHits.length > 0) {
    recommendations.push('Prioritize evidence package for identified service-connection opportunities.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Add more claim details for higher-confidence intelligence insights.');
  }

  return res.json({
    success: true,
    data: {
      domain,
      tags,
      metrics: {
        tokenCount,
        riskScore,
        opportunityScore,
      },
      signals: {
        riskKeywords: riskHits,
        opportunityKeywords: opportunityHits,
      },
      recommendations,
      confidence: riskHits.length + opportunityHits.length > 0 ? 'medium' : 'low',
    },
    meta: {
      analyzer: 'deterministic-keyword-v1',
      timestamp: new Date().toISOString(),
    },
  });
}
