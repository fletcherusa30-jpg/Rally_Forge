import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, 'config.json');

function loadConfig() {
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid AI config format');
  }

  if (!Array.isArray(parsed.models) || typeof parsed.defaultModel !== 'string') {
    throw new Error('AI config is missing required fields');
  }

  return parsed;
}

export function selectModel(taskType, userSelectedModel = null) {
  const config = loadConfig();

  if (userSelectedModel && config.models.includes(userSelectedModel)) {
    return userSelectedModel;
  }

  switch (taskType) {
    case 'summarization':
    case 'classification':
    case 'extraction':
    default:
      return config.defaultModel;
  }
}
