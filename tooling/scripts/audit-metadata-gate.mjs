import { createApp } from '../../backend/app.js';

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    failOnWarn: args.has('--fail-on-warn'),
    pretty: args.has('--pretty'),
  };
}

async function withServer(run) {
  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;

  try {
    return await run(`http://localhost:${port}`);
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

async function main() {
  const { failOnWarn, pretty } = parseArgs(process.argv);

  const result = await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/audit/metadata`);
    const body = await response.json();
    return {
      status: response.status,
      ok: response.ok,
      body,
    };
  });

  if (!result.ok || !result.body?.success) {
    console.log(JSON.stringify({ ok: false, reason: 'endpoint_failure', result }, null, pretty ? 2 : 0));
    process.exitCode = 1;
    return;
  }

  const data = result.body.data || {};
  const status = data.health?.status || 'fail';
  const output = {
    ok: status === 'pass' || (!failOnWarn && status === 'warn'),
    endpointVersion: data.endpointVersion,
    schemaVersion: data.schemaVersion,
    healthStatus: status,
    staleSources: data.freshness?.staleSources || [],
    warnings: data.health?.warnings || [],
    errors: data.health?.errors || [],
  };

  console.log(JSON.stringify(output, null, pretty ? 2 : 0));

  if (status === 'fail' || (failOnWarn && status === 'warn')) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
