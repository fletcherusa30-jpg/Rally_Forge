/**
 * Scanner PDF async job queue v2.0 — Modernized Redis Queue per .copilot-instructions.md
 *
 * Storage strategy:
 *   Redis available  → jobs stored in Redis LISTs + HASHes (persistent, cross-process).
 *   Redis unavailable → jobs stored in in-memory Map/Array (single-process, dev only).
 * Jobs are never silently dropped.
 *
 * Job schema v2.0:
 *   jobId         string   — unique identifier
 *   createdAt     string   — ISO timestamp
 *   source        string   — "scan-pdf" | "scan-dd214" | "scan-str" | "scan-rating-decision"
 *   scannerVersion string   — "2.0.0" (OCR v2), "3.0.0" (DD214 v3, STR v3), "4.2.0" (RD v4.2)
 *   fileMeta      object   — { fileName, fileSize, pagesHint? }
 *   payload       object   — { tempFilePath, options? }
 *   status        string   — queued | processing | completed | failed
 *   resultMeta    object   — set on completion or failure
 */

import crypto from 'node:crypto';
import { isRedisAvailable, getRedisClient } from '../../config/redisConfig.js';

const QUEUE_KEY  = 'scanner:pdf:queue:v2';
const JOB_PREFIX = 'scanner:pdf:job:v2:';
const JOB_TTL_SEC = 86400;

const _memQueue = [];
const _memJobs  = new Map();

function _newJobId() {
  return `pdf-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function _serialize(job) {
  return JSON.stringify(job);
}

function _deserialize(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

/**
 * Enqueue a new PDF job (v2.0 with scanner version tracking).
 * @param {{ source: string, scannerVersion?: string, fileMeta: object, payload: object }} opts
 * @returns {Promise<string>} jobId
 */
export async function enqueuePdfJob({ source, scannerVersion = '2.0.0', fileMeta, payload }) {
  const jobId = _newJobId();
  const job = {
    jobId,
    createdAt: new Date().toISOString(),
    source,
    scannerVersion,
    fileMeta,
    payload,
    status: 'queued',
    resultMeta: null,
  };

  const client = getRedisClient();
  if (isRedisAvailable() && client) {
    await client.hset(`${JOB_PREFIX}${jobId}`, 'data', _serialize(job));
    await client.expire(`${JOB_PREFIX}${jobId}`, JOB_TTL_SEC);
    await client.lpush(QUEUE_KEY, jobId);
    console.log(`[PdfQueue] Job ${jobId} enqueued to Redis (source: ${source})`);
  } else {
    _memJobs.set(jobId, job);
    _memQueue.push(jobId);
    console.log(`[PdfQueue] Job ${jobId} enqueued to in-memory fallback (source: ${source})`);
  }

  return jobId;
}

/**
 * Dequeue the next pending job (FIFO). Returns null when queue is empty.
 * The returned job is immediately marked as 'processing'.
 * @returns {Promise<object|null>}
 */
export async function dequeuePdfJob() {
  const client = getRedisClient();
  if (isRedisAvailable() && client) {
    const jobId = await client.rpop(QUEUE_KEY);
    if (!jobId) return null;
    const raw = await client.hget(`${JOB_PREFIX}${jobId}`, 'data');
    const job = _deserialize(raw);
    if (!job) return null;
    job.status = 'processing';
    await client.hset(`${JOB_PREFIX}${jobId}`, 'data', _serialize(job));
    return job;
  } else {
    const jobId = _memQueue.shift();
    if (!jobId) return null;
    const job = _memJobs.get(jobId);
    if (!job) return null;
    job.status = 'processing';
    return job;
  }
}

/**
 * Mark a job as completed with result metadata.
 * @param {string} jobId
 * @param {object} resultMeta
 */
export async function markJobCompleted(jobId, resultMeta) {
  const client = getRedisClient();
  if (isRedisAvailable() && client) {
    const raw = await client.hget(`${JOB_PREFIX}${jobId}`, 'data');
    const job = _deserialize(raw);
    if (!job) return;
    job.status = 'completed';
    job.resultMeta = resultMeta;
    job.completedAt = new Date().toISOString();
    await client.hset(`${JOB_PREFIX}${jobId}`, 'data', _serialize(job));
    console.log(`[PdfQueue] Job ${jobId} marked completed`);
  } else {
    const job = _memJobs.get(jobId);
    if (!job) return;
    job.status = 'completed';
    job.resultMeta = resultMeta;
    job.completedAt = new Date().toISOString();
  }
}

/**
 * Mark a job as failed with an error message.
 * @param {string} jobId
 * @param {string} errorMessage
 */
export async function markJobFailed(jobId, errorMessage) {
  const client = getRedisClient();
  if (isRedisAvailable() && client) {
    const raw = await client.hget(`${JOB_PREFIX}${jobId}`, 'data');
    const job = _deserialize(raw);
    if (!job) return;
    job.status = 'failed';
    job.resultMeta = { success: false, errorMessage };
    job.failedAt = new Date().toISOString();
    await client.hset(`${JOB_PREFIX}${jobId}`, 'data', _serialize(job));
    console.warn(`[PdfQueue] Job ${jobId} marked failed: ${errorMessage}`);
  } else {
    const job = _memJobs.get(jobId);
    if (!job) return;
    job.status = 'failed';
    job.resultMeta = { success: false, errorMessage };
    job.failedAt = new Date().toISOString();
  }
}

/**
 * Retrieve a job by ID for status polling.
 * @param {string} jobId
 * @returns {Promise<object|null>}
 */
export async function getJob(jobId) {
  const client = getRedisClient();
  if (isRedisAvailable() && client) {
    const raw = await client.hget(`${JOB_PREFIX}${jobId}`, 'data');
    return _deserialize(raw);
  } else {
    return _memJobs.get(jobId) ?? null;
  }
}
