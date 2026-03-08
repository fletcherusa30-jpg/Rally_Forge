# Batch 4 Staging Proposal

Date: 2026-03-08
Repository: `C:\Dev\Rally Forge`

## Objective
Stage remaining runtime additions (scanner support files, backend data, tests, configuration) while continuing to defer legacy deletion wave for final cleanup batch.

## Include Scope (Batch 4)

### Scanner Support Files
- `Scanner/VA SCANNER/input/` (test input files)
- `Scanner/VA SCANNER/knowledge/` (knowledge base for scanner)
- `Scanner/VA SCANNER/modules/` (scanner modules)
- `Scanner/VA SCANNER/output/` (scanner output examples)
- `Scanner/VA SCANNER/package.json` (scanner dependencies)
- `Scanner/VA SCANNER/rates/` (rating schedules)
- `Scanner/VA SCANNER/regex/` (regex patterns)
- `Scanner/VA SCANNER/tests/` (scanner test suite)
- `Scanner/VA SCANNER/_NODEMODULES_REBUILT.txt` (maintenance note)
- `Scanner/VA SCANNER/_REPAIR_NODEMODULES_REQUIRED.txt` (maintenance note)

### Backend Additions
- `backend/.env.example` (environment template)
- `backend/config.js` (backend configuration)
- `backend/package.json` (backend dependencies)
- `backend/package-lock.json` (backend dependency lock)
- `backend/data/` (local data, scan history, STRS data)
- `backend/knowledge/` (backend knowledge base)
- `backend/queue/` (job queue implementation)
- `backend/shared/` (shared backend utilities)
- `backend/va_scanner/` (VA scanner backend integration)
- `backend/validation/` (validation utilities)

### Root-Level Runtime Additions
- `ai/` (AI integration modules)
- `compensation-engine/` (compensation calculation engine)
- `config/` (application configuration)
- `data/` (application data)
- `docs/` (documentation)
- `engine/` (core engines)
- `knowledge/` (knowledge base)
- `models/` (data models)
- `public/` (public assets)
- `rag/` (RAG - Retrieval Augmented Generation)
- `rules/` (business rules)
- `scripts/` (utility scripts)
- `services/` (application services)
- `eslint.config.js` (ESLint configuration)
- `vite.config.js` (Vite configuration)
- `dev-server.js` (development server)
- `serve-frontend.js` (frontend server)
- `run.ps1` (PowerShell run script)
- `financial-planner.html` (financial planner UI)

### Tests
- `tests/_adhoc/` (ad-hoc test files)
- `tests/regression-compensation.test.js`
- `tests/test-*.js` (various test files)
- `tests/test-*.txt` (test data files)
- `tests/verify-*.js` (verification scripts)
- `test-auth.json`
- `test-strs-accuracy.js`

### Documentation
- `THIRD-PARTY-NOTICES.md`
- `VA_DECISION_DATE_ENHANCEMENT.md`
- `audit/ALL_4_STREAMS_ANALYSIS.md`
- `audit/BROKEN_FILES_ACTION_GUIDE.md`
- `audit/COMPLETE_ANALYSIS_SUMMARY.md`
- `audit/LEGACY_CONSOLIDATION_PLAN.md`
- `audit/MANIFEST_SUMMARY.md`
- `audit/PHASE_6_COMPLETION_REPORT.md`
- `audit/bom-scan-rotation1.txt`
- `audit/broken-files-*.json`
- `audit/dependency-graph-*.json`
- `audit/knowledge-base-gaps-*.json`
- `audit/raw-file-inventory.csv`
- `audit/repository-manifest-*.json`
- `audit/scanner_audit.md`
- `audit/unused-files-*.json`

### Certification/Unclassified
- `_certification/` (certification documents)
- `_unclassified/` (unclassified materials)

### Source Code Additions
- `src/README.md`
- `src/dev-server.js`
- `src/styles/theme-colors.js`
- `src/utils/aiDateParser.js`
- `src/utils/dateFormatter.js`
- `src/vite.config.js`

## Explicit Exclude Scope (Defer to Batch 5)

### Legacy Deletion Wave
- All deletions (146 files) including:
  - `FINANCIAL ENGINE/**` deletions
  - `frontend/**` deletions
  - `src/**` deletions (except new additions listed above)
  - `.vscode/**` deletions
  - Root-level file deletions

### Personal/Temporary Files
- `Fletcher 0772 20 MEB AHLTA.pdf`
- `Scanner/STRS_SCANNER_BACKUP_20260306_230242.zip`

