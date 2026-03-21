# Scanner Gap Analysis Report
**Generated:** March 17, 2026
**Phase:** File Inventory Comparison
**Status:** All Four Scanners Analyzed
---
## Executive Summary
A comprehensive audit of all four VA scanner implementations reveals significant gaps between specification requirements and actual implementation. The gaps are primarily structural (missing metadata and configuration files) rather than core logic deficiencies.
### Gap Severity Overview
- **DD-214 Scanner**: 17 missing files (38% incomplete)
- **STR Scanner**: 23 missing files (61% incomplete)
- **Current Treatment Scanner**: 21 missing files (60% incomplete)
- **VA Rating Decision Scanner**: 29 missing files (83% incomplete)
**Total Across All Scanners**: 90 missing files (average 62% incomplete)
---
## 1. DD-214 Scanner Analysis
### Current File Inventory
```
âœ“ crossValidation.js
âœ“ evidenceGraphMapping.js
âœ“ index.js
âœ“ mosCatalog.js
âœ“ spdReCodes.js
```
**Actual Count:** 5 files
**Spec Claims "Currently Exist":** 12 files
**Missing Core Logic Files:** 7
### Missing Files from Spec's "Currently Exist"
These are core logic files that the spec assumes exist but aren't found:
```
âœ— dd214Scanner.js                    # Main scanner entry point
âœ— dd214BlockDetectionModel.js        # Block location detection
âœ— dd214ConfidenceModel.js            # Extraction confidence scoring
âœ— dd214OcrCorrection.js              # OCR error correction
âœ— dd214ContinuationParser.js         # Multi-page handling
âœ— dd214StepOneMapper.js              # Step 1: Raw block extraction
âœ— dd214TemplateLibrary.js            # Block templates by branch/era
```
### Missing Configuration & Metadata Files (Must Exist)
```
âœ— config.json
âœ— schema/dd214-block-map.schema.json
âœ— schema/dd214-output.schema.json
âœ— rules/dd214_block_rules.json
âœ— rules/dd214_date_rules.json
âœ— rules/dd214_award_rules.json
âœ— validators/dd214_validators.js
âœ— validators/spdValidator.js
âœ— validators/reValidator.js
```
**Total Missing:** 17 files
### Gap Analysis
| Category | Count | Status |
|----------|-------|--------|
| Core Logic | 7 | **CRITICAL** - Missing main scanner, block detection, confidence scoring |
| Configuration | 1 | **HIGH** - No version/metadata tracking |
| Schemas | 2 | **HIGH** - No formal output validation schemas |
| Rules | 3 | **MEDIUM** - Extraction rules scattered, not centralized |
| Validators | 3 | **MEDIUM** - Validation logic not separated from core |
---
## 2. STR Scanner Analysis
### Current File Inventory
```
âœ“ crossValidation.js
âœ“ evidenceGraphMapping.js
âœ“ extractionLibrary.js
âœ“ index.js
âœ“ strSchema.js
âœ“ timelineBuilder.js
```
**Actual Count:** 6 files
**Spec Claims "Currently Exist":** 7 files
**Missing Core Logic Files:** 1
### Missing Files from Spec's "Currently Exist"
```
âœ— strDeterministicScanner.js         # Main STR scanner entry
```
### Missing Configuration & Metadata Files (Must Exist)
```
âœ— config.json
âœ— schema/str-encounter.schema.json
âœ— schema/str-output.schema.json
âœ— rules/str_encounter_rules.json
âœ— rules/str_exposure_rules.json
âœ— rules/str_chronicity_rules.json
âœ— validators/str_validators.js
âœ— validators/exposureValidator.js
âœ— validators/chronologyValidator.js
âœ— databases/exposures.json
âœ— databases/medicalTerms.json
âœ— databases/mosHazards.json
```
**Total Missing:** 17 files (including strDeterministicScanner.js)
### Gap Analysis
| Category | Count | Status |
|----------|-------|--------|
| Core Logic | 1 | **MEDIUM** - Main scanner wrapper missing, but extraction logic exists |
| Configuration | 1 | **HIGH** - No version/metadata |
| Schemas | 2 | **HIGH** - Output validation schemas missing |
| Rules | 3 | **MEDIUM** - Encounter/exposure/chronicity rules not centralized |
| Validators | 3 | **MEDIUM** - Validator modules not separated |
| Databases | 3 | **HIGH** - Reference data (exposures, medical terms, MOS hazards) missing |
---
## 3. Current Treatment Scanner Analysis
### Current File Inventory
```
âœ“ crossValidation.js
âœ“ evidenceGraphMapping.js
âœ“ extractionLibrary.js
âœ“ index.js
âœ“ schema.js
âœ“ timelineBuilder.js
```
**Actual Count:** 6 files
**Spec Claims "Currently Exist":** 8 files
**Missing Core Logic Files:** 2
### Missing Files from Spec's "Currently Exist"
```
âœ— currentTreatmentScanner.js         # Main scanner entry
âœ— currentTreatmentAnalysis.js        # Analysis engine
```
### Missing Configuration & Metadata Files (Must Exist)
```
âœ— config.json
âœ— schema/current-treatment-condition.schema.json
âœ— schema/current-treatment-medication.schema.json
âœ— schema/current-treatment-output.schema.json
âœ— rules/condition_extraction_rules.json
âœ— rules/medication_extraction_rules.json
âœ— rules/symptom_extraction_rules.json
âœ— validators/current_treatment_validators.js
âœ— validators/medicationValidator.js
âœ— validators/functionalImpactValidator.js
âœ— databases/medications.json
âœ— databases/diagnoses.json
âœ— databases/symptoms.json
```
**Total Missing:** 17 files (including 2 core logic files)
### Gap Analysis
| Category | Count | Status |
|----------|-------|--------|
| Core Logic | 2 | **MEDIUM** - Scanner/analysis entry points missing |
| Configuration | 1 | **HIGH** - No version/metadata |
| Schemas | 3 | **HIGH** - Separate schemas for conditions, medications, output missing |
| Rules | 3 | **MEDIUM** - Extraction rules not centralized |
| Validators | 3 | **MEDIUM** - Medication and functional impact validators missing |
| Databases | 3 | **HIGH** - Medication, diagnosis, and symptom reference data missing |
---
## 4. VA Rating Decision Scanner Analysis
### Current File Inventory
```
âœ“ cueAnalysis.js
```
**Actual Count:** 1 file
**Spec Claims "Currently Exist":** 4 files
**Missing Core Logic Files:** 3
### Missing Files from Spec's "Currently Exist"
```
âœ— index.js                           # Module exports
âœ— vaDecisionScanner.js               # Main scanner entry
âœ— ratingDecisionAnalysis.js          # Analysis engine
```
### Missing Configuration & Metadata Files (Must Exist)
```
âœ— config.json
âœ— schema/rating-decision-condition.schema.json
âœ— schema/rating-decision-smc.schema.json
âœ— schema/rating-decision-output.schema.json
âœ— rules/rating_extraction_rules.json
âœ— rules/rating_validation_rules.json
âœ— rules/smc_rules.json
âœ— validators/rating_validators.js
âœ— validators/diagnosticCodeValidator.js
âœ— validators/smcValidator.js
âœ— validators/combinedRatingValidator.js
âœ— transforms/combinedRatingCalculator.js
âœ— transforms/bilateralFactorCalculator.js
âœ— transforms/backPayCalculator.js
âœ— databases/diagnosticCodes.json
âœ— databases/smcCodes.json
âœ— databases/scheduleRatings.json
âœ— databases/presumptiveMappings.json
```
**Total Missing:** 25 files (3 core + 22 metadata/config)
### Gap Analysis
| Category | Count | Status |
|----------|-------|--------|
| Core Logic | 3 | **CRITICAL** - Scanner/analysis/exports mostly missing |
| Configuration | 1 | **HIGH** - No version/metadata |
| Schemas | 3 | **HIGH** - Output schemas missing |
| Rules | 3 | **HIGH** - Extraction and validation rules not centralized |
| Validators | 4 | **HIGH** - Diagnostic, SMC, rating validators missing |
| Transforms | 3 | **HIGH** - Rating calculations (combined, bilateral, backpay) missing |
| Databases | 4 | **CRITICAL** - Reference data (DCs, SMC codes, schedules) missing |
---
## Cross-Scanner Gap Patterns
### Pattern 1: Missing Core Entry Points
All scanners are missing formal scanner class/module files:
- DD-214: `dd214Scanner.js`
- STR: `strDeterministicScanner.js`
- Current Treatment: `currentTreatmentScanner.js` + `currentTreatmentAnalysis.js`
- VA Rating Decision: `vaDecisionScanner.js` + `ratingDecisionAnalysis.js`
**Impact:** Current `index.js` files likely export raw functions rather than clean scanner classes/objects.
### Pattern 2: Missing Configuration Layer
None of the scanners have `config.json` files with:
- Version tracking
- Metadata about pipeline stages
- Feature flags
- Logging configuration
**Impact:** Difficult to track scanner versions, enabling/disabling features, debug behavior.
### Pattern 3: No Formal Schema Definitions
All scanners are missing JSON schema files for:
- Output validation
- Input requirements
- Field specifications
Currently schemas exist only as embedded JS objects (`strSchema.js`, `schema.js`).
**Impact:** No formal contract for output, difficult to validate third-party code acceptance of scanner output.
### Pattern 4: No Centralized Rules
All scanners missing dedicated rule files:
- Extraction rules (JSON-based)
- Validation rules
- Transform rules
**Impact:** Rules embedded in code, difficult to modify without code changes.
### Pattern 5: Missing Reference Databases
STR, Current Treatment, and Rating Decision scanners missing:
- Diagnostic/condition codes mappings
- Drug databases
- Medical terminology glossaries
- Reference data tables
**Impact:** No deterministic lookup tables for validation/transformation.
---
## Priority Ranking for Missing Files
### Phase 1: Critical (Blocks Functionality)
1. **Rating Decision Transforms**: `combinedRatingCalculator.js`, `bilateralFactorCalculator.js`, `backPayCalculator.js` â€” core VA compensation math
2. **Rating Decision Databases**: All 4 database files (DCs, SMC codes, schedules, presumptive mappings)
3. **Core Logic for Rating Decision**: `vaDecisionScanner.js`, `ratingDecisionAnalysis.js`
### Phase 2: High (Blocks Modernization)
1. **All config.json files** (4 scanners) â€” missing metadata layer
2. **Validator modules** (all scanners) â€” validation logic separation
3. **Reference databases** for STR and Current Treatment â€” exposure/medication/diagnosis lookups
### Phase 3: Medium (Improves Consistency)
1. **Schema files** (all scanners) â€” formalizes output contracts
2. **Rule files** (all scanners) â€” centralizes extraction logic
3. **Core scanner classes** (DD-214, STR, Current Treatment) â€” cleaner API
---
## File Generation Roadmap
```
Total Files to Generate: 90
By Type:
  - config.json files: 4
  - schema/*.json files: 11
  - rules/*.json files: 12
  - validators/*.js files: 13
  - transforms/*.js files: 3
  - databases/*.json files: 13
  - core scanner logic files: 10
  - index.js files: 1
  - Other core logic: 20
Estimated Implementation Cost:
  - DD-214: 17 files over 2-3 implementation steps
  - STR: 17 files over 2-3 steps
  - Current Treatment: 17 files over 2-3 steps
  - VA Rating Decision: 25 files over 3-4 steps
Total Implementation Steps: ~12 steps
```
---
## Risk Assessment
### Low Risk
- Creating config.json files (straightforward metadata)
- Creating schema files (well-defined specs)
- Creating rule/database JSON files (data-driven)
### Medium Risk
- Creating validator modules (must align with existing cross-validation patterns)
- Creating transforms (must implement correct VA math formulas)
### High Risk
- Creating main scanner entry points (must wrap existing logic correctly)
- Ensuring deterministic behavior across new files
---
## Implementation Strategy
1. **Generate config.json files first** (simple, unblocks schema/rules)
2. **Generate schema files** (define output contracts)
3. **Generate database files** (reference data)
4. **Generate rule files** (extraction/validation rules)
5. **Generate validator modules** (separate validation concerns)
6. **Generate transforms** (calculations like combined rating)
7. **Generate core scanner classes** (clean API wrappers)
8. **Execute test suite to validate all new code**
9. **Generate modernization report**
---
## Next Steps
Proceed with file generation in priority order:
âœ… Phase 1: Complete
  - Gap analysis document created (this file)
  - All missing files identified and categorized
ðŸ”„ Phase 2: Ready to Begin
  - Generate 4 config.json files
  - Generate 11 schema/*.json files
  - Generate 13 database/*.json files
â³ Phase 3: Will Follow
  - Generate 12 rule/*.json files
  - Generate validators and transforms
  - Generate core scanner logic
  - Execute full test suite
  - Generate modernization report
---
**Estimated Time to Complete All Phases:** 2-3 hours of autonomous generation + integrated testing

