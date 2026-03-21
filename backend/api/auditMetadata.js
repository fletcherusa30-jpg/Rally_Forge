import express from 'express';
import { asyncHandler } from '../core/index.js';
import { getAuditMetadata, postAuditResolveAll, postAuditScan } from '../controllers/auditMetadataController.js';

const router = express.Router();

router.get('/metadata', asyncHandler(getAuditMetadata));
router.post('/scan', asyncHandler(postAuditScan));
router.post('/resolve-all', asyncHandler(postAuditResolveAll));

export default router;
