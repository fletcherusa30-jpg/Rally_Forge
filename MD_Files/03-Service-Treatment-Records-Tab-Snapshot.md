# Tab 03 Snapshot: Service Treatment Records

## Primary Function
This tab ingests in-service medical evidence (upload or manual) and extracts diagnoses, injuries, events, and supporting evidence signals from STR documents.

## What This Tab Asks For
- Upload path:
  - STR files (PDF/TXT) for scanner processing
- Manual path:
  - Condition/disability entry
  - Event date
  - Description
  - Service-event flags and related context fields
- Reviewer actions:
  - Expand findings
  - Submit extraction feedback

## Layout and Design Snapshot
```text
Page Header
  [Title: Service Treatment Records]

Carry Forward Card (from tabs 1-2)

Hearing Loss and Threshold Shift Review Card
  - Readiness and findings hints
  - Audiogram signal guidance

Tab Strip
  [File Upload] [Manual Entry]

Manual Entry View
  Card: Manual Entry - Symptoms, Disabilities and Events
  Card: Saved Entries (summary counts + entry list)

Upload View
  Card: Upload Service Treatment Records
  Card: Analysis Results
    - Diagnoses
    - Injuries
    - Events
    - Presumptive location signals
    - AI analysis context and evidence snippets
```

## Information Produced for Later Tabs
- In-service findings that support nexus/chronicity patterns
- Structured evidence objects for analyzer and case summary
- Uploaded/manual counts and summary statistics

## UX and Review Notes
- Good split between scanning and manual rescue path when parsing quality is low.
- Hearing-focused review block is a valuable domain-specific quality gate.
- Review point: large result sets can become dense; consider progressive disclosure by category severity.

## Suggested Additional Improvements
- Add confidence filter chips (high/medium/low confidence findings).
- Add deduplicated timeline view of in-service events.
- Add quick-action to convert a finding directly into a condition workspace draft.
