import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OLLAMA_EMBED_URL = 'http://localhost:11434/api/embeddings';
const DEFAULT_TIMEOUT_MS = 30_000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const aiConfigPath = path.join(__dirname, '..', 'ai', 'config.json');

function loadDefaultEmbeddingModel() {
  try {
    const raw = fs.readFileSync(aiConfigPath, 'utf8');
    const config = JSON.parse(raw);
    return process.env.OLLAMA_EMBED_MODEL || config.defaultModel;
  } catch {
    return process.env.OLLAMA_EMBED_MODEL || 'llama3';
  }
}

export async function generateEmbedding(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('text is required to generate embedding');
  }

  const model = loadDefaultEmbeddingModel();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(OLLAMA_EMBED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: text
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Embedding request failed (${response.status}): ${errorBody || response.statusText}`);
    }

    const payload = await response.json();
    const vector = payload?.embedding;

    if (!Array.isArray(vector) || !vector.every((value) => typeof value === 'number')) {
      throw new Error('Invalid embedding response from Ollama');
    }

    return vector;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Embedding request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
    }

    throw new Error(`generateEmbedding failed: ${error?.message || 'Unknown error'}`);
  } finally {
    clearTimeout(timeoutId);
  }
}
