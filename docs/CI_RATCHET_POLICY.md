# CI Quality Ratchet Policy

## Goal
Restore full-repository strict quality gates without reintroducing pipeline instability.

## Rules
- No phase expansion is allowed unless the prior phase is stable for 5 consecutive runs on `main`.
- Warning and violation counts must not increase above the approved baseline.
- Any newly created or modified file is held to strict standards immediately.

## Phases
1. Phase 0 (current): active modernization surfaces only.
2. Phase 1: expand to `backend/controllers` and `backend/services`.
3. Phase 2: expand to scanner backend routes and services.
4. Phase 3: expand to scanner engine and scanner frontend utility layers.
5. Phase 4: expand to `tooling/scripts`.
6. Phase 5: full-repository strict mode with warnings treated as CI failures.

## Metrics Tracked Per Phase
- Lint error count
- Lint warning count
- Static guard violation count
- File-audit violation count
- Deployment-gate pass rate

## Promotion Criteria
- 5 consecutive green runs on `main`.
- No increase in tracked quality metrics.
- No new policy exceptions introduced.

## Rollback Trigger
- Any 2 failures in 3 consecutive `main` runs after a phase expansion.

## Ownership
- Each phase must have one explicit owner and target date.
- Phase transitions require owner sign-off in the tracking issue.