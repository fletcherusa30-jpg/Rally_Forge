import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import cfrRouter from '../../backend/api/cfr.js';

function startServer() {
  const app = express();
  app.use('/api/cfr', cfrRouter);

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      resolve({ server, port: address.port });
    });
  });
}

test('CFR API endpoints return deterministic local index metadata', async () => {
  const { server, port } = await startServer();

  try {
    const statusRes = await fetch(`http://127.0.0.1:${port}/api/cfr/status`);
    assert.equal(statusRes.status, 200);
    const statusBody = await statusRes.json();
    assert.equal(statusBody.success, true);
    assert.equal(statusBody.title, 38);

    const partRes = await fetch(`http://127.0.0.1:${port}/api/cfr/38/part/3`);
    assert.equal(partRes.status, 200);
    const partBody = await partRes.json();
    assert.equal(partBody.success, true);
    assert.equal(partBody.part.partNumber, 3);

    const sectionRes = await fetch(`http://127.0.0.1:${port}/api/cfr/38/part/3/section/3.303`);
    assert.equal(sectionRes.status, 200);
    const sectionBody = await sectionRes.json();
    assert.equal(sectionBody.success, true);
    assert.equal(sectionBody.section.sectionNumber, '3.303');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
