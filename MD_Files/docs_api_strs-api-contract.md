# STR API Contract

Base path: /api/strs

## Purpose

The STR API accepts PDF or TXT service treatment records and supports either async queue processing (Redis available) or synchronous fallback processing (Redis unavailable).

## Endpoints

### GET /health

Returns health and engine metadata.

Example response:

```json
{
  "success": true,
  "status": "ok",
  "engine": "JavaScript STRS deterministic engine with async queue",
  "version": "2.0.0",
  "time": "2026-03-11T20:00:00.000Z"
}
```

### POST /upload

Accepts multipart form-data with field name strs.

Accepted file types:
- application/pdf
- text/plain
- extension fallback: .pdf, .txt

Size limit:
- 50 MB

Response status:
- 202 Accepted

Async queue response shape:

```json
{
  "success": true,
  "jobId": "veteran-123-1741720000",
  "status": "queued",
  "fileName": "records.txt",
  "estimatedTime": "30-120 seconds for typical documents"
}
```

Fallback response shape when queue is unavailable:

```json
{
  "success": true,
  "jobId": null,
  "status": "fallback_sync",
  "fileName": "records.txt",
  "message": "Job queue unavailable. Redis connection required.",
  "note": "To enable async processing, start Redis: docker run -d -p 6379:6379 redis:7-alpine"
}
```

Validation errors:

```json
{
  "success": false,
  "error": "No STRS file provided",
  "code": "NO_FILE"
}
```

### POST /upload-sync

Processes upload immediately in request cycle.

Accepts multipart form-data with field name strs.

Success response includes deterministic engine payload and metadata:

```json
{
  "success": true,
  "Extracted": {
    "Diagnoses": [],
    "Injuries": [],
    "Events": []
  },
  "Analysis": {
    "ServiceConnectionOpportunities": []
  },
  "NLP": {},
  "AIAnalysis": [],
  "metadata": {
    "fileName": "records.txt",
    "fileSize": 1024,
    "processingMode": "sync",
    "processedAt": "2026-03-11T20:00:00.000Z"
  }
}
```

### GET /status/:jobId

Returns queue job status and result for async jobs.

Success response:

```json
{
  "success": true,
  "jobId": "veteran-123-1741720000",
  "status": "queued",
  "progress": 30,
  "result": null,
  "error": null,
  "attemptsMade": 0,
  "timestamp": "2026-03-11T20:00:00.000Z"
}
```

Completed result metadata contract:
- metadata.processingMode = async
- metadata.sourceType = pdf | txt
- metadata.mimeType = application/pdf | text/plain

Not found response:

```json
{
  "success": false,
  "error": "Job not found: <jobId>",
  "code": "JOB_NOT_FOUND",
  "status": "not_found",
  "jobId": "<jobId>"
}
```

Queue unavailable response:

```json
{
  "success": false,
  "error": "Job queue service unavailable. Redis connection required.",
  "code": "QUEUE_UNAVAILABLE"
}
```

### POST /status/batch

Body:

```json
{
  "jobIds": ["id-1", "id-2"]
}
```

Response:

```json
{
  "success": true,
  "jobs": [
    {
      "jobId": "id-1",
      "status": "queued",
      "progress": 40
    }
  ]
}
```

### GET /queue/stats

Response:

```json
{
  "success": true,
  "queue": {
    "status": "available",
    "queued": 0,
    "active": 0,
    "delayed": 0,
    "failed": 0,
    "completed": 0,
    "total": 0
  },
  "timestamp": "2026-03-11T20:00:00.000Z"
}
```

When queue is unavailable, queue.status is unavailable and the payload includes guidance.

## Notes for Consumers

- Client should poll /status/:jobId only when /upload returns status queued and a non-null jobId.
- Client should run /upload-sync only when /upload returns fallback_sync.
- Client should treat both 404 JOB_NOT_FOUND and 503 QUEUE_UNAVAILABLE as terminal for status polling.
