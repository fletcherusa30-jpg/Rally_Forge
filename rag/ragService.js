import { generateEmbedding } from './embedder.js';
import { search } from './vectorStore.js';
import { runLocalAI } from '../ai/aiService.js';

export async function runRAGQuery(prompt, options = {}) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('prompt is required');
  }

  const queryEmbedding = await generateEmbedding(prompt);
  const matches = search(queryEmbedding, options.limit || 5);

  const context = matches
    .map((item, index) => `[${index + 1}] ${item.text}`)
    .join('\n\n');

  const contextBlock = context ? `${context}\n\n${prompt}` : prompt;
  const result = await runLocalAI(options.modelName, contextBlock, options.taskType || 'rag');

  return result;
}
