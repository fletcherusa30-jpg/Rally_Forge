# Batch 5 Staging Proposal - Legacy Cleanup

Date: 2026-03-08
Repository: `C:\Dev\Rally Forge`

## Objective
Final batch: Stage all remaining legacy deletions to complete repository modernization. This batch removes obsolete code, documentation, and modules that have been replaced by the new infrastructure committed in batches 1-4.

## Include Scope (Batch 5)

### Legacy Deletions (135 files)
All remaining deletions of obsolete files:
- `FINANCIAL ENGINE/**` - Legacy financial planner modules (replaced by app/frontend-modern components)
- `frontend/**` - Old frontend structure (replaced by app/frontend-modern)
- `src/**` - Legacy source files (replaced by modern structure in batch 2-4)
- `.vscode/**` - Old VS Code configuration
- Root-level obsolete files:
  - Old documentation (2026-02-12-work-log.md, IMPLEMENTATION_COMPLETE.md)
  - Old PDFs (38 CFR Part 3/4 PDFs moved or consolidated)
  - Sample claim letters (ClaimLetter-2017-12-15.pdf)
  - Old logo (LOGO.png)
  - Temporary files (_tmp_claimletter_text.txt)

## Explicit Exclude Scope

### Personal/Temporary Files (DO NOT COMMIT)
- `Fletcher 0772 20 MEB AHLTA.pdf` (personal medical document)
- `Scanner/STRS_SCANNER_BACKUP_20260306_230242.zip` (backup archive)

## Proposed Commands
```powershell
Set-Location "C:\Dev\Rally Forge"

# Stage all remaining changes (135 deletions)
git add -u

# Unstage personal/temp files if accidentally included
git restore --staged -- "Fletcher 0772 20 MEB AHLTA.pdf" "Scanner/STRS_SCANNER_BACKUP_20260306_230242.zip" 2>&1 | Out-Null

# Verify only deletions are staged
git diff --cached --name-status | Where-Object { $_ -notmatch '^D' } | Measure-Object -Line
# ^ Should be 0 (only deletions)

# Verify count of deletions
git diff --cached --name-status | Where-Object { $_ -match '^D' } | Measure-Object -Line
# ^ Should be 135

# Inspect what's being deleted
git diff --cached --name-status | Select-Object -First 50
```

## Validation Gates Before Commit
```powershell
# Regression tests should still pass
npm run test:scanner-regression

# Verify working directory is clean except personal files
git status --short
# Should only show the 2 untracked personal files
```

## Suggested Commit Message
`cleanup: remove legacy modules replaced by modern infrastructure

Batch 5: Legacy cleanup - final modernization step

Removed obsolete modules (135 files):

FINANCIAL ENGINE removal:
- Legacy financial planner (React/Flutter/SwiftUI UIs)
- Old budget/retirement engines (PowerShell/Dart/Swift/JS)
- Replaced by: app/frontend-modern financial components + backend/engine/compensation

Frontend removal:
- Old frontend structure
- Replaced by: app/frontend-modern (React/Vite/Tailwind)

Source removal:
- Legacy src/** structure
- Replaced by: Modern backend/**, app/frontend-modern/src/**

Configuration cleanup:
- Old .vscode/copilot-instructions.md
- Old work logs, temporary files
- Sample documents moved to appropriate locations

Documentation cleanup:
- Obsolete IMPLEMENTATION_COMPLETE.md
- Old PDF copies (38 CFR Part 3/4 - consolidated in knowledge/)
- Sample claim letters (archived)

All removals verified safe:
- No runtime dependencies on deleted modules
- All functionality replaced in batches 1-4
- Scanner v4.2.0 regression tests passing (4/4)

Repository now fully modernized with clean thematic commit history:
- Batch 1 (fa133da): Scanner v4.2.0 upgrade
- Batch 2 (d43106a): Backend API/runtime + modern frontend scaffold
- Batch 3 (036bdf4): Infrastructure + scanner expansion
- Batch 4 (b92c493): Runtime additions + test infrastructure
- Batch 5 (this): Legacy cleanup (135 deletions)

Total upgrade: 1,340+ files added/modified, 146 obsolete files removed"`
