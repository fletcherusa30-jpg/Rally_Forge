const API_BASE = '/api';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    let message = text || `Request failed with status ${response.status}`;
    let code = null;
    let details = null;

    try {
      const parsed = JSON.parse(text);
      message = parsed?.error?.message || parsed?.message || message;
      code = parsed?.error?.code || null;
      details = parsed?.error?.details || null;
    } catch {
      // Plain text response; keep the original message.
    }

    const error = new Error(message);
    error.status = response.status;
    error.code = code;
    error.details = details;
    throw error;
  }
  return response.json();
}

export function getCompensationData() {
  return fetchJson(`${API_BASE}/compensation`);
}

export function getCompensationQuote(payload) {
  return fetchJson(`${API_BASE}/compensation/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
}

export function getBackPayEstimate(payload) {
  return fetchJson(`${API_BASE}/compensation/backpay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
}

export function getCompensationYears() {
  return fetchJson(`${API_BASE}/compensation/years`);
}

export function getAuditMetadata() {
  return fetchJson(`${API_BASE}/audit/metadata`);
}

export function getHealthStatus() {
  return fetchJson(`${API_BASE}/health`);
}

export function getIntelligenceStatus() {
  return fetchJson(`${API_BASE}/intelligence`);
}

export function analyzeIntelligence(payload) {
  return fetchJson(`${API_BASE}/intelligence/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
}

export function getPresumptiveKnowledge() {
  return fetchJson(`${API_BASE}/military/presumptive-knowledge`);
}

export function getRadiationOperations({ era, startDate, endDate } = {}) {
  const params = new URLSearchParams();
  if (era) params.set('era', era);
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const qs = params.toString();
  return fetchJson(`${API_BASE}/military/radiation-operations${qs ? `?${qs}` : ''}`);
}

export function getStructuredStateBenefits(stateCode, profile = {}) {
  const params = new URLSearchParams({
    rating: String(profile.rating ?? 0),
    serviceConnected: String(Boolean(profile.serviceConnected)),
    combatVeteran: String(Boolean(profile.combatVeteran)),
    wartimeVeteran: String(Boolean(profile.wartimeVeteran)),
    homeowner: String(Boolean(profile.homeowner)),
  });

  return fetchJson(`${API_BASE}/state-benefits/structured/${stateCode}?${params.toString()}`);
}

export function getStateBenefitsByCode(stateCode) {
  return fetchJson(`${API_BASE}/state-benefits/${encodeURIComponent(stateCode)}`);
}

export function submitExtractionReview(payload) {
  return fetchJson(`${API_BASE}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
}

export function getExtractionReviews(status = '') {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return fetchJson(`${API_BASE}/reviews${query}`);
}

export function getStrsJobStatus(jobId) {
  return fetchJson(`${API_BASE}/strs/status/${encodeURIComponent(jobId)}`);
}

export function submitStrsFeedback(payload) {
  return fetchJson(`${API_BASE}/strs/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
}

export function getRecentStrsFeedback(limit = 50) {
  const query = new URLSearchParams({ limit: String(limit) });
  return fetchJson(`${API_BASE}/strs/feedback/recent?${query.toString()}`);
}

export function getStrsFeedbackSummary() {
  return fetchJson(`${API_BASE}/strs/feedback/summary`);
}

export function getClaimWorkspace() {
  return fetchJson(`${API_BASE}/claim-workspace`);
}

export function saveClaimWorkspace(payload) {
  return fetchJson(`${API_BASE}/claim-workspace`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
}

export function validateImportedDd214(payload) {
  return fetchJson(`${API_BASE}/scanner/validate-dd214-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dd214: payload || null }),
  });
}

