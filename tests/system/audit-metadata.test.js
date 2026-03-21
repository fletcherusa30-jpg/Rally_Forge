import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';

async function withServer(run) {
  const app = createApp();
  const server = app.listen(0);

  await new Promise((resolve) => {
    server.once('listening', resolve);
  });

  const port = server.address().port;
  const base = `http://localhost:${port}/api`;

  try {
    return await run(base);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

async function get(base, path) {
  const res = await fetch(base + path);
  try {
    const body = await res.json();
    return { status: res.status, ok: res.ok, body };
  } catch {
    return { status: res.status, ok: res.ok, body: {} };
  }
}

async function post(base, path, payload = {}) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  try {
    const body = await res.json();
    return { status: res.status, ok: res.ok, body };
  } catch {
    return { status: res.status, ok: res.ok, body: {} };
  }
}

describe('Audit Metadata Endpoint', () => {
  test('GET /audit/metadata returns canonical metadata object', async () => {
    const { ok, body } = await withServer((base) => get(base, '/audit/metadata'));
    assert.ok(ok, `audit metadata failed: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);

    const data = body.data || {};
    assert.equal(typeof data.endpointVersion, 'string');
    assert.equal(typeof data.schemaVersion, 'string');

    const topLevelKeys = ['snapshot', 'audit', 'drift', 'modernization', 'freshness', 'health', 'provenance', 'confidence'];
    topLevelKeys.forEach((key) => {
      assert.ok(data[key], `Expected key '${key}' in audit metadata payload`);
    });

    assert.equal(typeof data.health.pass, 'boolean');
    assert.ok(['pass', 'warn', 'fail'].includes(data.health.status));
    assert.ok(Array.isArray(data.health.warnings));
    assert.ok(Array.isArray(data.health.errors));

    assert.equal(typeof data.confidence.score, 'number');
    assert.ok(data.confidence.score >= 0 && data.confidence.score <= 1);
    assert.ok(Array.isArray(data.freshness.sources));
  });

  test('GET /audit/metadata rejects query parameters', async () => {
    const { status, body } = await withServer((base) => get(base, '/audit/metadata?foo=bar'));
    assert.equal(status, 400);
    assert.equal(body.success, false);
  });

  test('POST /audit/scan returns architecture, structure, capabilities, and enhancements', async () => {
    const { ok, body } = await withServer((base) => post(base, '/audit/scan'));
    assert.ok(ok, `audit scan failed: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);

    const data = body.data || {};
    assert.equal(typeof data.scanVersion, 'string');
    assert.equal(typeof data.generatedAt, 'string');
    assert.ok(['pass', 'warn', 'fail', 'unknown'].includes(data.overallStatus));
    assert.deepEqual(data.scope, ['architecture', 'structure', 'capabilities']);

    assert.equal(typeof data.architecture, 'object');
    assert.equal(typeof data.structure, 'object');
    assert.equal(typeof data.capabilities, 'object');
    assert.ok(Array.isArray(data.enhancements));

    if (data.enhancements.length > 0) {
      const item = data.enhancements[0];
      assert.equal(typeof item.title, 'string');
      assert.ok(['high', 'medium', 'low'].includes(item.priority));
      assert.equal(typeof item.resolution, 'string');
    }
  });

  test('POST /audit/resolve-all returns remediation actions and before/after scan summaries', async () => {
    const { ok, body } = await withServer((base) => post(base, '/audit/resolve-all'));
    assert.ok(ok, `audit resolve-all failed: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);

    const data = body.data || {};
    assert.equal(typeof data.version, 'string');
    assert.equal(typeof data.generatedAt, 'string');
    assert.ok(Array.isArray(data.actions), 'Expected remediation actions array');
    assert.equal(typeof data.before, 'object');
    assert.equal(typeof data.after, 'object');
    assert.equal(typeof data.summary, 'object');
    assert.ok(Array.isArray(data.summary.resolvedRecommendations));
    assert.ok(Array.isArray(data.summary.openRecommendations));
    assert.equal(typeof data.summary.totalBefore, 'number');
    assert.equal(typeof data.summary.totalAfter, 'number');
  });
});
