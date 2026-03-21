# Copilot Enforcement Contract

## 1. Copilot Must Obey the Unified Schema
- All generated code must reference the unified schema.
- No schema drift is allowed.

## 2. Copilot Must Use the Global Engine
- All logic must be routed through conditionGenerator.
- All logic must be routed through derivedSignals.
- All logic must be routed through layStatement.
- All logic must be routed through evidenceIndex.
- All logic must be routed through timelineBuilder.

## 3. Copilot Must Maintain Determinism
- No random values.
- No non-deterministic ordering.
- No hidden state.

## 4. Copilot Must Maintain Silent Background Behavior
- All updates must be silent.
- No UI interruptions.
- No manual sync steps.

## 5. Copilot Must Not Duplicate Logic
- No condition generation in tabs.
- No derived signals in components.
- No lay statement logic outside the engine.

## 6. Copilot Must Enforce Normalization
- All condition names normalized.
- All exposures normalized.
- All dates normalized.

## 7. Copilot Must Enforce Test Coverage
- All generated code must include tests.
- All engines must maintain full coverage.
- All tabs must maintain integration coverage.

## 8. Copilot Must Enforce Modernization Standards
- No deprecated patterns.
- No unused imports.
- No commented-out code.
- No TODOs.

## 9. Copilot Must Respect Component Boundaries
- Tabs = UI only.
- Engines = logic only.
- State = storage only.
- Utils = pure functions only.

## 10. Copilot Must Maintain Repository Integrity
- No breaking changes without schema updates.
- No new files without directory compliance.
- No logic outside approved modules.
