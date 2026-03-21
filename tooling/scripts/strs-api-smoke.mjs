import { createApp } from '../../backend/app.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const response = await fetch(url, { ...options, signal: controller.signal });
  clearTimeout(timeout);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { response, body };
}

async function run() {
  const app = createApp();

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, () => resolve(instance));
    instance.on('error', reject);
  });

  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const checks = [];

  try {
    const health = await requestJson(`${base}/api/health`);
    assert(health.response.status === 200, `GET /api/health expected 200, got ${health.response.status}`);
    assert(health.body?.api?.routesMounted > 0, 'GET /api/health missing api.routesMounted');
    checks.push('GET /api/health');

    const strsHealth = await requestJson(`${base}/api/strs/health`);
    assert(strsHealth.response.status === 200, `GET /api/strs/health expected 200, got ${strsHealth.response.status}`);
    assert(strsHealth.body?.success === true, 'GET /api/strs/health success should be true');
    checks.push('GET /api/strs/health');

    const form = new FormData();
    form.append('strs', new Blob(['LOD determination for back injury in service.'], { type: 'text/plain' }), 'smoke-strs.txt');

    const upload = await requestJson(`${base}/api/strs/upload`, {
      method: 'POST',
      body: form,
    });

    assert(upload.response.status === 202, `POST /api/strs/upload expected 202, got ${upload.response.status}`);
    assert(upload.body?.success === true, 'POST /api/strs/upload success should be true');
    assert(['queued', 'fallback_sync'].includes(upload.body?.status), `Unexpected upload status: ${upload.body?.status}`);
    checks.push('POST /api/strs/upload');

    const queueStats = await requestJson(`${base}/api/strs/queue/stats`);
    assert(queueStats.response.status === 200, `GET /api/strs/queue/stats expected 200, got ${queueStats.response.status}`);
    assert(queueStats.body?.success === true, 'GET /api/strs/queue/stats success should be true');
    checks.push('GET /api/strs/queue/stats');

    if (upload.body?.status === 'queued' && upload.body?.jobId) {
      const status = await requestJson(`${base}/api/strs/status/${encodeURIComponent(upload.body.jobId)}`);
      assert(status.response.status === 200, `GET /api/strs/status/:jobId expected 200, got ${status.response.status}`);
      assert(status.body?.success === true, 'GET /api/strs/status/:jobId success should be true');
      checks.push('GET /api/strs/status/:jobId (queued flow)');
    } else {
      const queueUnavailable = String(queueStats.body?.queue?.status || '').toLowerCase() === 'unavailable';
      if (queueUnavailable) {
        checks.push('GET /api/strs/status/:jobId (skipped: queue unavailable)');
      } else {
        const status = await requestJson(`${base}/api/strs/status/smoke-nonexistent-job`);
        assert([404, 503].includes(status.response.status), `GET /api/strs/status/nonexistent expected 404 or 503, got ${status.response.status}`);
        checks.push('GET /api/strs/status/:jobId (fallback flow)');
      }
    }

    console.log('STR API smoke checks passed:');
    for (const check of checks) {
      console.log(`- ${check}`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error('STR API smoke failed:', error.message);
  process.exit(1);
}).then(() => {
  process.exit(0);
});
