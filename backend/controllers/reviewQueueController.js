import { createReviewRecord, listReviewRecords } from '../services/reviewQueueService.js';

export async function listReviews(req, res) {
  const status = req.query.status ? String(req.query.status) : undefined;
  const records = await listReviewRecords({ status });
  return res.json({ success: true, data: records, count: records.length });
}

export async function submitReview(req, res) {
  const body = req.body || {};
  if (!body.fileName && !body.fileFingerprint) {
    return res.status(400).json({ success: false, error: 'fileName or fileFingerprint is required' });
  }

  const record = await createReviewRecord({
    status: body.status || 'reviewed',
    note: body.note || '',
    extraction: body.extraction || {},
    quality: body.quality || {},
    fileName: body.fileName || null,
    fileFingerprint: body.fileFingerprint || null,
    parserProfile: body.parserProfile || null,
    reviewer: body.reviewer || 'operator',
  });

  return res.json({ success: true, data: record });
}
