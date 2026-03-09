/**
 * PDF Processing Job Queue
 * Uses Bull queue to process STR PDFs asynchronously
 * Prevents large file processing from blocking main thread
 */

import Bull from 'bull';
import { getConfig } from '../config.js';
import {
  extractTextFromPdf,
  scanSTRText,
  validateScanResult
} from '../engine/strs/strs-engine.js';
import { createLogger } from '../middleware/logging.js';

const config = getConfig();
const logger = createLogger('pdf-queue');

let isQueueReady = false;
let queueError = null;
let errorLoggedOnce = false;

/**
 * Initialize PDF processing queue
 */
let pdfQueueInstance = null;

try {
  pdfQueueInstance = new Bull('pdf-processing', {
    redis: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: {
        age: 3600 // Keep completed jobs for 1 hour
      },
      removeOnFail: {
        age: 86400 // Keep failed jobs for 24 hours
      }
    }
  });

  pdfQueueInstance.on('ready', () => {
    isQueueReady = true;
    errorLoggedOnce = false;
    logger.info('PDF queue connected to Redis');
  });

  pdfQueueInstance.on('error', (err) => {
    queueError = err;
    isQueueReady = false;
    // Only log once to avoid spam
    if (!errorLoggedOnce) {
      logger.warning('PDF queue Redis connection unavailable - async processing disabled', {
        host: config.redis.host,
        port: config.redis.port,
        message: 'Start Redis to enable async PDF processing'
      });
      errorLoggedOnce = true;
    }
  });

  pdfQueueInstance.on('closed', () => {
    isQueueReady = false;
    logger.warning('PDF queue connection closed');
  });
} catch (error) {
  logger.warning('PDF queue initialization skipped - Redis not available', {
    message: error.message
  });
  queueError = error;
}

export const pdfQueue = pdfQueueInstance || {
  add: async () => { throw new Error('Queue not available'); },
  getJob: async () => { throw new Error('Queue not available'); },
  getJobCounts: async () => { throw new Error('Queue not available'); },
  getWaitingCount: async () => { throw new Error('Queue not available'); },
  getActiveCount: async () => { throw new Error('Queue not available'); },
  getDelayedCount: async () => { throw new Error('Queue not available'); },
  getFailedCount: async () => { throw new Error('Queue not available'); },
  getCompletedCount: async () => { throw new Error('Queue not available'); },
  on: () => {}
};

export const isQueueAvailable = () => isQueueReady && !queueError;

/**
 * Define PDF processing job
 */
if (pdfQueueInstance) {
  pdfQueueInstance.process(async (job) => {
  const { filePath, fileName, veteranId } = job.data;

  logger.info('Processing PDF job', {
    jobId: job.id,
    fileName,
    veteranId
  });

  try {
    // Step 1: Extract text from PDF (report progress)
    job.progress(10);
    logger.debug('Extracting text from PDF', { fileName });
    const text = await extractTextFromPdf(filePath);

    if (!text || text.length < 10) {
      throw new Error('PDF text extraction returned empty content');
    }

    logger.debug('Text extraction complete', {
      textLength: text.length,
      fileName
    });

    // Step 2: Scan text for conditions (report progress)
    job.progress(50);
    logger.debug('Scanning STR text for conditions', { fileName });
    const scanResult = scanSTRText(text);

    logger.debug('Scan complete', {
      conditions: scanResult.diagnoses?.length || 0,
      injuries: scanResult.injuries?.length || 0
    });

    // Step 3: Validate results (report progress)
    job.progress(75);
    logger.debug('Validating scan results', { fileName });
    const validated = validateScanResult(scanResult);

    // Step 4: Complete
    job.progress(100);
    logger.info('PDF processing complete', {
      jobId: job.id,
      fileName,
      successCount: validated.diagnoses?.length || 0
    });

    return {
      success: true,
      fileName,
      extracted: {
        diagnoses: validated.diagnoses || [],
        injuries: validated.injuries || [],
        medications: validated.medications || [],
        providers: validated.providers || [],
        procedures: validated.procedures || []
      },
      metadata: {
        processedAt: new Date().toISOString(),
        processingTimeMs: job.finishedOn - job.processedOn,
        textLength: text.length
      }
    };
  } catch (error) {
    logger.error('PDF processing failed', error, {
      jobId: job.id,
      fileName,
      attempt: job.attemptsMade
    });

    throw error;
  }
  });
}

/**
 * Handle job completion
 */
