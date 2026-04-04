import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import {
  extractTextFromPdf,
  scanSTRText,
  validateScanResult,
} from '../engine/strs/index.js';
import { analyzeMultipleConditions } from '../services/strsAiAnalyzerService.js';
import {
  enqueuePdfJob,
  getJob,
} from '../va_scanner/queue/pdfQueue.js';
import { createLogger } from '../middleware/logging.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = createLogger('strs-api');
const DETERMINISTIC_SCAN_TIMESTAMP = '2000-01-01T00:00:00.000Z';

function mapQueueJobToStrsStatus(job) {
  if (!job || typeof job !== 'object') {
    return null;
  }

  const status = String(job.status || '').toLowerCase();
  const progress = status === 'completed' ? 100 : status === 'processing' ? 50 : 0;

  return {
    jobId: job.jobId,
    status,
    source: job.source,
    createdAt: job.createdAt,
    progress,
    result: status === 'completed'
      ? (job?.resultMeta?.result || job?.resultMeta || null)
      : null,
    errorMessage: status === 'failed'
      ? (job?.resultMeta?.errorMessage || 'Unknown error')
      : null,
  };
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function uploadStrs(req, res) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No STRS file provided',
      code: 'NO_FILE',
    });
  }

  const fileName = req.file.originalname || 'strs';
  const extension = path.extname(fileName).toLowerCase();
  const isPdf = req.file.mimetype === 'application/pdf' || extension === '.pdf';
  const isText = req.file.mimetype === 'text/plain' || extension === '.txt';

  if (!isPdf && !isText) {
    return res.status(400).json({
      success: false,
      error: 'Unsupported file type. Upload PDF or TXT.',
      code: 'INVALID_FILE_TYPE',
    });
  }

  try {
    const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');
    await ensureDir(uploadsDir);

    const filePath = path.join(uploadsDir, `${Date.now()}-${fileName}`);
    await fs.writeFile(filePath, req.file.buffer);

    logger.info('File saved for processing', {
      veteranId: req.veteranId,
      fileName,
      fileSize: req.file.size,
      filePath,
    });

    const jobId = await enqueuePdfJob({
      source: 'scan-str',
      scannerVersion: '3.0.0',
      fileMeta: { fileName, fileSize: req.file.size },
      payload: { tempFilePath: filePath, veteranId: req.veteranId, isPdf, isText },
    });

    return res.status(202).json({
      success: true,
      jobId,
      status: 'queued',
      message: 'STRS file queued for processing. Poll /api/strs/status/:jobId for status.',
    });
  } catch (error) {
    logger.error('Failed to queue PDF', error, {
      veteranId: req.veteranId,
      fileName,
    });

    return res.status(500).json({
      success: false,
      error: `Failed to process STRS file: ${error.message}`,
      code: 'PROCESSING_ERROR',
    });
  }
}

