import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REVIEW_DIR = path.resolve(__dirname, '../data/review-queue');
const REVIEW_FILE = path.join(REVIEW_DIR, 'reviews.json');

async function ensureStorage() {
  await fs.mkdir(REVIEW_DIR, { recursive: true });
  try {
    await fs.access(REVIEW_FILE);
  } catch {
    await fs.writeFile(REVIEW_FILE, '[]', 'utf-8');
  }
}

async function readReviews() {
  await ensureStorage();
  const content = await fs.readFile(REVIEW_FILE, 'utf-8');
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeReviews(reviews) {
  await ensureStorage();
  await fs.writeFile(REVIEW_FILE, JSON.stringify(reviews, null, 2), 'utf-8');
}

export async function listReviewRecords({ status } = {}) {
  const all = await readReviews();
  if (!status) return all;
  return all.filter((item) => String(item.status || '').toLowerCase() === String(status).toLowerCase());
}

export async function createReviewRecord(payload = {}) {
  const reviews = await readReviews();
  const record = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: payload.status || 'reviewed',
    note: String(payload.note || '').trim() || null,
    extraction: payload.extraction || {},
    quality: payload.quality || {},
    fileName: payload.fileName || null,
    fileFingerprint: payload.fileFingerprint || null,
    parserProfile: payload.parserProfile || null,
    reviewer: payload.reviewer || 'operator',
  };

  reviews.unshift(record);
  await writeReviews(reviews);
  return record;
}
