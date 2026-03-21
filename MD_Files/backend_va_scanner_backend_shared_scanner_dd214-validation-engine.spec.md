# DD-214 Deterministic Validation Engine (v1)

## Purpose
Provide deterministic pass/fail validation passes for DD-214 extraction.

## Validation Passes
1. `blockPresence`
- Required blocks for full confidence: `2`, `11`, `12a`, `12b`, `12c`, `13`, `18`, `25`, `26`, `27`, `28`.
- Fails if missing or unreadable.

2. `dateChronology`
- `12a` must parse as entry date.
- `12b` must parse as separation date.
- `entryDate < separationDate`.

3. `netServiceConsistency`
- `12c` duration should align with date delta within tolerance.

4. `componentFromBlock2`
- Component can only be derived from block 2 explicit tokens (RA/REGULAR/ACTIVE, NG/ARNG/ANG, USAR/USNR/RESERVE etc.).
- Fails if component exists but block 2 has no explicit component signal.

5. `continuationIntegrity`
- If continuation cue exists (`CONT FROM BLOCK 13/18`), merged continuation data must be present.

6. `combatEvidenceExplicit`
- Combat/deployment flags are allowed only from explicit block 13/18 evidence tokens (awards, IDP/HFP, campaign/location text).

## Confidence Rule
- `confidence = 1.0` only when every validation check passes.
- Otherwise confidence is the ratio of passed checks to total checks.
