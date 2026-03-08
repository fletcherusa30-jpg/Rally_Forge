# RATE DATABASE — Current Status and Operation

## Purpose
This module is intended to return the **correct VA compensation amount based on combined disability percentage**, using deterministic in-repo data (no runtime external calls and no guessed values).

## Current Source of Truth
The app now uses `VA SCANNER/engine/rateLoader.js` to load rates from:
- `VA SCANNER/rates/2026_disability_basic.md`
- `VA SCANNER/rates/2026_smc.md`

These files are the authoritative runtime source for scanner and compensation endpoints.

## What the UI Shows Now
In the VA Rating Decision results card (`VARatingDecisionPage`), the displayed "Current Total: $X/mo" resolves to:
1. `decision.compensation.breakdown.totalMonthly` (scanner-calculated amount), or
2. `POST /api/compensation/quote` / `GET /api/compensation?rating=<percent>` fallback from authoritative rate loader data.

Ancillary amounts are now strict explicit grants only; they are not inferred from SMC legends/lists or generic eligibility text.

## Operational Flow
1. Scanner extracts combined rating from document.
2. Backend scanner route computes compensation via `rateLoader` (base + explicit SMC + explicit ancillary only).
3. Frontend displays scanner compensation when present.
4. Fallback compensation endpoints return values from `rateLoader` for consistency.

## API Contract (Current)
`GET /api/compensation?rating=100`

Returns fields including:
- `ratingMonthly` → base percentage amount used by rating display
- `baseMonthly`
- `dependentMonthly`
- `smcMonthly`
- `ancillaryMonthly`
- `totalMonthly`
- `totalYearly`

### Important Distinction
- `ratingMonthly` / `baseMonthly` = percentage-based amount
- `totalMonthly` = base + dependent + SMC + ancillary components

For percentage-only display, use `ratingMonthly`.

## Data Integrity Status
### Completed
- Removed hardcoded fallback map for rating display.
- Removed scanner auto-SMC contribution from displayed current rating amount.
- Aligned 2024–2026 base rates to RATE DATABASE values.
- Enforced percentage-based display path in UI.

### Remaining/Next Hardening
- Add automated regression tests asserting `ratingMonthly` equals expected values for 10–100 ratings.
- Expand dependency-tier validation tests so dependent calculations are explicit and reproducible.
- Add annual data update checklist when adding new year tables.

## Non-Guessing Guarantee (Current Intention)
The system is intended to return amounts from static local rate tables only. If a value cannot be resolved from table data, it should fail clearly instead of estimating.

## Verification Quick Checks
- 100% base monthly should resolve to `3938.58`.
- 100% with no explicit ancillary should keep `ancillaryMonthly = 0`.
- UI must not show `+$171.00` unless Aid & Attendance is explicitly granted.

## Last Updated
- Date: 2026-03-01
- Scope: Authoritative rate-loader integration and strict ancillary gating
