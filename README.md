# RATE DATABASE (CLEAN, NO GUESSED VALUES)

This folder defines the no-guess data policy and archival/source artifacts for VA compensation rates.

## Current Runtime Behavior
- Scanner and compensation runtime calculations use `VA SCANNER/engine/rateLoader.js` with data loaded from this folder.
- `VA SCANNER/rates/2026_disability_basic.md` and `VA SCANNER/rates/2026_smc.md` are the authoritative 2026 sources.
- UI percentage display must use percentage-based base amounts (no guessed values, no interpolation).

## Folder Structure
- `YEARS/`           Basic 10–100% compensation by year
- `SMC/`             Special Monthly Compensation by year
- `SMC_DEPENDENTS/`  SMC dependency add-ons by year
- `ANCILLARY/`       Ancillary benefit eligibility structure
- `MODELS/`          TypeScript interfaces
- `MANIFESTS/`       Versioning and data status

## Data Rules
- If a value is unavailable, treat it as missing data (do not infer or guess).
- Any runtime table updates should be traceable back to official VA rate publications.