if (pdfQueueInstance) {
  pdfQueueInstance.on('completed', (job, _result) => {
  logger.info('Job completed successfully', {
    jobId: job.id,
    veteranId: job.data.veteranId
  });

  // Jobs can emit events to notify frontend via WebSocket
  // Example: io.emit('pdf-processing:complete', { jobId: job.id, result })
  });

  pdfQueueInstance.on('failed', (job, error) => {
    logger.error('Job failed after all retries', error, {
      jobId: job.id,
      fileName: job.data.fileName,
      attempts: job.attemptsMade
    });
  });

  pdfQueueInstance.on('stalled', (job) => {
    logger.warning('Job stalled, restarting', {
      jobId: job.id,
      fileName: job.data.fileName
    });
  });
}

/**
 * Submit PDF for processing
 * Returns job ID immediately for polling
 */
export const submitPdfForProcessing = async (filePath, fileName, veteranId) => {
  const effectiveVeteranId = veteranId || 'anonymous';

  if (!isQueueReady || queueError) {
    logger.warning('Queue not available, processing synchronously', {
      fileName,
      veteranId: effectiveVeteranId,
      queueError: queueError?.message
    });

    // Return a fallback response indicating queue is unavailable
    return {
      jobId: null,
      status: 'fallback_sync',
      fileName,
      message: 'Job queue unavailable. Redis connection required.',
      note: 'To enable async processing, start Redis: docker run -d -p 6379:6379 redis:7-alpine',
      fileSize: 0,
      estimatedTime: 'Check browser console for processing status'
    };
  }

  try {
    const queueAddPromise = pdfQueue.add(
      {
        filePath,
        fileName,
        veteranId: effectiveVeteranId,
        submittedAt: new Date().toISOString()
      },
      {
        jobId: `${effectiveVeteranId}-${Date.now()}`,
        priority: 5
      }
    );

    // Avoid indefinite waits when Redis is unreachable.
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Queue submission timed out')), 2500);
    });

    const job = await Promise.race([queueAddPromise, timeoutPromise]);

    logger.info('PDF submitted to queue', {
      jobId: job.id,
      fileName,
      veteranId: effectiveVeteranId
    });

    return {
      jobId: job.id,
      status: 'queued',
      fileName,
      estimatedTime: '30-120 seconds for typical documents'
    };
  } catch (error) {
    logger.error('Failed to submit PDF for processing', error, {
      fileName,
      veteranId: effectiveVeteranId
    });

    // Return fallback even on error
    return {
      jobId: null,
      status: 'fallback_sync',
      fileName,
      message: 'Job queue error. Redis connection may be unavailable.',
      error: error.message
    };
  }
};

/**
 * Get job status and progress
 */
export const getJobStatus = async (jobId) => {
  const job = await pdfQueue.getJob(jobId);

  if (!job) {
    return {
      status: 'not_found',
      jobId
    };
  }

  const state = await job.getState();
  const progress = job._progress || 0;

  return {
    jobId,
    status: state,
    progress,
    result: state === 'completed' ? job.returnvalue : null,
    error: state === 'failed' ? job.failedReason : null,
    attemptsMade: job.attemptsMade,
    timestamp: new Date().toISOString()
  };
};

/**
 * Get multiple job statuses
 */
export const getJobStatuses = async (jobIds) => {
  return Promise.all(jobIds.map(id => getJobStatus(id)));
};

/**
 * Cancel a pending job
 */
export const cancelJob = async (jobId) => {
  const job = await pdfQueue.getJob(jobId);

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const state = await job.getState();

  if (state === 'completed' || state === 'failed') {
    throw new Error(`Cannot cancel job in ${state} state`);
  }

  await job.remove();
  logger.info('Job cancelled', { jobId });

  return { success: true, jobId };
};

/**
 * Get queue statistics
 */
export const getQueueStats = async () => {
  if (!isQueueReady || queueError) {
    return {
      queued: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      completed: 0,
      total: 0,
      status: 'unavailable',
      message: 'Redis connection required for job queue. To enable async PDF processing, start Redis.',
      error: queueError?.message || 'Queue not initialized'
    };
  }

  const counts = await pdfQueue.getJobCounts();
  const waiting = await pdfQueue.getWaitingCount();
  const active = await pdfQueue.getActiveCount();
  const delayed = await pdfQueue.getDelayedCount();
  const failed = await pdfQueue.getFailedCount();
  const completed = await pdfQueue.getCompletedCount();

  return {
    queued: waiting,
    active,
    delayed,
    failed,
    completed,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    status: 'available'
  };
};

/**
 * Drain queue (remove all jobs)
 * Use with caution - only in development
 */
export const drainQueue = async () => {
  if (config.isProduction) {
    throw new Error('Cannot drain queue in production');
  }

  await pdfQueue.drain();
  logger.warning('Queue drained - all jobs removed');
};
