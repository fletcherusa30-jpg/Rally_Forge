# Tab 04 Snapshot: Current Treatment

## Primary Function
This tab captures present-day diagnoses, symptoms, appointments, and treatment continuity. It links current severity and persistence to prior in-service evidence.

## What This Tab Asks For
- Upload path:
  - Current treatment documents (typically medical records)
- Manual path:
  - Condition name
  - Symptom summary
  - Status (active/inactive context)
  - Provider and treatment details
- Optional analyst actions:
  - Export current treatment analysis

## Layout and Design Snapshot
```text
Page Header
  [Title: Current Treatment Records]

Carry Forward Card
  - Veteran identity
  - STR diagnosis/injury carry-forward
  - Prior provider suggestion
  - Conditions needing current diagnosis

Tab Strip
  [File Upload] [Manual Entry]

Manual Entry View
  Card: Manual Entry - Current Diagnoses and Symptoms
  Card: Saved Entries (total, active, provider counts)

Upload View
  Card: Upload Current Treatment Documents
  Card: Current Treatment Analysis Results
    - Current conditions
    - Functional limitations
    - Appointments and treatment events
```

## Information Produced for Later Tabs
- Current diagnosis and symptom evidence for claim readiness scoring
- Provider and treatment continuity signals
- Structured current-treatment summary for Analyzer and Case Summary

## UX and Review Notes
- Clean symmetry with STR page helps user mental model.
- Strong carry-forward support reduces re-entry workload.
- Review point: ensure condition normalization avoids duplicates when users mix upload and manual entries.

## Suggested Additional Improvements
- Add a treatment timeline chart grouped by provider.
- Add "worsening trend" indicator across repeated uploads.
- Add a dedicated section for prescribed medications and side effects.
