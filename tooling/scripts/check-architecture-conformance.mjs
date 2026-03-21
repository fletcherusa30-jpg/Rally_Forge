import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const checks = [
  { name: 'routeManifest', path: 'backend/api/routeManifest.js' },
  { name: 'appEntry', path: 'backend/app.js' },
  { name: 'errorCore', path: 'backend/core/errors/AppError.js' },
  { name: 'auditEndpoint', path: 'backend/api/auditMetadata.js' },
  { name: 'auditController', path: 'backend/controllers/auditMetadataController.js' },
  { name: 'auditService', path: 'backend/services/auditMetadataService.js' },
  { name: 'auditEngine', path: 'backend/engine/auditMetadataEngine.js' },
  { name: 'uiSystemHealth', path: 'app/frontend-modern/src/pages/SystemHealth.jsx' },
  { name: 'uiSystemAuditHook', path: 'app/frontend-modern/src/hooks/useSystemAudit.js' },
  { name: 'scannerUnifiedEngine', path: 'backend/engine/scanner/UnifiedScannerEngine.js' },
  { name: 'routeSchemas', path: 'backend/validation/routeSchemas.js' },
];

async function exists(relativePath) {
  try {
    await fs.access(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const results = await Promise.all(checks.map(async (check) => ({
    ...check,
    ok: await exists(check.path),
  })));

  const missing = results.filter((item) => !item.ok).map((item) => item.path);
  const payload = {
    ok: missing.length === 0,
    totalChecks: results.length,
    missing,
    results,
  };

  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
