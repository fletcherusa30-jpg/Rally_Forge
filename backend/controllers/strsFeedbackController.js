import { appendStrsFeedback, readRecentStrsFeedback, summarizeStrsFeedback } from '../services/strsFeedbackStore.js';

function sanitizeText(value, max = 4000) {
  return String(value || '').trim().slice(0, max);
}

export async function submitStrsFeedback(req, res) {
  const {
    fileName,
    findingLabel,
    findingType,
    matchedText,
    context,
    page,
    classification,
    reason,
  } = req.body || {};

  if (!sanitizeText(fileName, 300)) {
    res.status(400).json({ error: 'fileName is required' });
    return;
  }

  if (!sanitizeText(findingLabel, 300)) {
    res.status(400).json({ error: 'findingLabel is required' });
    return;
  }

  if (!sanitizeText(classification, 80)) {
    res.status(400).json({ error: 'classification is required (for example: false_positive, true_positive)' });
    return;
  }

  const normalizedPage = Number.isFinite(Number(page)) ? Number(page) : null;
  const savedAt = new Date().toISOString();

  const feedback = {
    savedAt,
    fileName: sanitizeText(fileName, 300),
    findingLabel: sanitizeText(findingLabel, 300),
    findingType: sanitizeText(findingType, 80),
    matchedText: sanitizeText(matchedText, 500),
    context: sanitizeText(context, 4000),
    page: normalizedPage,
    classification: sanitizeText(classification, 80),
    reason: sanitizeText(reason, 1000),
    source: 'ui-review',
  };

  const outputPath = appendStrsFeedback(feedback);
  res.status(201).json({ ok: true, savedAt, outputPath, feedback });
}

export async function getRecentStrsFeedback(req, res) {
  const limit = Number(req.query.limit || 50);
  const items = readRecentStrsFeedback(limit);
  res.json({ ok: true, count: items.length, items });
}

export async function getStrsFeedbackSummary(_req, res) {
  const summary = summarizeStrsFeedback();
  res.json({ ok: true, summary });
}
