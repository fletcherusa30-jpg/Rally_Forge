import express from 'express';
import { asyncHandler } from '../core/index.js';
import { getIntelligenceStatus, analyzeIntelligence } from '../controllers/intelligenceController.js';

const router = express.Router();

router.get('/', asyncHandler(getIntelligenceStatus));
router.post('/analyze', asyncHandler(analyzeIntelligence));

export default router;

