import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const ANALYZER_INDEX_PATH = path.join(REPO_ROOT, 'knowledge', 'analyzer', 'analyzer-index.json');

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parseAnalyzerJsonBuffer(buffer) {
  const attempts = [
    buffer.toString('utf-8'),
    buffer.toString('utf16le'),
  ];

  for (const text of attempts) {
    const normalized = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!normalized) {
      continue;
    }

    try {
      return JSON.parse(normalized);
    } catch {
      // Try next decode variant.
    }
  }

  throw new Error('Unable to parse analyzer-index.json (unsupported encoding or invalid JSON).');
}

export async function readAnalyzerIndex() {
  const raw = await fs.readFile(ANALYZER_INDEX_PATH);
  const parsed = parseAnalyzerJsonBuffer(raw);

  const mos = safeObject(parsed?.mos);
  const exposures = safeObject(parsed?.exposures);
  const cfr = Array.isArray(parsed?.cfr) ? parsed.cfr : [];

  const mosCount = Object.values(mos).reduce((total, rows) => {
    const count = Array.isArray(rows) ? rows.length : 0;
    return total + count;
  }, 0);

  return {
    generated: parsed?.generated || null,
    mos,
    exposures,
    cfr,
    counts: {
      mosBranches: Object.keys(mos).length,
      mosRows: mosCount,
      exposureFamilies: Array.isArray(exposures?.value) ? exposures.value.length : 0,
      cfrRows: cfr.length,
    },
    loadedAt: new Date().toISOString(),
  };
}