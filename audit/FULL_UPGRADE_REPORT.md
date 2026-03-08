# Full Upgrade Report

Date: 2026-03-08
Workspace: `C:\Dev\Rally Forge`

## Scope Completed
This report completes:
1. Full diagnostic/audit review of newly added files and folders.
2. Safe staging plan and execution for upgrade-critical files only.

## New Files/Folders Review

### Findings
- The repository currently contains a very large mixed change set with major unrelated additions/deletions across legacy, docs, archives, and runtime code.
- New/untracked content spans many domains (`app/frontend-modern`, `Scanner/*`, `backend/*`, `knowledge/*`, `docs/*`, `audit/*`, etc.).
- High-risk mixing exists if all untracked files are staged together.

### Upgrade-Critical New Files (Safe Subset)
The following newly added files are directly tied to the scanner upgrade work and are safe to include together:
- `Scanner/VA SCANNER/engine/vaSuperScanner.js`
- `Scanner/VA SCANNER/frontend/utils/extractTDIU.js`
- `tests/combined_rating/combined_rating.regression.test.js`
- `tests/denial_reasons/denial_reasons.regression.test.js`
- `audit/bom-rotation2-report.txt`
- `audit/placeholder-rotation2.txt`
- `audit/FULL_UPGRADE_REPORT.md`

### Upgrade-Critical Modified Files (Safe Subset)
- `.gitignore`
- `package.json`

## Diagnostics and Validation

### Encoding/BOM
- Report file: `audit/bom-rotation2-report.txt`
- Status: `before_count=0`, `fixed_count=0`, `after_count=0` in the scoped first-party runtime paths.

### Placeholder/Stub Scan
- Report file: `audit/placeholder-rotation2.txt`
- Status: `0` hits in scoped runtime paths.

### Regression Tests
- Command: `npm run test:scanner-regression`
- Result: `4` passed, `0` failed.

### Runtime Health
- Backend: `http://localhost:4000/api/health` -> `200`
- Frontend: `http://localhost:5173` -> `200`

## Enhancements Implemented

### Scanner Engine
- Added service-connection type enrichment per condition.
- Added CFR classification metadata per condition.
- Added per-condition effective date enrichment.
- Added rating change detection (`new/increase/decrease/continued/restored/unknown`).
- Added pyramiding risk diagnostics (`38 CFR 4.14` review list).
- Added bilateral applicability diagnostics.
- Added housebound extraction object and summary counters.
- Improved normalization to preserve line/paragraph structure.
- Scanner version set to `4.2.0-cfr-aware-upgrade`.

### TDIU Extractor
- Replaced hardcoded confidence assignments with signal-based scoring.
- Added supplemental extraction for specific reasons, prior occupation, and form references.

### Tests
- Extended regression tests to assert new compliance/housebound/confidence fields.

## Item 2: Safe Staging Plan

### Included (staged)
- `.gitignore`
- `package.json`
- `Scanner/VA SCANNER/engine/vaSuperScanner.js`
- `Scanner/VA SCANNER/frontend/utils/extractTDIU.js`
- `tests/combined_rating/combined_rating.regression.test.js`
- `tests/denial_reasons/denial_reasons.regression.test.js`
- `audit/bom-rotation2-report.txt`
- `audit/placeholder-rotation2.txt`
- `audit/FULL_UPGRADE_REPORT.md`

### Excluded (not staged)
- Large unrelated deletions and untracked additions outside scanner-upgrade-safe scope.
- Legacy/frontend migration bulk churn not required for this scanner upgrade package.

## Recommendation
Proceed with a dedicated commit for only the staged safe subset above, then handle broader repository reorganization in separate, thematic commits.
