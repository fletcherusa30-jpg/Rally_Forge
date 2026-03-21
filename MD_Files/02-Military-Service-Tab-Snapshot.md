# Tab 02 Snapshot: Military Service

## Primary Function
This tab records structured military service history and supports DD-214 upload/extraction to prefill service data. It builds the core service context used by STR, treatment, analyzer, and summary pages.

## What This Tab Asks For
- Upload path:
  - DD-214 PDF upload
  - User review of extracted values before apply
- Manual service intake:
  - Branch of Service
  - Service Type
  - Start Date / End Date
  - Rank/Rate
  - Discharge Type
  - MOS / Rate / AFSC (including additional MOS)
  - Service Era
  - Deployment Location(s)
  - Combat Veteran toggle
  - Radiation operation selections

## Layout and Design Snapshot
```text
Page Header
  [Eyebrow: Service History] [Title: Military Service] [Badge: Service record intake]

Carry Forward Card (from Profile)

Card A: Upload DD-214
  - Upload button + status/error
  - Extracted summary panel with confidence
  - Multi-panel readout:
    Service Profile
    Discharge and Separation
    Combat and Benefits
    Hazard and Deployment Pay
    Installation Exposure Indicators (conditional)
    Badges and Awards (conditional)
    Extended Service Data (conditional)
    Transfer and Assignment (conditional)
  - Apply to Form button

Card B: Military Service Information
  - Manual form grid (service fields)
  - Add/update record controls

Card C: Analyzer
  - Exposure suggestions and related context controls

Card D: Service Records (aggregate list)
  - Existing entries with edit/delete
  - Save records action
```

## Information Produced for Later Tabs
- Service periods, branch, MOS, deployment context
- Likely exposure signals and presumptive location hints
- DD-214 structured extraction fields (including separation and service metadata)

## UX and Review Notes
- Strong dual-path flow: users can scan DD-214 or enter manually.
- Extraction review panel is detailed and now includes high-value fields (DOB, station at separation, accrued leave, SPD/RE meanings).
- Installation exposure indicator surface adds meaningful claim-development context.
- Good review point: ensure operator understands extracted values remain advisory until explicitly applied.

## Suggested Additional Improvements
- Add per-field extraction confidence badges in the DD-214 view.
- Add one-click "compare extracted vs current form" diff modal.
- Add inline glossary links for SPD/RE and separation authority terms.
