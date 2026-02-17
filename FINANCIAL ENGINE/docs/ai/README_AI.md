# AI Layer – Financial Engine

This AI layer sits on top of the core Financial Engine and provides:

- Narrative insights based on:
  - Budget summary
  - Net worth
  - Savings goals
  - Cash-flow and scenarios
  - Global financial health score
- AI-style scenario commentary
- JSON + Markdown outputs for UI and external AI models

The core entry point is:

- logic\ai\ai_insights.ps1

It reads:

- data\dashboard_snapshot.json

and writes:

- data\ai_insights.json
- data\ai_insights.md
