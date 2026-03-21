# Tab 06 Snapshot: Analyzer

## Primary Function
Analyzer is the cross-tab synthesis engine. It correlates service, STR, treatment, and VA decision data to surface filing readiness, evidence gaps, secondary-service-connection candidates, exposure risk context, and DBQ/CFR relevance.

## What This Tab Asks For
- No primary raw-document upload here.
- User interaction inputs:
  - Secondary match mode (Conservative/Balanced/Aggressive)
  - Trigger scanner output detection
  - Exposure selection adjustments per service record
  - Condition selection for detail drill-down

## Layout and Design Snapshot
```text
Carry Forward Card (Steps 1-5)

Card: Cross-Tab Claim Synthesis
  - Secondary match mode controls
  - Scanner output detection console
  - KPI metric tiles
  - Suggested analyzer focus panel
  - Cross-referenced signal panel
  - Exposure and DBQ correlation section
  - Condition cards grid
  - Selected condition detail panel
  - Analyzer recommendations list
```

## Information Produced for Later Tabs
- Condition-level readiness states and reasons
- Evidence gaps and recommended paths
- Secondary connection candidate suggestions
- Analyzer summary used by case summary export/reporting

## UX and Review Notes
- High analytical density, strong for expert review workflows.
- "Detect Scanner Outputs" is a practical diagnostics step before synthesis.
- Review point: user may need a novice mode with fewer metrics and clearer prioritization.

## Suggested Additional Improvements
- Add priority queue ranking (Top 5 actions by impact).
- Add "why this recommendation" expandable explainability traces.
- Add saved analyst presets per claim type.
