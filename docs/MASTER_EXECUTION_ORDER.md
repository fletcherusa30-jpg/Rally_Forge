# Master Execution Order - Full Modernization

## 1. Repository Preparation
1.1 Validate directory structure
1.2 Remove deprecated files
1.3 Remove unused imports
1.4 Remove commented-out code
1.5 Remove TODOs
1.6 Normalize file naming conventions

## 2. Unified Schema Enforcement
2.1 Import unified schema into all tabs
2.2 Import unified schema into all engines
2.3 Remove local schemas
2.4 Validate schema compliance across repository
2.5 Add schema validation tests

## 3. Global State Modernization
3.1 Implement claimDataUnified as the single source of truth
3.2 Remove duplicate or local state copies
3.3 Implement silent update dispatchers
3.4 Implement global recompute triggers
3.5 Validate state immutability

## 4. Engine Modernization
4.1 Implement derived signals engine
4.2 Implement condition generation engine
4.3 Implement lay statement generator
4.4 Implement evidence index generator
4.5 Implement timeline builder
4.6 Implement normalization utilities
4.7 Implement exposure to condition mapping
4.8 Implement DBQ mapping
4.9 Implement form recommendation ruleset
4.10 Add engine-level tests for all modules

## 5. Tab Modernization
5.1 Tab 01 Profile
5.2 Tab 02 Military Service
5.3 Tab 03 STR
5.4 Tab 04 Current Treatment
5.5 Tab 05 Rating Decision
5.6 Tab 06 Claim Generator
5.7 Tab 07 Resources

## 6. File-Level Audit
6.1 Apply file-by-file audit checklist
6.2 Validate schema imports
6.3 Validate engine integration
6.4 Validate silent update triggers
6.5 Validate no deprecated logic
6.6 Validate no stale data paths

## 7. Test Infrastructure Modernization
7.1 Implement test coverage matrix
7.2 Implement CI/CD test pipeline
7.3 Add unit tests for all engines
7.4 Add integration tests for all tabs
7.5 Add end-to-end tests for full workflow
7.6 Enforce minimum coverage threshold

## 8. Documentation Modernization
8.1 Implement developer onboarding guide
8.2 Implement modernization plan documentation
8.3 Implement Copilot enforcement contract
8.4 Add engine documentation headers
8.5 Add schema documentation

## 9. Final Validation
9.1 Run full CI/CD pipeline
9.2 Validate all tests pass
9.3 Validate all tabs operate silently
9.4 Validate global engine recomputes correctly
9.5 Validate no regressions
9.6 Validate repository cleanliness

## 10. Approval Gate
10.1 Block deployment unless all steps pass
10.2 Block deployment on warnings
10.3 Approve modernization completion
