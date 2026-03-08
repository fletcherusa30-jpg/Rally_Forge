import { generateResponse } from './aiClient.js';
import { selectModel } from './modelRouter.js';

export async function runLocalAI(modelName, prompt, taskType) {
  const selectedModel = selectModel(taskType, modelName);
  const result = await generateResponse(modelName || selectedModel, prompt);
  return result;
}

export function createRunAiEndpointExample() {
  return async function runAiExampleHandler(req, res) {
    try {
      const { modelName, prompt, taskType } = req.body || {};
      const result = await runLocalAI(modelName, prompt, taskType);
      return res.json({ success: true, result });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error?.message || 'AI request failed'
      });
    }
  };
}
