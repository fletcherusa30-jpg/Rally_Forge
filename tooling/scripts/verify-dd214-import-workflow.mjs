import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const cwd = process.cwd();
const port = Number(process.env.DD214_IMPORT_TEST_PORT || 4110);
const corpusSample = path.resolve(cwd, 'tests/dd214/corpus/legacy-army-minimal/expected.json');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) return;
    } catch {
      // Keep waiting.
    }
    await wait(400);
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

function startServer() {
  const child = spawn('node', ['backend/server.js'], {
    cwd,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  return child;
}

async function main() {
  const server = startServer();

  try {
    await waitForServer(`http://localhost:${port}/api/health`);

    const payload = JSON.parse(fs.readFileSync(corpusSample, 'utf8'));
    const response = await fetch(`http://localhost:${port}/api/scanner/validate-dd214-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dd214: payload }),
    });
    const json = await response.json();

    if (!response.ok || !json?.success || json?.data?.importValidation?.portableSchema?.valid !== true || json?.data?.deterministicStatus?.ready !== true) {
      console.error(JSON.stringify({ status: response.status, body: json }, null, 2));
      process.exit(1);
    }

    console.log('dd214-import-workflow-valid');
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
