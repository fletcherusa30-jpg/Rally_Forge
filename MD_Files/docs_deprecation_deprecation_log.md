# Rally Forge Deprecation Ledger

**Purpose:** Track all deprecated files during the STRICT REFACTOR MODE consolidation.  
**Rules:** No file may be deleted until validation is complete and manual approval is given.

---

## PowerShell STRS_SCANNER Consolidation

Historical note: the legacy PowerShell `Scanner/STRS_SCANNER/` tree was removed from the active repository on 2026-03-17 after the Node.js scanner pipeline became the canonical implementation. This ledger is retained as historical migration context only.

### Migration Date: March 9, 2026

| Legacy File | Replacement Module | Status | Validation | Approval |
|-------------|-------------------|--------|------------|----------|
| `STRS.Scanner.ps1` (root) | `engine/core/scanner_core.psm1` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `STRS.Parser.ps1` (root) | `engine/parsers/text_parser.psm1` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `STRS.Output.ps1` (root) | `engine/exporters/json_exporter.psm1` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `STRS.DateDetector.ps1` | `engine/parsers/text_parser.psm1::Get-DateMatches` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `STRS.PageDetector.ps1` | `engine/parsers/text_parser.psm1::Get-PageMarkers` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `STRS.Regex.ps1` | `engine/rules/strs_rules.psm1` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `RegexLibrary.ps1` | `engine/rules/strs_rules.psm1` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `STRS.Scanner.Text.ps1` | `engine/parsers/text_parser.psm1` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `engine/STRS.Parser.ps1` | `engine/parsers/text_parser.psm1` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `engine/STRS.Extractor.ps1` | `engine/parsers/text_parser.psm1` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `engine/STRS.Analyzer.ps1` | `engine/core/scanner_core.psm1::Invoke-AnalysisEngine` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `engine/STRS.Output.ps1` | `engine/exporters/json_exporter.psm1` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `engine/STRS.Utils.ps1` | `engine/transforms/normalization.psm1` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `engine/STRS.NLP.ps1` | `engine/rules/strs_rules.psm1` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `modules/Parser.psm1` | `engine/parsers/text_parser.psm1` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `modules/Extractor.psm1` | `engine/parsers/text_parser.psm1` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `modules/Analyzer.psm1` | `engine/core/scanner_core.psm1` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `modules/Output.psm1` | `engine/exporters/json_exporter.psm1` | ✅ Migrated | ⏳ Pending | ⏳ Pending |
| `Analyzer.Engine.ps1` (root) | `engine/core/scanner_core.psm1` | ✅ Migrated | ⏳ Pending | ⏳ Pending |

---

## Validation Checklist

### STRS_SCANNER Validation
- [ ] Run `Run-STRSTest.ps1` with golden input files
- [ ] Compare JSON output with baseline (must be identical)
- [ ] Verify all 9 test cases pass
- [ ] Performance baseline: scan duration within 10% of original
- [ ] No parse warnings or errors

### Approval Process
1. ✅ Mark "Validation" column as complete
2. ⏳ Request manual approval from user
3. ⏳ User approves deletion
4. ⏳ Archive legacy files to `_deprecated/` folder
5. ⏳ Update this ledger with deletion date

---

## Backend Consolidation

- 2026-03-17: Removed unused legacy backend files `backend/engine/compensationEngine.js`, `backend/engine/compensationEngine.test.js`, `backend/engine/compensation-integration.js`, and `backend/engine/stateBenefits.js` after confirming no active runtime imports remained.
- Canonical engines now live under `backend/domain/engines/` and `compensation-engine/`.

---

## Frontend Consolidation

- 2026-03-17: Removed the empty legacy shell under `app/frontend/`.
- Canonical frontend now lives under `app/frontend-modern/`.

---

## Notes
- All deprecated files are frozen: no edits, no new dependencies
- Legacy files retained for rollback capability
- Only delete after validation + approval
- Migration preserves 100% behavioral equivalence
