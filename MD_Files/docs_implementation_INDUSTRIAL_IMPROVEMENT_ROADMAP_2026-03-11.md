# Rally Forge Industrial Improvement Roadmap

Date: 2026-03-11
Scope: Full-workspace industrial improvement strategy with immediate execution priorities.

## Executive Focus

The current priority track (Analyzer fusion and secondary disability intelligence) is the right operational centerline. Industrialization now requires systematic hardening across:

1. Product reliability and deterministic behavior
2. Testing depth and CI quality gates
3. Data quality and provenance controls
4. Operational observability and incident response
5. Security and governance standards

## Phase 1: Stabilize Core Claims Intelligence (Now - 2 weeks)

Objectives:
- Make analyzer recommendations predictable, explainable, and regression-safe.
- Eliminate hidden behavior drift across workspace data merges.

Actions:
1. Add deterministic derivation regression suite for analyzer modes and lane routing.
2. Enforce stable defaults in workspace model (analyzer settings, mode persistence).
3. Add contract checks for cross-tab evidence fusion and secondary pathway confidence thresholds.
4. Add error budget dashboard metrics: analyzer candidate volume, false-positive review rate, lane distribution shifts.

Success Criteria:
- 95%+ deterministic analyzer snapshots across repeated runs on fixed fixtures.
- No unexplained lane-classification drift in release candidates.

## Phase 2: Build Industrial Test Pyramid (2 - 6 weeks)

Objectives:
- Increase confidence from component to system level.

Actions:
1. Unit tests:
   - derivation functions
   - form/lane mapping
   - compensation utility functions
2. Integration tests:
   - scanner -> workspace -> analyzer pipeline
   - knowledge API compatibility contracts
3. Scenario/regression tests:
   - denied + current + rated mixed cases
   - presumptive-only pathways
   - secondary-only pathways
4. Nonfunctional tests:
   - benchmark scanner extraction and analyzer latency under load

Success Criteria:
- Critical-path coverage >= 85% in analyzer derivations.
- All release branches require green API smoke, derivation regression, and build checks.

## Phase 3: Data and Knowledge Governance (4 - 8 weeks)

Objectives:
- Treat knowledge assets and extracted evidence as governed datasets.

Actions:
1. Add schema validation and version pinning for knowledge files at startup.
2. Add manifest checksum verification and freshness status in health endpoints.
3. Add provenance tags for analyzer outputs: source document IDs, extraction confidence, transformation version.
4. Add backward-compatible migration layer for workspace and knowledge schema updates.

Success Criteria:
- No startup with incompatible knowledge schema unless explicit override.
- Audit-ready trace from recommendation -> evidence -> source document.

## Phase 4: Operations and Observability (6 - 10 weeks)

Objectives:
- Make runtime behavior observable, diagnosable, and supportable.

Actions:
1. Add structured logs with correlation IDs across scanner, queue, analyzer, and knowledge APIs.
2. Add service-level indicators:
   - scanner queue health
   - analyzer derivation time
   - API error rates by route family
3. Add troubleshooting runbooks for queue outages, malformed uploads, and knowledge data drift.
4. Implement periodic synthetic checks (health, knowledge contracts, analyzer smoke).

Success Criteria:
- Mean time to identify root cause < 15 minutes for top 5 incident classes.
- Continuous synthetic monitoring with alerting for critical route regressions.

## Phase 5: Security, Compliance, and Release Governance (8 - 12 weeks)

Objectives:
- Move from feature-complete to enterprise-ready.

Actions:
1. Introduce stricter input validation and request size controls on upload/intelligence endpoints.
2. Add secrets handling and configuration profile hardening.
3. Add release checklist with mandatory security and regression artifacts.
4. Define data-retention and redaction policy for scanner outputs and review notes.

Success Criteria:
- Repeatable release process with signed-off risk checklist.
- No critical security findings in routine dependency and API audits.

## Immediate Recommended Backlog (Top 10)

1. Add analyzer derivation regression suite (mode, lane, score, reasons).
2. Add API contract tests for claim workspace read/write validation.
3. Add CI command grouping: fast smoke, core regression, full validation.
4. Add knowledge manifest checksum validation endpoint.
5. Add structured log fields for analyzer decisions.
6. Add route-level latency histogram collection.
7. Add queue outage simulation test.
8. Add migration/version tests for workspace schema.
9. Add docs: analyzer scoring model and secondary-link rationale map.
10. Add product telemetry report for recommendation outcomes by lane.

## Delivery Cadence Recommendation

1. Weekly reliability sprint: 60% hardening, 40% feature throughput.
2. Biweekly architecture checkpoint on test gaps and error trends.
3. Monthly release readiness review with rollback rehearsal.

## Current Task Continuation Plan

While full-roadmap execution proceeds, continue current analyzer taskline with:
1. Secondary mode tuning using curated clinical/legal pair maps.
2. Expanded evidence-link explanations in condition detail panels.
3. Confidence and rationale normalization to minimize user ambiguity.

---

This roadmap is intended as an execution document: measurable, phased, and compatible with current in-flight workspace modernization work.
