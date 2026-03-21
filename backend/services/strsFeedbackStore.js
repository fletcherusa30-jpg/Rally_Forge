import fs from 'node:fs';
import path from 'node:path';

const FEEDBACK_DIR = path.resolve(process.cwd(), 'backend', 'data', 'strs-feedback');
const FEEDBACK_LOG = path.join(FEEDBACK_DIR, 'feedback.jsonl');

function ensureStore() {
  fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
}

export function appendStrsFeedback(entry) {
  ensureStore();
  const row = `${JSON.stringify(entry)}\n`;
  fs.appendFileSync(FEEDBACK_LOG, row, 'utf8');
  return FEEDBACK_LOG;
}

export function readRecentStrsFeedback(limit = 50) {
  ensureStore();
  if (!fs.existsSync(FEEDBACK_LOG)) {
    return [];
  }

  const lines = fs.readFileSync(FEEDBACK_LOG, 'utf8')
    .split('\n')
    .filter(Boolean)
    .slice(-Math.max(1, Math.min(500, Number(limit) || 50)));

  return lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

export function readAllStrsFeedback() {
  ensureStore();
  if (!fs.existsSync(FEEDBACK_LOG)) {
    return [];
  }

  return fs.readFileSync(FEEDBACK_LOG, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function summarizeStrsFeedback() {
  const items = readAllStrsFeedback();
  const summary = {
    total: items.length,
    truePositive: 0,
    falsePositive: 0,
    byType: {},
    topFalsePositiveLabels: [],
  };

  const falsePositiveCounts = new Map();

  items.forEach((item) => {
    const classification = String(item?.classification || '').toLowerCase();
    const findingType = String(item?.findingType || 'unknown').toLowerCase();
    summary.byType[findingType] ??= { total: 0, truePositive: 0, falsePositive: 0 };
    summary.byType[findingType].total += 1;

    if (classification === 'true_positive') {
      summary.truePositive += 1;
      summary.byType[findingType].truePositive += 1;
      return;
    }

    if (classification === 'false_positive') {
      summary.falsePositive += 1;
      summary.byType[findingType].falsePositive += 1;
      const label = String(item?.findingLabel || 'Unknown finding').trim() || 'Unknown finding';
      falsePositiveCounts.set(label, (falsePositiveCounts.get(label) || 0) + 1);
    }
  });

  summary.topFalsePositiveLabels = Array.from(falsePositiveCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  return summary;
}
