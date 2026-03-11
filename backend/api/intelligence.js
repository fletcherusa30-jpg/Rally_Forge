import express from 'express';
import { asyncHandler } from '../core/index.js';
import { getIntelligenceStatus, analyzeIntelligence } from '../controllers/intelligenceController.js';

const router = express.Router();

router.get('/intelligence', asyncHandler(getIntelligenceStatus));
router.post('/intelligence/analyze', asyncHandler(analyzeIntelligence));

export default router;

