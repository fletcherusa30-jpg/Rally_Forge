# Python Service Placeholder

## Purpose
Provide optional Python-based AI or data-processing capabilities as an external microservice.

## Node Communication
Preferred: HTTP (REST). Optional for high-throughput: gRPC.

## Expected Request/Response Format
- Request (HTTP JSON):
  - `taskType` (string)
  - `payload` (object)
  - `metadata` (object, optional)
- Response (HTTP JSON):
  - `success` (boolean)
  - `result` (object|string)
  - `error` (string, optional)
