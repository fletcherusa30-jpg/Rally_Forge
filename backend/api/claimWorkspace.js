import express from 'express';
import { readClaimWorkspace, writeClaimWorkspace, WorkspaceValidationError } from '../services/claimWorkspaceService.js';
import { readDbqIndex } from '../services/dbqIndexService.js';
import { readAnalyzerIndex } from '../services/analyzerIndexService.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const workspace = await readClaimWorkspace();
    res.json({ success: true, data: workspace });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/dbq-index', async (_req, res) => {
  try {
    const dbqIndex = await readDbqIndex();
    res.json({ success: true, data: dbqIndex });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/analyzer-index', async (_req, res) => {
  try {
    const analyzerIndex = await readAnalyzerIndex();
    res.json({ success: true, data: analyzerIndex });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const workspace = await writeClaimWorkspace(req.body || {});
    res.json({ success: true, data: workspace });
  } catch (error) {
    if (error instanceof WorkspaceValidationError || error?.statusCode === 400) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;