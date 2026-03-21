# Tab 08 Snapshot: Resources

## Primary Function
This tab is the tool launchpad after case synthesis. It routes the reviewer to supporting modules for financial planning, references, state programs, and operational review queues.

## What This Tab Asks For
- No direct data entry.
- Reviewer chooses which support tool to open:
  - Financial Planner
  - Knowledge Base
  - State Benefits
  - Review Queue
  - Scanner Activity
  - Workspace Updates

## Layout and Design Snapshot
```text
Page Header
  [Eyebrow: Resources] [Title: Resources] [Badge: Step 8 tools]

Dashboard Grid of Action Cards
  Card 1: Financial Planner       -> Open Financial Planner
  Card 2: Knowledge Base          -> Open Knowledge Base
  Card 3: State Benefits          -> Open State Benefits
  Card 4: Review Queue            -> Open Review Queue
  Card 5: Scanner Activity        -> Open Scanner Activity
  Card 6: Workspace Updates       -> Open Workspace Updates
```

## Information Produced for Later Tabs
- This tab is primarily a navigation/operations layer rather than a data-capture layer.
- It enables deeper analysis and governance in specialized modules.

## UX and Review Notes
- Clear card-based launcher pattern and low cognitive load.
- Good placement as a post-summary operations stage.
- Review point: add quick status pills on cards (for example pending review count, failed scans count).

## Suggested Additional Improvements
- Add recency badges (last opened, recently updated).
- Add role-based grouping (Reviewer, VSO, Developer).
- Add "recommended next tool" highlight based on workflow state.
