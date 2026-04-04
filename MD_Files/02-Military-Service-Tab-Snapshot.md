# Tab 02 Snapshot: Military Service

## Architecture Note
**Redesigned 2026-04-03.** This tab was fully rebuilt as a single-page authoritative review surface replacing the legacy multi-card, multi-tab layout. The former Card A / Card B / Card C / Card D structure is retired.

## Primary Function
Authoritative review and management of all military service periods for the active claim. Supports DD-214 scanner ingestion, inspector-driven period editing, and AI-consumable service summary export. Provides the canonical service context consumed by STR, Current Treatment, Analyzer, and Case Summary tabs.

## What This Tab Asks For
- DD-214 PDF upload (scanner path — preserved from prior design)
- Service period fields via inline inspector only (no standalone form):
  - Branch of Service
  - Service Type (Active / Reserve / Guard)
  - Start Date / End Date
  - Rank / Rate
  - Discharge Type / Character of Service
  - MOS / Rate / AFSC (including additional MOS codes)
  - Service Era (auto-derived)
  - Deployment Location(s)
  - Combat Veteran flag
  - Awards and Decorations (comma-delimited)
  - Radiation operation associations
  - Source metadata (manual / dd214-extracted)

## Layout and Design Snapshot
```text
Context Bar (sticky, z-index: 25)
  [Veteran Name]  [Step: 02 · Development / Military Service]
  [Status chips: Synced | Issues | Unsaved]
  [Sync Draft button]  [Next → button]

Military Service Summary Canvas
  [Total Periods] [Earliest Start] [Latest End]
  [Status: Eligible / Needs Review / Ineligible]
  [Confidence Score: 0–100]

Service Periods Table (read-only master list)
  Columns: Branch | Component | Date Range | Character of Service | Deployments | Awards | Validation
  Row click → opens Inspector Panel
  Validation column: Valid | Review | Blocking

Inspector Panel (appears on row selection)
  [Collapsible] Service Details
    Branch, Component, Start/End, Rank, Discharge
  [Collapsible] Conflict and Deployment
    Combat Veteran toggle, Deployment locations
    Radiation operations
  [Collapsible] Awards and Decorations
    Awards list
  [Collapsible] Entered Record Metadata
    Source, extraction status
  [Save changes] [Cancel] [Clear selection]

Scanner Findings Panel
  DD-214 upload button + upload status / error
  Per-issue list (click issue → highlights related table row)
  Scanner confidence score
  Scan metadata (file name, timestamp, queue job id)

Machine Artifact Channel (background only)
  militaryServiceSummary JSON object is persisted to workspace aiArtifacts
  and is intentionally hidden from the reviewer UI surface.
  Human-facing presentation is the DD214 Structured Summary panel.

Audit Log (last 40 entries, internal)
  Events: select-period, save-inspector, cancel-inspector,
          scan-success, scan-error, scan-cancel, persist
```

## Information Produced for Later Tabs
- Canonical `servicePeriods[]` array (branch, component, dates, MOS, deployments, awards, discharge type)
- `militaryServiceSummary` JSON (AI-consumable structured object)
- Exposure signals and presumptive deployment locations
- Eligibility status and confidence score (Eligible / Needs Review / Ineligible)
- Scanner issues list with severity and blocking flags

## Key Behavioral Contracts
- `STORAGE_KEY = 'militaryServiceRecords'` — localStorage key for record persistence
- `AUTO_DD214_RECORD_ID = 'dd214-auto-record'` — stable ID for DD-214-extracted record
- `normalizeRecord(record, index)` — maps raw records to stable period objects; generates `derivedId` from branch + startDate + endDate as fallback when `record.id` is absent
- `makeScannerIssues(servicePeriods, recognizedLocations)` — deterministic issue engine; produces typed issues (missing-service-periods, missing-dates, conflicting-dates, missing-branch, unsupported-deployment, award-verification)
- `computeServiceOverview(periods, scannerIssues)` — derives summary stats and eligibility result
- `fromInspectorDraft(record, draft, recognizedLocations)` — applies inspector edits back to raw record shape including source field
- `toInspectorDraft(period)` — converts normalized period to inspector form state
- `hasBlockingIssue(scannerIssues)` — gates the Next CTA; blocking issues disable navigation
- `Next` CTA routes to `/development/service-treatment-records`

## UX and Review Notes
- Single-page design eliminates form/list separation; all editing is inspector-driven, row-selection-gated.
- Status chips (Synced, Issues, Unsaved) give real-time workspace feedback without blocking progress.
- Scanner panel is always visible; upload is preserved from prior design; per-issue clickable rows drive period focus.
- AI summary artifacts are persisted in the background (`aiArtifacts.militaryServiceSummary`) and not rendered as raw JSON in the reviewer UI.
- All record changes go through dual persistence: localStorage + `updateWorkspace` context call.
- Audit log tracks all user actions deterministically (last 40 entries).

## Source Files
- `app/frontend-modern/src/tabs/military-service/MilitaryServiceTab.jsx` — primary component (~980 lines)
- `app/frontend-modern/src/pages/MilitaryServicePage.jsx` — route wrapper (simplified; renders `<MilitaryServiceTab />`)
- `app/frontend-modern/src/tabs/military-service/normalization.js` — shared normalization utilities (unchanged)
- `app/frontend-modern/src/tabs/military-service/schema.js` — BRANCH_VALUES, DISCHARGE_TYPE_VALUES, SERVICE_TYPE_VALUES
- `app/frontend-modern/src/tabs/military-service/extraction.js` — DD-214 panel extraction helpers
- `app/frontend-modern/src/styles.css` — military-review-* CSS classes added

## Last Updated
- 2026-04-03 — Full single-page redesign replacing legacy multi-card layout
