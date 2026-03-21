# CI/CD Test Pipeline

## Trigger Policy
- Runs on every commit through push events on all branches.
- Runs on every pull request.
- Runs on merged changes because merges create push events on target branches.

## Pipeline Stages
1. Install and Bootstrap
- Install dependencies.
- Validate environment.
- Validate schema files.

2. Lint and Static Analysis
- Run linter.
- Run type checker.
- Run schema validator.
- Fail on unused imports, dead code, and TODO markers.

3. Unit Tests
- Run all tab-level tests.
- Run all engine-level tests.
- Run all normalization tests.
- Run all mapping table tests.

4. Integration Tests
- Test cross-tab data flow.
- Test silent update triggers.
- Test unified dataset updates.
- Test engine recompute behavior.

5. End-to-End Tests
- Simulate full workflow Profile to Claim Generator.
- Validate final condition list.
- Validate lay statement.
- Validate evidence index.
- Validate timeline.

6. File-Level Audit
- Validate file structure.
- Validate schema imports.
- Validate engine integration.
- Validate no deprecated logic.

7. Build and Package
- Build production bundle.
- Validate build artifacts.

8. Deployment Gate
- Block deployment unless all tests pass.
- Block deployment on warnings.
