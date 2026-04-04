# Rally Forge Application API Architecture

Status: Authoritative target architecture (scan-first, AI-ready, deterministic)
Last Updated: 2026-04-03

## Objective
Define the complete API surface for Rally Forge to support:
- Veteran claims workflows
- AI-driven scanning and validation
- PDF/TXT artifact ingestion
- Cross-page communication
- Deterministic readiness scoring

All APIs in this document are designed to support both human workflows and automated AI review.

## Global API Principles

1. Scan-first design
- APIs emit machine-readable summaries.
- UI acts as a visualization and action layer, not as source of truth.

2. Single source of truth
- No UI-only state.
- Persisted outputs are auditable and replayable.

3. Stable identifiers
- Immutable IDs for all entities.
- IDs remain consistent across pages and document artifacts.

4. Deterministic output
- No ambiguous statuses.
- All statuses resolve to known enums.

## Core API Domains

### 1) Veteran Profile APIs
Purpose: identity anchoring and workflow gating.

- GET /api/veteran/{veteranId}
- PUT /api/veteran/{veteranId}
- GET /api/veteran/{veteranId}/readiness

Outputs:
- VeteranProfile
- ProfileReadinessSummary

### 2) Military Service APIs
Purpose: eligibility, service timelines, deployments, awards.

- GET /api/service/{veteranId}
- POST /api/service
- PUT /api/service/{serviceId}
- GET /api/service/{veteranId}/summary
- GET /api/service/{veteranId}/scanner-issues

Outputs:
- MilitaryServiceSummary
- ScannerIssue[]

### 3) Service Treatment Record APIs
Purpose: medical evidence coverage validation.

- GET /api/str/{veteranId}
- POST /api/str/upload
- GET /api/str/{veteranId}/coverage
- GET /api/str/{veteranId}/scanner-issues

Outputs:
- STRCoverageSummary
- CoverageGap[]

### 4) Current Treatment APIs
Purpose: diagnosis confirmation and nexus scoring.

- GET /api/treatment/{veteranId}
- POST /api/treatment
- PUT /api/treatment/{treatmentId}
- GET /api/treatment/{veteranId}/summary

Outputs:
- CurrentTreatmentSummary
- NexusIndicator[]

### 5) VA Rating Decision APIs
Purpose: decision history, grant/deny analysis.

- GET /api/rating/{veteranId}
- POST /api/rating
- GET /api/rating/{decisionId}
- GET /api/rating/{veteranId}/summary
- GET /api/rating/{decisionId}/denial/{conditionId}

Outputs:
- RatingDecisionSummary
- DenialRationale

### 6) Document and Artifact APIs
Purpose: source-of-truth document handling.

- POST /api/document/upload
- GET /api/document/{documentId}
- GET /api/document/{documentId}/parsed
- GET /api/document/{documentId}/references

Outputs:
- ParsedText
- EntityReference[]

### 7) Scanner and AI Analysis APIs
Purpose: cross-page validation and confidence scoring.

- POST /api/scanner/run
- GET /api/scanner/{veteranId}/issues
- GET /api/scanner/{veteranId}/confidence
- GET /api/scanner/{veteranId}/export

Outputs:
- ScannerIssue[]
- ConfidenceScore
- ScanArtifact (PDF/TXT)

### 8) Unified Readiness APIs
Purpose: workflow orchestration and gating.

- GET /api/readiness/{veteranId}
- GET /api/readiness/{veteranId}/blocking
- GET /api/readiness/{veteranId}/timeline

Outputs:
- DevelopmentReadiness
- BlockingIssue[]

### 9) Audit and Integrity APIs
Purpose: traceability and compliance.

- GET /api/audit/{entityId}
- POST /api/audit/log
- GET /api/integrity/{entityId}

Outputs:
- AuditEntry[]
- IntegrityHash

## Cross-API Data Contracts

All APIs reference:
- veteranId
- Stable entity IDs
- Shared enums
- Deterministic timestamps

No API emits UI-only semantics.

## AI Bot Consumption Guarantee

Combined API outputs enable an AI bot to:
- Scan a single PDF/TXT artifact
- Validate service eligibility
- Confirm medical evidence coverage
- Analyze rating decisions
- Explain denied conditions
- Produce a defensible readiness score

## Implementation Mapping (Current Mounted API Base Paths)

This section maps the target domain model above to currently mounted route bases in backend route manifest. It is an implementation snapshot and does not redefine the authoritative target contracts.

- Veteran Profile domain: not yet mounted under /api/veteran.
- Military Service domain: currently mounted under /api/military and /api/dd214.
- STR domain: currently mounted under /api/str and /api/strs.
- Current Treatment domain: currently mounted primarily under /api/scanner and tab-level workspace routes.
- VA Rating Decision domain: currently mounted under /api/rating and /api/scanner.
- Document and Artifact domain: currently mounted under /api/document-vault.
- Scanner and AI domain: currently mounted under /api/scanner and /api/scanner-diagnostics.
- Unified Readiness domain: currently mounted under /api/readiness-score and /api/timeline.
- Audit and Integrity domain: currently mounted under /api/audit; integrity endpoint surface under /api/integrity is not yet mounted.

## Adoption Notes

- Treat domain paths in this document as canonical target contracts.
- During migration, preserve backward compatibility aliases for existing route bases.
- Prefer additive rollout with explicit deprecation windows and audit logging.
