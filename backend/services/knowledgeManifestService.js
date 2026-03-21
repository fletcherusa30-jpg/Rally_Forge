import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KNOWLEDGE_DIR = path.resolve(__dirname, '../../knowledge');
const MANIFEST_CANDIDATES = [
  path.join(KNOWLEDGE_DIR, 'knowledge-release-manifest.json'),
  path.join(KNOWLEDGE_DIR, 'MEDICAL_KNOWLEDGE', 'conditions', 'knowledge-release-manifest.json'),
];

let cachedManifestPath = null;

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findManifestFileRecursive(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isFile() && entry.name === 'knowledge-release-manifest.json') {
      return fullPath;
    }

    if (entry.isDirectory() && !entry.name.startsWith('_')) {
      const nested = await findManifestFileRecursive(fullPath);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

async function resolveManifestFile() {
  if (cachedManifestPath && await fileExists(cachedManifestPath)) {
    return cachedManifestPath;
  }

  for (const candidate of MANIFEST_CANDIDATES) {
    if (await fileExists(candidate)) {
      cachedManifestPath = candidate;
      return candidate;
    }
  }

  const discovered = await findManifestFileRecursive(KNOWLEDGE_DIR);
  if (discovered) {
    cachedManifestPath = discovered;
    return discovered;
  }

  return MANIFEST_CANDIDATES[0];
}

async function sha256File(filePath) {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function getKnowledgeManifestIntegrity() {
  const manifestFile = await resolveManifestFile();
  const manifestDir = path.dirname(manifestFile);
  const result = {
    manifestPath: manifestFile,
    manifestExists: false,
    releaseId: null,
    filesChecked: 0,
    missingFiles: [],
    checksums: {
      checked: 0,
      generatedOrSkipped: 0,
      mismatched: [],
    },
  };

  try {
    await fs.access(manifestFile);
    result.manifestExists = true;
  } catch {
    return {
      success: false,
      status: 'manifest_missing',
      ...result,
    };
  }

  const rawManifest = await fs.readFile(manifestFile, 'utf-8');
  const manifest = JSON.parse(rawManifest || '{}');
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  const checksums = manifest.checksums && typeof manifest.checksums === 'object' ? manifest.checksums : {};

  result.releaseId = manifest.releaseId || null;
  result.filesChecked = files.length;

  for (const relativePath of files) {
    const expectedChecksum = checksums[relativePath];
    if (!expectedChecksum || expectedChecksum === 'generated') {
      result.checksums.generatedOrSkipped += 1;
      continue;
    }

    const fullPath = path.join(manifestDir, relativePath);
    try {
      await fs.access(fullPath);
    } catch {
      result.missingFiles.push(relativePath);
      continue;
    }

    const actualChecksum = await sha256File(fullPath);
    result.checksums.checked += 1;
    if (actualChecksum !== expectedChecksum) {
      result.checksums.mismatched.push({
        file: relativePath,
        expected: expectedChecksum,
        actual: actualChecksum,
      });
    }
  }

  const healthy = result.missingFiles.length === 0 && result.checksums.mismatched.length === 0;

  return {
    success: healthy,
    status: healthy ? 'ok' : 'integrity_issues',
    ...result,
  };
}
