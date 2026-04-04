# MASTER_02_Tab-Snapshots

## Purpose
Consolidated markdown master file generated from MD_Files source documents.

## Generated
- Timestamp: 2026-03-23 20:11:07
- Source file count: 9

## Source Files
- 00-Tab-Snapshot-Index.md
- 01-Profile-Tab-Snapshot.md
- 02-Military-Service-Tab-Snapshot.md
- 03-Service-Treatment-Records-Tab-Snapshot.md
- 04-Current-Treatment-Tab-Snapshot.md
- 05-VA-Rating-Decision-Tab-Snapshot.md
- 06-Analyzer-Tab-Snapshot.md
- 07-Case-Summary-Tab-Snapshot.md
- 08-Resources-Tab-Snapshot.md

## Consolidated Content

---

### Source: 00-Tab-Snapshot-Index.md

# Rally Forge Tab Snapshot Index (1-8)

## Simplified Summary
Use this index to review each workflow tab in order.

## Key Points
- Primary function
- Requested/entered information
- Visual layout diagram
- Produced outputs
- Review notes and suggested enhancements
- This document has been simplified for faster review and implementation alignment.
- Last simplified: 2026-03-23

## Status
- This document has been simplified for faster review and implementation alignment.
- Last simplified: 2026-03-23

---

### Source: 01-Profile-Tab-Snapshot.md

# Tab 01 Snapshot: Profile

## Simplified Summary
The Profile tab is the identity and contact foundation for the whole workflow. It captures veteran identity, contact details, and case notes that are reused by downstream tabs.

## Key Points
- Personal Information:
- First Name
- Middle Name
- Last Name
- Date of Birth
- Last 4 of SSN
- Contact Information:
- Email

## Status
- This document has been simplified for faster review and implementation alignment.
- Last simplified: 2026-03-23

---

### Source: 02-Military-Service-Tab-Snapshot.md

# Tab 02 Snapshot: Military Service

## Architecture Note
**Redesigned 2026-04-03.** This tab was fully rebuilt as a single-page authoritative review surface replacing the legacy multi-card, multi-tab layout. The former Card A / Card B / Card C / Card D structure is retired.

## Simplified Summary
Authoritative review and management of all military service periods for the active claim. Supports DD-214 scanner ingestion, inspector-driven period editing, and AI-consumable service summary export. Provides the canonical service context consumed by STR, Current Treatment, Analyzer, and Case Summary tabs.

## Key Points
- Context bar (sticky): veteran name, step 02 · Development / Military Service, status chips (Synced/Issues/Unsaved), Sync Draft + Next CTA
- Military Service Summary canvas: Total Periods, Earliest Start, Latest End, Eligibility Status, Confidence Score
- Authoritative service periods table (read-only): Branch, Component, Date Range, Character of Service, Deployments, Awards, Validation
- Inspector panel (opens on row selection): Service Details, Conflict/Deployment, Awards, Entered Record Metadata
- Scanner Findings panel: DD-214 upload preserved, per-issue clickable list, confidence score
- AI-consumable militaryServiceSummary is persisted in background artifacts (not shown as raw JSON in reviewer UI)
- Audit log: last 40 user actions (select-period, save-inspector, scan-success, etc.)
- Next CTA routes to `/development/service-treatment-records`; blocked by blocking scanner issues

## Status
- Redesigned 2026-04-03 — single-page authoritative review surface

---

### Source: 03-Service-Treatment-Records-Tab-Snapshot.md

# Tab 03 Snapshot: Service Treatment Records

## Simplified Summary
This tab ingests in-service medical evidence (upload or manual) and extracts diagnoses, injuries, events, and supporting evidence signals from STR documents.

## Key Points
- Upload path:
- STR files (PDF/TXT) for scanner processing
- Manual path:
- Condition/disability entry
- Event date
- Description
- Service-event flags and related context fields
- Reviewer actions:

## Status
- This document has been simplified for faster review and implementation alignment.
- Last simplified: 2026-03-23

---

### Source: 04-Current-Treatment-Tab-Snapshot.md

# Tab 04 Snapshot: Current Treatment

## Simplified Summary
This tab captures present-day diagnoses, symptoms, appointments, and treatment continuity. It links current severity and persistence to prior in-service evidence.

## Key Points
- Upload path:
- Current treatment documents (typically medical records)
- Manual path:
- Condition name
- Symptom summary
- Status (active/inactive context)
- Provider and treatment details
- Optional analyst actions:

## Status
- This document has been simplified for faster review and implementation alignment.
- Last simplified: 2026-03-23

---

### Source: 05-VA-Rating-Decision-Tab-Snapshot.md

# Tab 05 Snapshot: VA Rating Decision

## Simplified Summary
This tab extracts adjudicative outputs from VA decision documents and aligns them with claim-development data. It tracks granted and denied conditions, ratings, dates, dependents, SMC, and compensation context.

## Key Points
- Upload and scan path:
- VA rating decision PDF upload
- Manual path:
- Service-connected conditions and percentages
- Denied conditions
- Effective dates
- Combined rating and compensation context
- Review path:

## Status
- This document has been simplified for faster review and implementation alignment.
- Last simplified: 2026-03-23

---

### Source: 06-Analyzer-Tab-Snapshot.md

# Tab 06 Snapshot: Analyzer

## Simplified Summary
Analyzer is the cross-tab synthesis engine. It correlates service, STR, treatment, and VA decision data to surface filing readiness, evidence gaps, secondary-service-connection candidates, exposure risk context, and DBQ/CFR relevance.

## Key Points
- No primary raw-document upload here.
- User interaction inputs:
- Secondary match mode (Conservative/Balanced/Aggressive)
- Trigger scanner output detection
- Exposure selection adjustments per service record
- Condition selection for detail drill-down
- Secondary match mode controls
- Scanner output detection console

## Status
- This document has been simplified for faster review and implementation alignment.
- Last simplified: 2026-03-23

---

### Source: 07-Case-Summary-Tab-Snapshot.md

# Tab 07 Snapshot: Case Summary

## Simplified Summary
This tab is the filing-prep synthesis checkpoint. It consolidates prior tabs into readiness, evidence index, form recommendations, and export outputs for final review.

## Key Points
- No direct intake forms required.
- Reviewer actions:
- Select condition from workspace list
- Review detail panel per condition
- Export summary artifacts (TXT/JSON/Print)
- Workflow Readiness
- Claim Signals
- Recommended Next Actions

## Status
- This document has been simplified for faster review and implementation alignment.
- Last simplified: 2026-03-23

---

### Source: 08-Resources-Tab-Snapshot.md

# Tab 08 Snapshot: Resources

## Simplified Summary
This tab is the tool launchpad after case synthesis. It routes the reviewer to supporting modules for financial planning, references, state programs, and operational review queues.

## Key Points
- No direct data entry.
- Reviewer chooses which support tool to open:
- Financial Planner
- Knowledge Base
- State Benefits
- Review Queue
- Scanner Activity
- Workspace Updates

## Status
- This document has been simplified for faster review and implementation alignment.
- Last simplified: 2026-03-23

