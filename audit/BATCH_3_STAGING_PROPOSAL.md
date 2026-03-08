# Batch 3 Staging Proposal

Date: 2026-03-08
Repository: `C:\Dev\Rally Forge`

## Objective
Stage infrastructure improvements, scanner additions, and documentation while continuing to defer legacy deletion waves.

## Include Scope (Batch 3)

### Infrastructure & Database
- `backend/database/**` (CP schema routes, models, migrations)
- `backend/utils/**` (error handling updates)
- `packages/lighthouse/**` (Lighthouse VA API integration)
- `packages/shared-data/**` (constants, schemas, onboarding data)
- `tooling/scripts/**` (repository structure enforcement)
- `package-lock.json` (dependency lock updates)

### Scanner Additions
- `Scanner/VA SCANNER/engine/*.js` (new: ancillary-benefits-detector, cfr-rating-parser, cfrValidation, confidenceScorer, rateEscalator, rateLoader, smc-detector)
- `Scanner/VA SCANNER/engine/pdf/**` (PDF extraction utilities)
- `Scanner/VA SCANNER/frontend/*.jsx` (ScannerPanel, useScanner hook)
- `Scanner/VA SCANNER/frontend/*.css` (ScannerPanel styles)
- `Scanner/VA SCANNER/frontend/utils/*.js` (all extraction utilities: benefitScan, extractAncillary, extractClaimantInfo, extractCombatStatus, extractDenied, extractDependents, extractEvidence, extractPayments, extractSMC, extractServiceConnected, pactActDetection, pdfExtractor)
- `Scanner/VA SCANNER/ai/**` (AI integration for scanner)
- `Scanner/VA SCANNER/backend/**` (scanner backend integration)
- `Scanner/VA SCANNER/data/**` (scanner reference data)
- `Scanner/VA SCANNER/*.ps1` (PowerShell scanner scripts: Analyzer.Engine.ps1, RegexLibrary.ps1, VA.Scanner.Text.ps1, VA.Scanner.ps1)
- `Scanner/STRS_SCANNER/**` (Service Treatment Records scanner)

### Documentation & Audit Reports
- `audit/NEXT_BATCH_STAGING_PROPOSAL.md` (batch-2 documentation - now complete)
- `AUDIT_REPORT.md`
- `COMPREHENSIVE_ADVANCEMENT_AUDIT.md`
- `EXECUTIVE_ADVANCEMENT_BRIEF.md`
- `IMPLEMENTATION_PHASE0_COMPLETE.md`
- `PHASE_0_EXECUTION_COMPLETE.md`
- `PRIORITY_ENHANCEMENT_QUICKSTART.md`
- `SYSTEM_AUDIT_REPORT.md`
- `SYSTEM_FIXES_APPLIED.md`
- `SYSTEM_IMPLEMENTATION_COMPLETE.md`
- `CODE_OF_CONDUCT.md`
- `CONTRIBUTING.md`
- `LICENSE.md`
- `SECURITY.md`
- `README.md` (if it's an update, not a deletion)

### Configuration
- `RallyForge.code-workspace`

## Explicit Exclude Scope

### Legacy Deletion Waves (defer to batch-4)
- `frontend/**` deletions
- `src/**` deletions
- `FINANCIAL ENGINE/**` deletions
- `.vscode/**` deletions
- Root-level file deletions (2026-02-12-work-log.md, old PDFs)

### Personal/Temporary Files
- `Fletcher 0772 20 MEB AHLTA.pdf` (personal medical document)
- `ClaimLetter-2017-12-15.pdf`
- `38 CFR Part 3 (up to date as of 2-12-2026).pdf` (if being deleted)
- `38 CFR Part 4 (up to date as of 2-12-2026).pdf` (if being deleted)

## Proposed Commands
```powershell
Set-Location "C:\Dev\Rally Forge"

# Stage infrastructure modifications
git add -- "backend/database" "backend/utils" "packages" "tooling" "package-lock.json"

# Stage scanner additions
git add -- "Scanner/VA SCANNER/engine" "Scanner/VA SCANNER/frontend" "Scanner/VA SCANNER/ai" "Scanner/VA SCANNER/backend" "Scanner/VA SCANNER/data" "Scanner/VA SCANNER/*.ps1" "Scanner/STRS_SCANNER"

# Stage documentation
git add -- "audit/NEXT_BATCH_STAGING_PROPOSAL.md" "AUDIT_REPORT.md" "COMPREHENSIVE_ADVANCEMENT_AUDIT.md" "EXECUTIVE_ADVANCEMENT_BRIEF.md" "IMPLEMENTATION_PHASE0_COMPLETE.md" "PHASE_0_EXECUTION_COMPLETE.md" "PRIORITY_ENHANCEMENT_QUICKSTART.md" "SYSTEM_AUDIT_REPORT.md" "SYSTEM_FIXES_APPLIED.md" "SYSTEM_IMPLEMENTATION_COMPLETE.md" "CODE_OF_CONDUCT.md" "CONTRIBUTING.md" "LICENSE.md" "SECURITY.md" "README.md"

# Stage workspace config
git add -- "RallyForge.code-workspace"

# Unstage any accidentally included exclusions
git restore --staged -- "Fletcher 0772 20 MEB AHLTA.pdf" "ClaimLetter-2017-12-15.pdf" "frontend" "src" "FINANCIAL ENGINE"

# Inspect staged changes
git status --short
git diff --cached --name-status | Measure-Object -Line
```

## Validation Gates Before Commit
```powershell
# Regression tests should still pass
npm run test:scanner-regression

# Verify no accidental deletions staged
git diff --cached --name-status | Where-Object { $_ -match '^D' } | Measure-Object -Line
# ^ Should be 0 or very low (only intentional scanner cleanup)
```

## Suggested Commit Message
`infrastructure: scanner engine expansion, database schema, packages, and documentation

Batch 3: Infrastructure improvements and scanner runtime expansion

Scanner engine additions:
- CFR rating parser, validator, confidence scorer
- Ancillary benefits detector, SMC detector
- Rate escalator, rate loader
- PDF extraction engine
- Frontend components: ScannerPanel, useScanner hook
- Extract utilities: ancillary, claimant, combat, denied, dependents, evidence, payments, SMC, service connected, PACT Act detection
- PowerShell scanner scripts (Analyzer.Engine, RegexLibrary, VA.Scanner)
- AI integration and backend wiring
- STRS (Service Treatment Records) scanner

Infrastructure:
- Database CP schema routes (appeals, audit, claims, documents, exams, payments, pension, ratings, veterans)
- Database migrations and seeds
- Database models (benefitsCache, onboarding, veteran)
- Backend utilities (error handling)
- Packages: lighthouse (VA API client), shared-data (constants, schemas)
- Tooling: repo structure enforcement

Documentation:
- Audit reports, implementation phase summaries
- CODE_OF_CONDUCT, CONTRIBUTING, LICENSE, SECURITY
- Updated README
- Batch-2 staging proposal (archived)

Configuration:
- RallyForge.code-workspace

All scanner v4.2.0 regression tests passing`
