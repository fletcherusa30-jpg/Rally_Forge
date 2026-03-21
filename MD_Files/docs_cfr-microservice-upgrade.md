# CFR Local Index and Microservice Upgrade

## Scope
This upgrade extends the existing CFR implementation without replacing core scanner architecture. It introduces a deterministic local CFR index pipeline and internal API surface powered only by locally stored CFR PDF files and local JSON artifacts.

## Inspection Summary (Pre-Upgrade)
- Existing CFR parser scripts existed in tooling/scripts, but had brittle paths and were not wired as runtime services.
- Existing CFR data under knowledge/CFR_REGULATIONS was chapter-level summary metadata and markdown, not section-level index records.
- Existing runtime loaders in backend/services/knowledgeBaseService.js supported part3/part4 fallback loading but not a dedicated local CFR section index.
- DBQ workbook loading existed in backend/services/dbqIndexService.js, but rows were not linked to local CFR section IDs.
- Rating/extraction stack had CFR references in rule modules and scanner heuristics, but no single local CFR index service endpoint.

## Upgrade Plan Used
- filesToTouch[]
  - backend/services/knowledgeBaseService.js
  - backend/services/dbqIndexService.js
  - backend/api/routeManifest.js
  - backend/va_scanner/backend/shared/scanner/diagnosticCodeValidator.js
  - backend/va_scanner/backend/shared/scanner/cfrCriteriaLookup.js
  - backend/va_scanner/backend/shared/scanner/crossScannerFusionEngine.js
  - backend/va_scanner/knowledge/cfr-part3-rules.js
  - backend/va_scanner/knowledge/cfr-part4-rules.js
  - package.json
- newComponentsToAdd[]
  - backend/services/cfrPdfParserService.js
  - backend/services/cfrIndexService.js
  - backend/api/cfr.js
  - tooling/scripts/build-cfr-index.js
  - tests/scanner/cfr-microservice.test.js
  - knowledge/cfr/cfr-index.json (generated)
  - knowledge/cfr/cfr-dbq-links.json (generated)

## Implemented Components

### 1) Local CFR PDF parser and structured index builder
- New service: backend/services/cfrPdfParserService.js
- Parses local CFR PDFs (Title 38 full if present, otherwise Part 3 and Part 4 PDFs).
- Extracts hierarchy elements and stores section metadata:
  - titleNumber
  - partNumber
  - subpart
  - sectionNumber
  - sectionTitle
  - headings[]
  - paragraphStructure[]
  - diagnosticCodeRefs[] (Part 4)
  - rawTextLocation (pdfPageRange, offsets)
  - confidence
- Stores OCR/noise ambiguity with lowered confidence and keeps text as-is.

### 2) Deterministic local CFR index service
- New service: backend/services/cfrIndexService.js
- Provides local-only CFR retrieval and mapping utilities:
  - part lookup
  - section lookup
  - diagnostic code to section lookup
  - eCFR URL parsing
  - DBQ row linkage to local section IDs

### 3) DBQ integration to local CFR index
- Extended backend/services/dbqIndexService.js
- Every DBQ row now carries:
  - cfrLink.title
  - cfrLink.part
  - cfrLink.section
  - cfrLink.localSectionId
  - cfrLink.ecfrUrl
- Build pipeline writes local link artifact: knowledge/cfr/cfr-dbq-links.json

### 4) CFR microservice endpoints
- New API route: backend/api/cfr.js
- Registered in backend/api/routeManifest.js under /api/cfr
- Endpoints:
  - GET /api/cfr/status
  - GET /api/cfr/38/part/:partNumber
  - GET /api/cfr/38/part/:partNumber/section/:sectionNumber
  - GET /api/cfr/38/part/4/dx/:dxCode

### 5) Scanner/component refactors to unified local CFR source
- diagnosticCodeValidator now resolves via cfrIndexService (local section source of truth).
- cfrCriteriaLookup now reads structured Part 4 sections from cfrIndexService.
- crossScannerFusionEngine now resolves and includes CFR section metadata for diagnostic-coded rating evidence.
- cfr-part3-rules and cfr-part4-rules now enrich outputs with local section IDs when available from the local index.

### 6) Knowledge service extension
- backend/services/knowledgeBaseService.js now prioritizes knowledge/cfr/cfr-index.json structured sections for Part 3 and Part 4 before legacy fallbacks.
- Diagnostic code loading can derive from structured Part 4 section diagnosticCodeRefs.

### 7) Build script and command
- New script: tooling/scripts/build-cfr-index.js
- npm command: npm run cfr:build-index
- Produces local artifacts from local PDFs only.

## Validation
- Built local index from local PDFs:
  - sectionsIndexed: 783
  - DBQ links count: 684
- Regression tests passing:
  - tests/scanner/cfr-microservice.test.js
  - tests/scanner/deterministic-fusion.test.js

## Boundaries
- No external CFR API calls.
- No legal interpretation or entitlement/rating decisioning logic added.
- Changes are structural/indexing/linkage and deterministic metadata exposure only.