export async function uploadStrsSync(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No STRS file provided' });
  }

  const fileName = req.file.originalname || 'strs';
  const extension = path.extname(fileName).toLowerCase();
  const isPdf = req.file.mimetype === 'application/pdf' || extension === '.pdf';
  const isText = req.file.mimetype === 'text/plain' || extension === '.txt';

  if (!isPdf && !isText) {
    return res.status(400).json({ success: false, error: 'Unsupported file type. Upload PDF or TXT.' });
  }

  let extractedText = '';

  try {
    logger.info('Processing STRS synchronously', {
      fileName,
      fileSize: req.file.size,
      isPdf,
    });

    if (isPdf) {
      extractedText = await extractTextFromPdf(req.file.buffer);
    } else {
      extractedText = req.file.buffer.toString('utf-8');
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(422).json({
        success: false,
        error: 'File is empty or text could not be extracted',
      });
    }

    logger.debug('Text extracted', { textLength: extractedText.length, fileName });

    const scanResult = scanSTRText(extractedText);
    const validation = validateScanResult(scanResult);

    if (!validation.isValid) {
      logger.error('Schema validation failed', new Error('Validation error'), {
        errors: validation.errors,
      });
      return res.status(500).json({
        success: false,
        error: 'Internal: invalid scan output schema',
        details: validation.errors,
      });
    }

    let aiAnalyses = [];
    if (process.env.ANTHROPIC_API_KEY) {
      const conditionsToAnalyze = [
        ...scanResult.Extracted.Diagnoses,
        ...scanResult.Extracted.Injuries,
        ...scanResult.Extracted.Events,
      ];

      if (conditionsToAnalyze.length > 0) {
        logger.info('Running AI analysis', {
          diagnoses: scanResult.Extracted.Diagnoses.length,
          injuries: scanResult.Extracted.Injuries.length,
          events: scanResult.Extracted.Events.length,
          total: conditionsToAnalyze.length,
        });
        try {
          aiAnalyses = await analyzeMultipleConditions(
            conditionsToAnalyze,
            scanResult.__rawText || extractedText,
            { fileName, fileSize: req.file.size }
          );
          logger.info('AI analysis complete', { analyzed: aiAnalyses.length });
        } catch (aiError) {
          logger.warning('AI analysis failed, continuing', aiError, { fileName });
        }
      }
    }

    const response = {
      ...scanResult,
      Timestamp: DETERMINISTIC_SCAN_TIMESTAMP,
      AIAnalysis: aiAnalyses,
      metadata: {
        fileName,
        fileSize: req.file.size,
        extractedLength: extractedText.length,
        isPdf,
        processedAt: DETERMINISTIC_SCAN_TIMESTAMP,
        aiAnalysisEnabled: aiAnalyses.length > 0,
        processingMode: 'sync',
      },
    };

    delete response.__rawText;

    logger.info('STRS scan complete', {
      diagnoses: response.Extracted.Diagnoses?.length || 0,
      injuries: response.Extracted.Injuries?.length || 0,
      opportunities: response.Analysis.ServiceConnectionOpportunities?.length || 0,
    });

    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0',
    });

    return res.json(response);
  } catch (error) {
    logger.error('Processing error', error, { fileName });

    return res.status(500).json({
      success: false,
      error: `Failed to process STRS file: ${error.message}`,
      parse_warnings: [error.message],
      Extracted: {
        Diagnoses: [],
        Injuries: [],
        Events: [],
        Medications: [],
        Procedures: [],
        Chronicity: {},
        Continuity: {},
      },
      Analysis: {
        DiagnosesFound: 0,
        InjuriesFound: 0,
        EventsFound: 0,
        ChronicConditions: 0,
        MedicationsFound: 0,
        ProceduresFound: 0,
        ServiceConnectionOpportunities: [],
        Flags: ['Processing error'],
      },
      NLP: {},
      Timestamp: DETERMINISTIC_SCAN_TIMESTAMP,
    });
  }
}

export async function getStrsJobStatus(req, res) {
  const { jobId } = req.params;

  try {
    const job = await getJob(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: `Job not found: ${jobId}`,
        code: 'JOB_NOT_FOUND',
      });
    }
    if (job?.status === 'not_found') {
      return res.status(404).json({
        success: false,
        error: `Job not found: ${jobId}`,
        code: 'JOB_NOT_FOUND',
        ...job,
      });
    }

    const statusResponse = mapQueueJobToStrsStatus(job);
    return res.json({ success: true, ...statusResponse });
  } catch (error) {
    logger.error('Failed to get job status', error);
    return res.status(503).json({
      success: false,
      error: 'Job queue service unavailable. Redis connection required.',
      code: 'QUEUE_UNAVAILABLE',
    });
  }
}

export async function getStrsBatchJobStatus(req, res) {
  const { jobIds } = req.body;

  if (!Array.isArray(jobIds)) {
    return res.status(400).json({ success: false, error: 'jobIds must be an array' });
  }

  try {
    const statuses = await Promise.all(jobIds.map((id) => getJob(id)));
    const jobs = statuses
      .filter(Boolean)
      .map((job) => mapQueueJobToStrsStatus(job))
      .filter(Boolean);
    return res.json({ success: true, jobs });
  } catch (error) {
    logger.error('Failed to get batch job statuses', error);
    return res.status(503).json({
      success: false,
      error: 'Job queue service unavailable. Redis connection required.',
      code: 'QUEUE_UNAVAILABLE',
    });
  }
}

export async function getStrsQueueStats(_req, res) {
  return res.json({
    success: true,
    queue: { engine: 'canonical-v2', backend: 'redis-or-memory' },
    timestamp: new Date().toISOString(),
  });
}

export async function getStrsHealth(_req, res) {
  res.json({
    success: true,
    status: 'ok',
    engine: 'JavaScript STRS deterministic engine with async queue',
    version: '2.0.0',
    time: new Date().toISOString(),
  });
}
