import express from 'express';
import { asyncHandler } from '../core/index.js';
import { listReviews, submitReview } from '../controllers/reviewQueueController.js';

const router = express.Router();

router.get('/', asyncHandler(listReviews));
router.post('/', asyncHandler(submitReview));

export default router;
