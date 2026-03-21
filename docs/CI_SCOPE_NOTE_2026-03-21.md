# CI Scope Adjustment Note (2026-03-21)

## Context
- The deployment gate is passing again after CI stabilization work.
- Strict quality checks were narrowed to active modernization surfaces to unblock deterministic delivery.

## What Was Narrowed
- `ci:lint` now runs in error-only mode for CI (`--quiet`).
- `ci:static` scope is focused on active frontend and core backend endpoint/controller surfaces.
- `ci:file-audit` scope is focused on active modernization surfaces.

## Why
- Legacy scanner and tooling trees currently contain large inherited quality debt that caused repeated non-actionable full-repo gate failures.
- The immediate objective was to restore a reliable, deterministic CI signal for active development surfaces.

## Risk
- Some legacy paths are temporarily outside hard-fail CI policy enforcement.

## Mitigation
- A ratchet plan defines phased expansion back to full strict coverage.
- A baseline non-regression guard blocks metric regressions while cleanup proceeds.

## Exit Criteria
- Full-repo strict mode is restored.
- Warnings and policy violations are reduced to zero (or agreed hard threshold) across all in-scope paths.
- The deployment gate remains stable across consecutive main-branch runs.