const API_BASE = '/api';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.json();
}

export function getScannerData() {
  return fetchJson(`${API_BASE}/scanner`);
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

export function getFinancialData() {
  return fetchJson(`${API_BASE}/financial`);
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

