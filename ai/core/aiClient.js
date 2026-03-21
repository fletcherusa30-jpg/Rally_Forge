const OLLAMA_GENERATE_URL = 'http://localhost:11434/api/generate';
const DEFAULT_TIMEOUT_MS = 60_000;

function validateInputs(modelName, prompt) {
  if (!modelName || typeof modelName !== 'string') {
    throw new Error('modelName is required and must be a string');
  }

  if (typeof prompt !== 'string') {
    throw new Error('prompt must be a string');
  }
}

async function readStreamedText(response) {
  if (!response.body) {
    throw new Error('Streaming not supported by response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let output = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const chunk = line.trim();
      if (!chunk) continue;

      try {
        const parsed = JSON.parse(chunk);
        if (typeof parsed.response === 'string') {
          output += parsed.response;
        }
      } catch {
        // Ignore malformed chunk lines and continue streaming
      }
    }
  }

  if (buffer.trim()) {
    try {
      const parsed = JSON.parse(buffer.trim());
      if (typeof parsed.response === 'string') {
        output += parsed.response;
      }
    } catch {
      // Ignore trailing malformed buffer
    }
  }

  return output;
}

export async function generateResponse(modelName, prompt, options = {}) {
  validateInputs(modelName, prompt);

  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const stream = options.stream === true;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OLLAMA_GENERATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        prompt,
        stream
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Ollama request failed (${response.status}): ${errorBody || response.statusText}`);
    }

    if (stream) {
      return await readStreamedText(response);
    }

    const payload = await response.json();

    if (!payload || typeof payload.response !== 'string') {
      throw new Error('Invalid Ollama response payload');
    }

    return payload.response;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Ollama request timed out after ${timeoutMs}ms`);
    }

    throw new Error(`generateResponse failed: ${error?.message || 'Unknown error'}`);
  } finally {
    clearTimeout(timeoutId);
  }
}
