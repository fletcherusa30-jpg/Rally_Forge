# Tab 01 Snapshot: Profile

## Primary Function
The Profile tab is the identity and contact foundation for the whole workflow. It captures veteran identity, contact details, and case notes that are reused by downstream tabs.

## What This Tab Asks For
- Personal Information:
  - First Name
  - Middle Name
  - Last Name
  - Date of Birth
  - Last 4 of SSN
- Contact Information:
  - Email
  - Phone
  - City
  - State
- Case Notes:
  - Timeline note entries (freeform notes with add/delete)

## Layout and Design Snapshot
```text
Page Header
  [Eyebrow: Veteran] [Title: Profile] [Badge: Unsaved changes (conditional)]

Optional Empty-State Card
  "No profile data yet. Click Edit on a section..."

Card 1: Personal Information
  - Section summary row (read mode)
  - Edit mode grid fields
  - Save / Cancel controls

Card 2: Contact Information
  - Section summary row (read mode)
  - Edit mode grid fields
  - Save / Cancel controls

Card 3: Case Notes
  - Timeline list
  - Add note action
  - Delete note action

Sticky Save Bar (conditional)
  [Save All] + Unsaved changes indicator
```

## Information Produced for Later Tabs
- Veteran name and location summary used in carry-forward cards
- Contact references used in review workflows
- Notes context for claim development
- Unsaved-change state for navigation guard behavior

## UX and Review Notes
- Section-based editing model is strong for data integrity and user confidence.
- Per-section machine states (idle/editing/dirty/saving/error) reduce accidental data loss.
- Case Notes timeline is effective for VSO reminders and evidence planning notes.
- Good review point: ensure there is guidance on what should and should not be placed in notes.

## Suggested Additional Improvements
- Add optional preferred contact method (email/phone/text).
- Add profile completeness score shown in header.
- Add optional "representation" field (self, VSO, attorney) to improve handoff context.
