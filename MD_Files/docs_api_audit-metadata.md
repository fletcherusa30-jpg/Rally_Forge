# Audit Metadata Endpoint

## Overview

The Rally Forge backend exposes a deterministic, read-only audit metadata endpoint for operations, dashboards, and CI/CD checks.

- Method: GET
- Path: /api/audit/metadata
- Behavior: read-only, no writes, no regeneration, no side effects

## Response Shape

The endpoint returns:

- endpointVersion
- schemaVersion
- snapshot
- audit
- drift
- modernization
- freshness
- health
- provenance
- confidence

Example top-level shape:

```json
{
  "success": true,
  "data": {
    "endpointVersion": "1.0.0",
    "schemaVersion": "1.0.0",
    "snapshot": {},
    "audit": {},
    "drift": {},
    "modernization": {},
    "freshness": {},
    "health": {},
    "provenance": {},
    "confidence": {}
  }
}
```

## Data Sources

The service reads from existing workspace artifacts when available:

- resources/state-benefits.json
- resources/state-benefits.audit.json
- resources/state-benefits.snapshot.json
- resources/scanner.audit.json
- resources/analyzer.audit.json
- resources/case-summary.audit.json
- watchdog_now.json
- watchdog_last.json

If a source is missing, the endpoint reports it in provenance and health warnings without failing unless canonical core data cannot be produced.

## Versioning

- `endpointVersion` tracks the transport and response contract for `/api/audit/metadata`
- `schemaVersion` tracks the canonical audit payload schema
- Consumers should monitor both and treat either change as a contract review event

## Freshness Policy

The endpoint exposes a `freshness` block containing:

- `policyVersion`
- `staleSources`
- `sources[]` with source name, path, found flag, last modified timestamp, age in minutes, and max allowed age in minutes

Current default freshness windows:

- benefits artifacts: 24 hours
- watchdog snapshot: 6 hours
- auxiliary audit artifacts: 24 hours

If freshness thresholds are exceeded, the endpoint degrades to `health.status = warn` and reports stale source warnings.

## Determinism and Safety

- No mutation and no persistence operations
- No trigger of watchdog, generation, repair, or normalization jobs
- Schema-validated response before return
- Stable path and response keys for monitoring consumers

## Error Behavior

- 400 when query parameters are provided (strict request shape)
- 500 when internal schema validation fails

## Recommended Consumers

- Ops dashboards
- CI smoke checks
- Nightly watchdog pipelines
- Deployment health gates

## CI Gate Commands

- `npm run audit:metadata`
  - Passes on `health.status = pass|warn`
- `npm run audit:metadata:strict`
  - Fails on `health.status = warn|fail`
