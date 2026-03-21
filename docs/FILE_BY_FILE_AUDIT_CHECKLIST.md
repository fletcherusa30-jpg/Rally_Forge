# File-by-File Audit Checklist

For each file, enforce:

1. Schema Compliance
- Validate imported schemas match unified schema contracts.
- Validate required fields are present.
- Validate no unused schema fields are introduced.

2. Engine Integration
- Validate updates dispatch to claimDataUnified.
- Validate listeners support silent update triggers.
- Validate no cross-tab direct reads outside approved unified flow.

3. Normalization
- Validate condition names are normalized.
- Validate exposure names are normalized.
- Validate date formats are normalized.

4. Derived Signals
- Validate derivedSignals contributions when applicable.
- Validate no duplicate signal generation.

5. Condition Generation
- Validate correct inputs to condition engine.
- Validate no local condition generation outside engine.

6. Lay Statement Integration
- Validate no direct lay statement manipulation.
- Validate required template fields are populated.

7. Evidence Index Integration
- Validate evidence snippets are structured.
- Validate evidence entries include source, date, and summary.

8. Timeline Integration
- Validate timeline events include normalized dates.
- Validate timeline event sources are correctly tagged.

9. UI Binding
- Validate components bind to unified dataset.
- Validate no stale local state duplicates global data.

10. Code Quality
- No TODO markers.
- No commented-out code.
- No unused imports.
- No deprecated logic.
- No console logs.
- No dead code paths.
