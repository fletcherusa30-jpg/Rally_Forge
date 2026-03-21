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
    assert.equal(body.knowledge, 'ok');
    assert.equal(body.knowledgeIntegrity?.status, 'ok');
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

  test('GET /knowledge/library/status — returns canonical library status', async () => {
    const { ok, body } = await get('/knowledge/library/status');
    assert.ok(ok, `knowledge/library/status failed: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
    assert.ok(body.data?.manifest, 'Expected library manifest in status response');
    assert.ok(typeof body.data?.nodeCount === 'number', 'Expected numeric nodeCount');
    assert.equal(body.data?.validation?.valid, true);
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

  test('GET /state-benefits/search?q=home+loan — returns matches', async () => {
    const { ok, body } = await get('/state-benefits/search?q=home+loan');
    assert.ok(ok);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data) && body.data.length > 0, 'Expected home loan results');
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

  describe('Evidence Graph', () => {
    const VET_ID = 'smoke-test-veteran-001';
    const BASE_EG = '/evidence-graph';

    test('GET /evidence-graph/status — returns graph status + schema registry', async () => {
      const { ok, body } = await get(BASE_EG + '/status');
      assert.ok(ok, `evidence-graph/status failed: ${JSON.stringify(body)}`);
      assert.equal(body.success, true);
      assert.ok(typeof body.graph?.nodeCount === 'number', 'Expected numeric nodeCount');
      assert.ok(typeof body.graph?.edgeCount === 'number', 'Expected numeric edgeCount');
      assert.ok(Array.isArray(body.schemas), 'Expected schemas array');
      assert.ok(body.schemas.length >= 6, 'Expected at least 6 registered schemas');
    });

    test('POST /evidence-graph/ingest/dd214 — ingests DD214 into graph', async () => {
      const dd214Data = {
        documentId:      'smoke-dd214-001',
        schemaVersion:   '2.0.0',
        serviceIdentity: { veteranName: 'SMOKE TEST', branchOfService: 'Army', component: 'Active Duty', ssnLastFour: '9999' },
        servicePeriods:  { entryDate: '2010-06-01', separationDate: '2014-05-31' },
        gradeSpecialty:  { rank: 'SGT', primaryMOSOrAFSCOrRating: '11B', additionalMOSOrSpecialties: [] },
        characterAndSeparation: { characterOfService: 'Honorable', separationCode: 'JFV', reEnlistmentCode: 'RE-1' },
        decorationsAndService:  { decorationsMedalsAwards: [], foreignServiceLocationsIfListed: ['Afghanistan'], combatIndicatorsFromAwards: [] },
        specialProgramsRemarks: { deploymentOrCampaignReferences: [] },
        extractionMeta:  { scannerVersion: '2.0.0-authoritative', pageCount: 4, usedOcr: false, extractedAt: new Date().toISOString() },
      };
      const { ok, body } = await post(BASE_EG + '/ingest/dd214', { veteranId: VET_ID, dd214Data });
      assert.ok(ok, `evidence-graph/ingest/dd214 failed: ${JSON.stringify(body)}`);
      assert.equal(body.success, true);
      assert.ok(body.nodesCreated >= 1, 'Expected at least 1 node created');
      assert.ok(body.edgesCreated >= 1, 'Expected at least 1 edge created');
    });

    test('POST /evidence-graph/ingest/str — ingests STR into graph', async () => {
      const strData = {
        documentId:       'smoke-str-001',
        schemaVersion:    '2.0.0',
        scannerVersion:   '2.0.0-authoritative',
        chronicConditions: [{ value: 'Lumbar strain', date: '2011-09-15', rawText: 'Low back pain' }],
        injuries:          [],
        medications:       [{ value: 'Ibuprofen 800mg', date: '2011-09-16', rawText: 'Rx ibuprofen' }],
        medicalEvents:     [],
        exposureEvents:    [{ value: 'Burn pit exposure', date: '2011-07-01', rawText: 'Burn pit at FOB' }],
        extractionMeta:   { scannerVersion: '2.0.0-authoritative', pageCount: 6, usedOcr: false, extractedAt: new Date().toISOString() },
      };
      const { ok, body } = await post(BASE_EG + '/ingest/str', { veteranId: VET_ID, strData });
      assert.ok(ok, `evidence-graph/ingest/str failed: ${JSON.stringify(body)}`);
      assert.equal(body.success, true);
      assert.ok(body.nodesCreated >= 1, 'Expected at least 1 node created');
    });

    test('POST /evidence-graph/ingest/rating-decision — ingests RD into graph', async () => {
      const rdData = {
        documentId:       'smoke-rd-001',
        schemaVersion:    '1.0.0',
        serviceConnected: [{ condition: 'Lumbar strain', rating: 20, date: '2015-06-10' }],
        denied:           [],
        smc:              [],
        dependents:       { spouse: false, children: 0 },
        ratingCalculation: { calculatedCombinedRating: 20, roundedCombinedRating: 20, method: 'whole-person' },
        extractionSummary: { scannerVersion: '4.2.0-cfr-aware-upgrade', extractedAt: new Date().toISOString() },
      };
      const { ok, body } = await post(BASE_EG + '/ingest/rating-decision', { veteranId: VET_ID, rdData });
      assert.ok(ok, `evidence-graph/ingest/rating-decision failed: ${JSON.stringify(body)}`);
      assert.equal(body.success, true);
      assert.ok(body.nodesCreated >= 1, 'Expected at least 1 node created');
    });

    test('GET /evidence-graph/veteran/:id/conditions — returns conditions', async () => {
      const { ok, body } = await get(`${BASE_EG}/veteran/${VET_ID}/conditions`);
      assert.ok(ok, `evidence-graph/conditions failed: ${JSON.stringify(body)}`);
      assert.equal(body.success, true);
      assert.ok(typeof body.count === 'number', 'Expected numeric count');
      assert.ok(Array.isArray(body.conditions), 'Expected conditions array');
    });

    test('GET /evidence-graph/veteran/:id/bundles — returns evidence bundles', async () => {
      const { ok, body } = await get(`${BASE_EG}/veteran/${VET_ID}/bundles`);
      assert.ok(ok, `evidence-graph/bundles failed: ${JSON.stringify(body)}`);
      assert.equal(body.success, true);
      assert.ok(typeof body.count === 'number');
      assert.ok(Array.isArray(body.bundles));
    });

    test('GET /evidence-graph/veteran/:id/timeline — returns timeline', async () => {
      const { ok, body } = await get(`${BASE_EG}/veteran/${VET_ID}/timeline`);
      assert.ok(ok, `evidence-graph/timeline failed: ${JSON.stringify(body)}`);
      assert.equal(body.success, true);
      assert.ok(typeof body.count === 'number');
      assert.ok(Array.isArray(body.timeline));
    });

    test('POST /evidence-graph/verify/:id — returns cross-verification result', async () => {
      const { ok, body } = await post(`${BASE_EG}/verify/${VET_ID}`, {});
      assert.ok(ok, `evidence-graph/verify failed: ${JSON.stringify(body)}`);
      assert.equal(body.success, true);
      assert.ok(body.result?.verificationId, 'Expected verificationId');
      assert.ok(Array.isArray(body.result?.matches || []), 'Expected matches array');
      assert.ok(Array.isArray(body.result?.mismatches || []), 'Expected mismatches array');
    });

    test('GET /evidence-graph/status — updated counts after ingest', async () => {
      const { ok, body } = await get(BASE_EG + '/status');
      assert.ok(ok, `evidence-graph/status (post-ingest) failed: ${JSON.stringify(body)}`);
      assert.equal(body.success, true);
      assert.ok(body.graph?.nodeCount > 0, 'Expected node count > 0 after ingest');
    });
  });
