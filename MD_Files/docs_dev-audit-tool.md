# Developer Audit Tool

## Purpose

The developer audit tool runs a repeatable and non-repetitive quality sweep:

- Runtime/dev health (`dev:doctor`)
- Lint checks
- API smoke tests
- Markdown docs audit
- Exact duplicate file detection (hash-confirmed)
- Markdown quality and broken-link detection
- New-vs-resolved issue tracking using a baseline

## Commands

- Run full audit and generate report:
  - `npm run audit:developer`
- Run strict mode (fails only on new high-severity regressions):
  - `npm run audit:developer:strict`
- Run and update baseline (marks current issue set as known):
  - `npm run audit:developer:baseline`
- Generate duplicate safe-delete plan (non-destructive):
  - `npm run audit:duplicates:plan`
- Apply low-risk markdown quality upgrades:
  - `npm run audit:md:upgrade`
- Execute 15 consecutive strict passes with per-pass report:
  - `npm run audit:passes:15`

## Outputs

- JSON report: `.reports/dev-audit-report.json`
- Markdown report: `.reports/dev-audit-report.md`
- Baseline file: `.reports/dev-audit-baseline.json`
- Duplicate plan: `.reports/safe-delete-plan.md`
- Markdown upgrade report: `.reports/md-quality-upgrade-report.md`
- 15-pass run report: `.reports/audit-15-pass.md`

## Workflow

1. Run `npm run audit:developer`.
2. Fix high-severity and startup issues first.
3. Re-run `npm run audit:developer` and verify issue count goes down.
4. Once stable, run `npm run audit:developer:baseline`.

This allows future scans to focus on *new* regressions and avoid repetitive triage.
