import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const requiredDocs = [
  'MD files/architecture.md',
  'MD files/workflows.md',
  'MD files/engines.md',
  'MD files/scanners.md',
  'MD files/services.md',
  'MD files/ui.md',
  'MD files/backend.md',
  'MD files/benefits.md',
  'MD files/knowledge.md',
  'MD files/resources.md',
  'MD files/modernization.md',
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
  const checks = await Promise.all(requiredDocs.map(async (doc) => ({
    path: doc,
    ok: await exists(doc),
  })));

  const missing = checks.filter((item) => !item.ok).map((item) => item.path);
  const result = {
    ok: missing.length === 0,
    required: requiredDocs.length,
    missing,
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