## Proposed Commands
```powershell
Set-Location "C:\Dev\Rally Forge"

# Stage scanner support files
git add -- "Scanner/VA SCANNER/input" "Scanner/VA SCANNER/knowledge" "Scanner/VA SCANNER/modules" "Scanner/VA SCANNER/output" "Scanner/VA SCANNER/package.json" "Scanner/VA SCANNER/rates" "Scanner/VA SCANNER/regex" "Scanner/VA SCANNER/tests" "Scanner/VA SCANNER/_NODEMODULES_REBUILT.txt" "Scanner/VA SCANNER/_REPAIR_NODEMODULES_REQUIRED.txt"

# Stage backend additions
git add -- "backend/.env.example" "backend/config.js" "backend/package.json" "backend/package-lock.json" "backend/data" "backend/knowledge" "backend/queue" "backend/shared" "backend/va_scanner" "backend/validation"

# Stage root-level runtime additions
git add -- "ai" "compensation-engine" "config" "data" "docs" "engine" "knowledge" "models" "public" "rag" "rules" "scripts" "services" "eslint.config.js" "vite.config.js" "dev-server.js" "serve-frontend.js" "run.ps1" "financial-planner.html"

# Stage tests
git add -- "tests" "test-auth.json" "test-strs-accuracy.js"

# Stage documentation
git add -- "THIRD-PARTY-NOTICES.md" "VA_DECISION_DATE_ENHANCEMENT.md" "audit/ALL_4_STREAMS_ANALYSIS.md" "audit/BROKEN_FILES_ACTION_GUIDE.md" "audit/COMPLETE_ANALYSIS_SUMMARY.md" "audit/LEGACY_CONSOLIDATION_PLAN.md" "audit/MANIFEST_SUMMARY.md" "audit/PHASE_6_COMPLETION_REPORT.md" "audit/bom-scan-rotation1.txt" "audit/broken-files-1772774354.json" "audit/dependency-graph-1772774767.json" "audit/knowledge-base-gaps-1772774774.json" "audit/raw-file-inventory.csv" "audit/repository-manifest-1772774316.json" "audit/repository-manifest-annotated-1772774354.json" "audit/scanner_audit.md" "audit/unused-files-1772774354.json"

# Stage certification/unclassified
git add -- "_certification" "_unclassified"

# Stage source additions
git add -- "src/README.md" "src/dev-server.js" "src/styles/theme-colors.js" "src/utils/aiDateParser.js" "src/utils/dateFormatter.js" "src/vite.config.js"

# Unstage personal/temp files if accidentally included
git restore --staged -- "Fletcher 0772 20 MEB AHLTA.pdf" "Scanner/STRS_SCANNER_BACKUP_20260306_230242.zip" 2>&1

# Inspect staged changes
git status --short
git diff --cached --name-status | Measure-Object -Line
git diff --cached --name-status | Where-Object { $_ -match '^D' } | Measure-Object -Line
```

## Validation Gates Before Commit
```powershell
# Regression tests should still pass
npm run test:scanner-regression

# Verify no deletions staged (should be 0)
git diff --cached --name-status | Where-Object { $_ -match '^D' } | Measure-Object -Line

# Verify only additions and modifications
git diff --cached --name-status | Where-Object { $_ -match '^[AM]' } | Measure-Object -Line
```

## Suggested Commit Message
`runtime: complete application runtime additions and test infrastructure

Batch 4: Final runtime additions before legacy cleanup

Scanner support:
- Scanner input/output examples, test data
- Scanner knowledge base and modules
- Rate schedules, regex patterns, test suites
- Scanner package.json and dependencies
- Maintenance notes

Backend:
- Backend configuration and environment template
- Backend package.json and dependencies
- Data stores (local users, scan history, STRS data)
- Knowledge base, queue system, shared utilities
- VA scanner backend integration, validation

Core runtime:
- AI integration modules
- Compensation calculation engine
- Application configuration, data, documentation
- Core engines, models, services
- RAG (Retrieval Augmented Generation) system
- Business rules engine
- Utility scripts
- Vite/ESLint configuration
- Development servers

Tests:
- Ad-hoc tests directory
- Compensation regression tests
- Dependent calculation/extraction tests
- Manual entry form tests
- Rate escalator tests
- STRS accuracy/extraction tests
- Authentication tests

Documentation:
- Third-party notices, VA decision date enhancements
- Audit reports (4-stream analysis, broken files, legacy consolidation)
- Manifest summaries, phase completion reports
- Dependency graphs, knowledge base gap analysis
- Scanner audit

Certification:
- Certification documents
- Unclassified materials

Source additions:
- src/README.md, dev-server.js
- Theme colors, date utilities
- Vite configuration

All scanner v4.2.0 regression tests passing (4/4)
No deletions in this batch - deferred to batch-5`
