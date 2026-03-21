# Repository-Wide Modernization Plan

## 1. Standardize Directory Structure
- /src/state/
- /src/engine/
- /src/tabs/
- /src/components/
- /src/utils/
- /src/schemas/
- /src/tests/
- /src/constants/

## 2. Enforce Unified Schema
- All tabs must import the unified schema.
- All engines must write to claimDataUnified.
- No local schemas allowed.

## 3. Enforce Silent Background Engine
- All tabs must dispatch updates to the global engine.
- No tab may compute conditions locally.
- No tab may compute derived signals locally.

## 4. Normalize All Data Paths
- All condition names normalized.
- All exposure names normalized.
- All dates normalized.
- All evidence entries normalized.

## 5. Remove Deprecated Logic
- Remove legacy extraction code.
- Remove unused reducers.
- Remove unused components.
- Remove duplicate utilities.

## 6. Enforce Deterministic Behavior
- No randomization.
- No non-deterministic ordering.
- No race conditions in state updates.

## 7. Enforce Component Boundaries
- Tabs: UI only.
- Engines: logic only.
- State: storage only.
- Utils: pure functions only.

## 8. Enforce Test Coverage
- All files must have test coverage.
- All engines must have full coverage.
- All tabs must have integration tests.

## 9. Enforce Documentation
- Each engine must include a header block describing purpose, inputs, outputs, and trigger conditions.
