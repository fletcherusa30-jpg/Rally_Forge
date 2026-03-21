# Tab 05 Snapshot: VA Rating Decision

## Primary Function
This tab extracts adjudicative outputs from VA decision documents and aligns them with claim-development data. It tracks granted and denied conditions, ratings, dates, dependents, SMC, and compensation context.

## What This Tab Asks For
- Upload and scan path:
  - VA rating decision PDF upload
- Manual path:
  - Service-connected conditions and percentages
  - Denied conditions
  - Effective dates
  - Combined rating and compensation context
- Review path:
  - Manual review notes for low-confidence extraction
  - Evidence span inspection when scanner flags review

## Layout and Design Snapshot
```text
Page Header
  [Title: VA Rating Decision]

Carry Forward Card
  - Veteran identity
  - Potential unrated conditions
  - STR and treatment source counts

Tab Strip
  [Upload and Scan] [Manual Entry]

Manual Entry View
  Card: Manual VA Disability Entry

Upload View
  Card: Upload and Analyze - VA Rating Decision
  Card: Results - VA Rating Decision
    - Combined rating and decision metadata
    - Service-connected conditions
    - Denied conditions
    - SMC/dependent adjustments
    - Manual review warning block (conditional)
    - Evidence span trace panel (conditional)
```

## Information Produced for Later Tabs
- Rated/denied condition sets used in analyzer crosswalk
- Effective date and compensation references
- Manual-review quality signals for audit queue

## UX and Review Notes
- Strong separation between intake and adjudication review.
- Manual review warning is clear and high-value for quality control.
- Review point: decision documents often contain OCR noise; consider explicit "source confidence by section" panel.

## Suggested Additional Improvements
- Add per-condition confidence badges.
- Add timeline visualization for rating changes/effective dates.
- Add conflict detector when manual entries disagree with scanned outputs.
