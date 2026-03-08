# Next Batch Staging Proposal

Date: 2026-03-08
Repository: `C:\Dev\Rally Forge`

## Objective
Stage the next logical runtime batch (backend APIs + modern frontend runtime) while excluding high-risk legacy deletions and broad archive churn.

## Include Scope (Batch 2)
- `backend/api/**` (new/modified API routes)
- `backend/engine/**` (new/modified runtime engine modules)
- `backend/services/**` (new/modified services)
- `backend/middleware/**`
- `backend/index.js`
- `backend/app.js`
- `backend/server.js`
- `backend/tests/**` (runtime regression/integration tests for new backend pieces)
- `app/frontend-modern/**` (modern frontend runtime)

## Explicit Exclude Scope
- Legacy frontend deletion wave:
  - `frontend/**`
  - `src/**` legacy deletions (except intentionally new replacement paths already managed)
- Legacy financial module deletion wave:
  - `FINANCIAL ENGINE/**`
- Archive/legacy/doc dump churn not required for runtime batch:
  - `_legacy/**`, `archives/**`, large `docs/**` additions

## Safety Notes
- Do not stage broad `git add .` due mixed deletion/addition state.
- Keep deleted scanner service files (`backend/services/scannerService.js`, etc.) out of this batch unless replacement wiring is confirmed end-to-end.
- Keep deleted legacy scanner middleware files (`backend/engine/scanner/*`) out until migration map is validated.

## Proposed Commands
```powershell
Set-Location "C:\Dev\Rally Forge"

# Stage includes only
git add -- "backend/api" "backend/engine" "backend/services" "backend/middleware" "backend/index.js" "backend/app.js" "backend/server.js" "backend/tests" "app/frontend-modern"

# Unstage known risky deletions if they got included accidentally
git restore --staged -- "backend/engine/scanner/scannerMiddleware.js" "backend/engine/scanner/vaDecisionScanner.js" "backend/services/newScannerService.js" "backend/services/scannerDocumentClassifier.js" "backend/services/scannerService.js" "frontend" "src" "FINANCIAL ENGINE"

# Inspect exactly what is staged before commit
git status --short
git diff --cached --name-status
```

## Validation Gates Before Commit
```powershell
Set-Location "C:\Dev\Rally Forge"
npm run test:scanner-regression
npm run dev
# Health checks in a second terminal:
# http://localhost:4000/api/health
# http://localhost:5173
```

## Suggested Commit Message
`platform: integrate backend API/runtime batch and modern frontend scaffold`
