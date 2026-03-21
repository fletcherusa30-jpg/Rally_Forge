import { spawn } from 'node:child_process';

function run(cmd, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function waitForHealth(url, timeoutMs = 35000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // wait and retry
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  return false;
}

async function main() {
  await run('node', ['tooling/scripts/free-dev-ports.mjs']);

  const backend = spawn(process.execPath, ['backend/server.js'], {
    stdio: 'inherit',
    windowsHide: true,
  });

  try {
    const ready = await waitForHealth('http://localhost:4000/api/health', 35000);
    if (!ready) {
      console.error('[api-smoke-runner] Backend health did not come up in time.');
      process.exit(1);
    }

    const testCode = await run('node', ['--test', 'tests/system/api-smoke.test.js']);
    process.exit(testCode);
  } finally {
    if (!backend.killed) {
      backend.kill('SIGTERM');
    }
  }
}

main().catch((err) => {
  console.error('[api-smoke-runner] Fatal error:', err.message);
  process.exit(1);
});
