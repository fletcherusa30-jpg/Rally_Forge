/**
 * API Smoke Tests — Rally Forge Backend
 *
 * End-to-end smoke sweep targeting a running backend on localhost:4000.
 * Run:  node --test backend/tests/api-smoke.test.js
 *
 * Requires the backend to be running:  node backend/server.js
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:4000/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function get(path, headers = {}) {
  const res = await fetch(BASE + path, { headers });
  try {
    const body = await res.json();
    return { status: res.status, ok: res.ok, body };
  } catch {
    return { status: res.status, ok: res.ok, body: {} };
  }
}

async function post(path, payload, headers = {}) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  try {
    const body = await res.json();
    return { status: res.status, ok: res.ok, body };
  } catch {
    return { status: res.status, ok: res.ok, body: {} };
  }
}

async function postFormData(path, formData, headers = {}) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers,
    body: formData,
  });
  try {
    const body = await res.json();
    return { status: res.status, ok: res.ok, body };
  } catch {
    return { status: res.status, ok: res.ok, body: {} };
  }
}

// ---------------------------------------------------------------------------
// Auth token (shared across authenticated tests)
// ---------------------------------------------------------------------------

let authToken = null;

before(async () => {
  const { body } = await post('/auth/login', {
    email: 'john@veteran.example',
    password: 'SecurePass123',
  });
  authToken = body.accessToken ?? body.token ?? body.data?.token ?? null;
});

function authHeader() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Health', () => {
  test('GET /health — all core components ok', async () => {
    const { ok, body } = await get('/health');
    assert.ok(ok, '/health returned non-2xx');
    assert.equal(body.backend, 'ok');
    assert.equal(body.compensation, 'ok');
    assert.equal(body.financialPlanner, 'ok');
    assert.equal(body.scanner, 'ok');
    assert.equal(body.startup, 'ok');
  });

  test('GET /strs/health — STRS engine ok', async () => {
    const { ok, body } = await get('/strs/health');
    assert.ok(ok);
    assert.equal(body.success, true);
    assert.equal(body.status, 'ok');
  });
});

describe('Military Service', () => {
  test('GET /military/presumptive-knowledge — returns flattened locations and exposure rules', async () => {
    const { ok, body } = await get('/military/presumptive-knowledge');
    assert.ok(ok, `military/presumptive-knowledge failed: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data?.locations) && body.data.locations.length > 0, 'Expected flattened deployment locations');
    assert.ok(Array.isArray(body.data?.exposureRules) && body.data.exposureRules.length > 0, 'Expected exposure rules');
  });

  test('POST /military/match-deployment — returns structured deployment evidence', async () => {
    const { ok, body } = await post('/military/match-deployment', {
      deployment: {
        location: 'Afghanistan',
        startDate: '2011-03-01',
        endDate: '2012-02-01',
      },
    });
    assert.ok(ok, `military/match-deployment failed: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
    assert.equal(body.data?.type, 'Deployment');
    assert.equal(body.data?.presumptiveMatch, true);
    assert.equal(body.data?.matchedCategory, 'Burn Pits / Airborne Hazards (PACT Act)');
    assert.deepEqual(body.data?.matchedDateRange, { start: '2001-09-11', end: 'present' });
  });
});

describe('Auth', () => {
  test('POST /auth/login — returns JWT token', async () => {
    const { ok, body } = await post('/auth/login', {
      email: 'john@veteran.example',
      password: 'SecurePass123',
    });
    assert.ok(ok, `login failed: ${JSON.stringify(body)}`);
    const token = body.accessToken ?? body.token ?? body.data?.token;
    assert.ok(token, 'No accessToken in login response');
    authToken = token;
  });

  test('GET /auth/me — returns authenticated user context', async () => {
    const { ok, body } = await get('/auth/me', authHeader());
    assert.ok(ok, `auth/me failed: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
    assert.ok(body.user?.veteranId, 'No veteranId in profile response');
    assert.ok(body.user?.role, 'No role in profile response');
  });

  test('POST /auth/verify — validates token', async () => {
    const { ok, body } = await post('/auth/verify', {}, authHeader());
    assert.ok(ok, `auth/verify failed: ${JSON.stringify(body)}`);
    assert.ok(body.valid ?? body.success, 'Token reported invalid');
  });
});

describe('Compensation', () => {
  test('GET /compensation/years — returns year list', async () => {
    const { ok, body } = await get('/compensation/years');
    assert.ok(ok);
    const years = body.data ?? body.years ?? body;
    assert.ok(Array.isArray(years) || (years && typeof years === 'object'), 'Expected years data');
  });

  test('GET /compensation?rating=70&dependents=true — returns monthly amount', async () => {
    const { ok, body } = await get('/compensation?rating=70&dependents=true');
    assert.ok(ok, `comp GET failed: ${JSON.stringify(body)}`);
    const monthly = body.totalMonthly ?? body.monthly ?? body.data?.monthly ?? body.data?.monthlyRate;
    assert.ok(typeof monthly === 'number', `Expected numeric monthly, got: ${JSON.stringify(body)}`);
    assert.ok(monthly > 0, 'Monthly compensation should be > 0');
  });

  test('POST /compensation/quote — returns quote', async () => {
    const { ok, body } = await post('/compensation/quote', {
      rating: 70,
      dependents: { spouse: true, children: 0 },
    });
    assert.ok(ok, `comp/quote failed: ${JSON.stringify(body)}`);
    assert.ok(body.success !== false, 'Quote response indicated failure');
  });
});

describe('Cases', () => {
  test('GET /cases — returns case list', async () => {
    const { ok, body } = await get('/cases');
    assert.ok(ok);
    const data = body.data ?? body.cases ?? body;
    assert.ok(Array.isArray(data), 'Expected cases array');
  });

  test('GET /cases/search?q=PTSD — returns search results', async () => {
    const { ok, body } = await get('/cases/search?q=PTSD');
    assert.ok(ok, `cases/search failed: ${JSON.stringify(body)}`);
    const results = body.data ?? body.results ?? body;
    assert.ok(Array.isArray(results), 'Expected results array');
  });
});

describe('Knowledge Base', () => {
  test('GET /knowledge/status — returns section counts', async () => {
    const { ok, body } = await get('/knowledge/status');
    assert.ok(ok, `knowledge/status failed: ${JSON.stringify(body)}`);
    // Response shape: { success, stats: { part3Sections, part4Sections, ... } }
    const part3Count = body.stats?.part3Sections ?? body.data?.part3?.sections ?? body.data?.part3Count ?? 0;
    assert.ok(part3Count > 0, `Expected Part 3 sections > 0, got: ${part3Count}`);
  });
});

describe('State Benefits', () => {
  test('GET /state-benefits/states — returns all 50 states', async () => {
    const { ok, body } = await get('/state-benefits/states');
    assert.ok(ok, `state-benefits/states failed: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data) && body.data.length > 0, 'Expected non-empty states array');
    assert.ok(body.count >= 50, `Expected >= 50 states, got ${body.count}`);
  });

  test('GET /state-benefits/AK — returns Alaska benefits', async () => {
    const { ok, body } = await get('/state-benefits/AK');
    assert.ok(ok);
    assert.equal(body.success, true);
    assert.equal(body.data.code, 'AK');
    assert.ok(body.data.categories, 'Expected categories on AK state data');
  });

  test('GET /state-benefits/search?q=property+tax — returns matches', async () => {
    const { ok, body } = await get('/state-benefits/search?q=property+tax');
    assert.ok(ok);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data) && body.data.length > 0, 'Expected property tax results');
  });

  test('POST /state-benefits/compare — compares CA, TX, NY', async () => {
    const { ok, body } = await post('/state-benefits/compare', { states: ['CA', 'TX', 'NY'] });
    assert.ok(ok, `state-benefits/compare failed: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
    assert.ok(body.data?.CA || body.data?.TX || body.data?.NY, 'Expected state comparison data');
  });
});

describe('Financial Planner', () => {
  test('POST /financial/budget — returns budget analysis', async () => {
    const { ok, body } = await post('/financial/budget', {
      monthlyIncome: 3500,
      expenses: { housing: 1200, food: 400, transportation: 200 },
    }, authHeader());
    assert.ok(ok, `financial/budget failed: ${JSON.stringify(body)}`);
    assert.ok(body.success !== false, 'Budget analysis failed');
  });
});

describe('STRS Scanner', () => {
  test('POST /strs/upload-sync — extracts conditions from STR text', async () => {
    const form = new FormData();
    form.append('strs', new Blob(
      ['DIAGNOSIS: The veteran has a diagnosis of PTSD (post-traumatic stress disorder). Service connection is established.'],
      { type: 'text/plain' }
    ), 'test-str.txt');

    const { ok, body } = await postFormData('/strs/upload-sync', form, authHeader());
    assert.ok(ok, `strs/upload-sync failed: ${JSON.stringify(body)}`);

    const diagnoses = body.Extracted?.Diagnoses ?? [];
    const injuries = body.Extracted?.Injuries ?? [];
    const events = body.Extracted?.Events ?? [];
    const extractedItems = [...diagnoses, ...injuries, ...events];

    assert.ok(Array.isArray(diagnoses), 'Expected Extracted.Diagnoses array in STRS response');
    assert.ok(extractedItems.length > 0, 'Expected at least one extracted STRS item');

    const hasPtsdSignal = extractedItems.some(item =>
      JSON.stringify(item).toLowerCase().includes('ptsd') ||
      JSON.stringify(item).toLowerCase().includes('stress')
    );
    assert.ok(hasPtsdSignal, 'Expected PTSD/stress condition to be extracted');
  });
});
