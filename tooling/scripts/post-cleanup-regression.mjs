import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../backend/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      shell: process.platform === 'win32',
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code) => {
      resolve({ ok: code === 0, code });
    });
  });
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

async function checkEndpoint(baseUrl, endpoint, expectedStatuses = [200]) {
  try {
    const response = await fetch(`${baseUrl}${endpoint}`);
    return {
      endpoint,
      status: response.status,
      ok: expectedStatuses.includes(response.status),
    };
  } catch (error) {
    return {
      endpoint,
      status: null,
      ok: false,
      error: error.message,
    };
  }
}

async function main() {
  const checks = [];

  checks.push({ section: 'scanner', name: 'DD214 scanner regression', command: ['npm', 'run', 'test:dd214'] });
  checks.push({ section: 'scanner', name: 'STR scanner regression', command: ['npm', 'run', 'test:strs-engine'] });
  checks.push({ section: 'scanner', name: 'CTR scanner regression', command: ['npm', 'run', 'test:current-treatment'] });
  checks.push({ section: 'scanner', name: 'Rating/Fusion regression', command: ['node', '--test', 'tests/scanner/deterministic-fusion.test.js'] });

  checks.push({ section: 'url', name: 'URL manifest validation', command: ['node', 'tooling/scripts/url-restoration-validator.mjs', '--pretty'] });

  const commandResults = [];
  for (const check of checks) {
    const [command, ...args] = check.command;
    const result = await runCommand(command, args);
    commandResults.push({ ...check, ok: result.ok, code: result.code });
  }

  const serviceResults = await withServer(async (baseUrl) => {
    const endpoints = [
      ['/api/cfr/status', [200]],
      ['/api/claim-workspace/dbq-index', [200]],
      ['/api/claim-workspace/analyzer-index', [200]],
      ['/api/knowledge/diagnostic-code/5237', [200, 404]],
      ['/api/evidence-graph/status', [200]],
    ];

    const resolved = [];
    for (const [endpoint, statuses] of endpoints) {
      resolved.push(await checkEndpoint(baseUrl, endpoint, statuses));
    }
    return resolved;
  });

  const staticAssets = [
    'ai/config.json',
    'financial-planner.html',
    'public/favicon.svg',
    'public/LOGO.png',
  ];

  const staticResults = [];
  for (const relPath of staticAssets) {
    try {
      await fs.access(path.join(repoRoot, relPath));
      staticResults.push({ path: relPath, ok: true });
    } catch {
      staticResults.push({ path: relPath, ok: false });
    }
  }

  const summary = {
    scannerTestsPassed: commandResults.filter((x) => x.section === 'scanner').every((x) => x.ok),
    urlValidationPassed: commandResults.filter((x) => x.section === 'url').every((x) => x.ok),
    microservicesReachable: serviceResults.every((x) => x.ok),
    staticAssetsLoadable: staticResults.every((x) => x.ok),
  };

  const output = {
    commandResults,
    serviceResults,
    staticResults,
    summary,
    finalValidation: {
      allTestsPass: summary.scannerTestsPassed,
      allUrlsRestored: summary.urlValidationPassed,
      allMicroservicesReachable: summary.microservicesReachable,
      allStaticAssetsLoad: summary.staticAssetsLoadable,
      productionReady: Object.values(summary).every(Boolean),
    },
  };

  const reportPath = path.join(repoRoot, 'artifacts', 'post-cleanup-regression-report.json');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log(JSON.stringify(output, null, 2));

  if (!output.finalValidation.productionReady) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
