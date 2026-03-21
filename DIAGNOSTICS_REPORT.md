# Rally Forge Unified Diagnostics Report
Generated: 2026-03-19

This is the single canonical report, split into two sections:
1. Runtime and Scanner Diagnostics
2. UI Style Specification

## Section 1: Runtime and Scanner Diagnostics

### Live Health Summary
- API health endpoint: healthy
- Scanner diagnostics endpoint: healthy
- Mounted routes: 24
- DD-214 automated suite: 49/49 passing

### Real DD-214 Scan Results

| File | Confidence | OCR Confidence | Entry Date | Separation Date | Deterministic Ready | Notes |
|---|---:|---:|---|---|---|---|
| PDF_Files/DD214- 09-17.pdf | 80.67% | 84.5 | 2009-04-28 | 2017-11-26 | true | Good extraction, still flagged for manual review |
| PDF_Files/DD214 98-03.pdf | 32.67% | 59.0 | null | null | false | Low source quality, critical blocks missing |

### Confirmed Root Causes
1. Upload MIME strictness in scanner route.
Reason: upload filter only accepts application/pdf and rejects otherwise.
Effect: some client uploads fail even when file content is a PDF.

2. Legacy source quality limitation on DD214 98-03.pdf.
Reason: low OCR confidence and missing date fields in source extraction.
Effect: non-deterministic output is expected for this file.

3. Manual review threshold is too aggressive.
Reason: manual review can still be flagged on deterministic-ready output.
Effect: mixed signal in output and UI.

### Components and Files Involved
- backend/api/scanner.js
- backend/api/scannerDiagnostics.js
- backend/va_scanner/backend/shared/scanner/dd214Scanner.js
- backend/va_scanner/backend/shared/scanner/dd214Analysis/index.js
- backend/va_scanner/backend/shared/scanner/pdfOcrHelper.js
- backend/va_scanner/backend/shared/scanner/dd214ImageEnhancement.js
- backend/va_scanner/backend/shared/scanner/dd214ManualReviewFallback.js

### Relevant Test Files
- tests/dd214/dd214-deterministic.test.js
- tests/dd214/dd214-extraction-extended.test.js
- tests/dd214/dd214-legacy-hardening.test.js
- tests/dd214/dd214-regression-hardening.test.js
- tests/dd214/dd214-semantic-anchors.test.js
- tests/dd214/dd214-stepone-mapper.test.js
- tests/dd214/dd214-variants.test.js

### Reproduction Commands
- npm run dev
- Invoke-RestMethod -Uri http://localhost:4000/api/health | ConvertTo-Json -Depth 8
- Invoke-RestMethod -Uri http://localhost:4000/api/scanner/diagnostics | ConvertTo-Json -Depth 8
- curl.exe -s -X POST -F "file=@PDF_Files/DD214- 09-17.pdf;type=application/pdf" http://localhost:4000/api/scanner/scan-dd214
- curl.exe -s -X POST -F "file=@PDF_Files/DD214 98-03.pdf;type=application/pdf" http://localhost:4000/api/scanner/scan-dd214
- npm run test:dd214

### Recommended Fix Sequence
1. Upload reliability.
Accept .pdf extension fallback when MIME is absent and return HTTP 415 for unsupported upload types.

2. OCR uplift for legacy scans.
Implement actual enhancement operations in dd214ImageEnhancement.js and add low-confidence retry profile.

3. Manual review signal tuning.
Suppress manual review recommendation when deterministic ready is true and confidence is above threshold.

## Section 2: UI Style Specification

### Source Element
Hazard and Deployment Pay card.

### Canonical Text Content
- HAZARD and DEPLOYMENT PAY
- Afghanistan
- IMMINENT DANGER PAY

### Canonical Visual Spec
Container:
- display: flex
- flex-direction: column
- gap: 0.35rem
- padding: 0.6rem
- background: rgb(58, 58, 26)
- border: 1px solid rgb(90, 90, 45)
- border-radius: 0.45rem

Title:
- font-size: 0.72rem
- color: rgb(252, 211, 77)
- font-weight: 700
- text-transform: uppercase
- letter-spacing: 0.04em

Value rows:
- font-size: 0.76rem
- color: rgb(254, 243, 199)
- font-weight: 500

### Cleanup Note
Large inherited CSS dumps from ancestor nodes were intentionally removed because they were duplicates and not part of the card's canonical style definition.

## Final Status
- Combined: complete
- Cleaned: complete
- Deduplicated: complete
- Split into two sections: complete
