import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const MODERNIZATION_ARTIFACTS = {
  backend: [
    'backend/api/routeManifest.js',
    'backend/core/index.js',
  ],
  ui: [
    'app/frontend-modern/src/App.jsx',
    'app/frontend-modern/src/context/ClaimWorkspaceContext.jsx',
  ],
  scanner: [
    'resources/scanner.audit.json',
  ],
  analyzer: [
    'resources/analyzer.audit.json',
  ],
  caseSummary: [
    'resources/case-summary.audit.json',
  ],
  benefits: [
    'resources/state-benefits.audit.json',
    'resources/state-benefits.snapshot.json',
    'resources/state-benefits.json',
  ],
};

async function exists(relativePath) {
  try {
    await fs.access(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

export async function getSystemModernizationStatus() {
  const entries = await Promise.all(Object.entries(MODERNIZATION_ARTIFACTS).map(async ([key, required]) => {
    const checks = await Promise.all(required.map(async (file) => ({
      file,
      found: await exists(file),
    })));

    const foundCount = checks.filter((item) => item.found).length;
    const status = foundCount === required.length ? 'modernized' : foundCount > 0 ? 'partial' : 'unknown';

    return [key, {
      status,
      evidence: required,
      missing: checks.filter((item) => !item.found).map((item) => item.file),
    }];
  }));

  return Object.fromEntries(entries);
}
