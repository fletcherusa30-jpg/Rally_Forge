# MOS / Rating / AFSC / Designator Audit - 2026-03-16

## Scope

Validated branch datasets used by Military Service tab:

- `knowledge/mos/army.json`
- `knowledge/mos/marine-corps.json`
- `knowledge/mos/navy.json`
- `knowledge/mos/air-force.json`
- `knowledge/mos/space-force.json`
- `knowledge/mos/coast-guard.json`
- `knowledge/mos/noaa.json`
- `knowledge/mos/usphs.json`

## Completed Corrections

1. Added missing Army warrant MOS codes required by project requirements.
2. Ensured required list has zero missing entries and zero duplicates.
3. Hardened DD214 step-one MOS mapping to suppress OCR noise tokens (`SEE`, `ITEM`, `BLOCK`, etc.) that polluted Military Service records.
4. Normalized and deduped Military Service dropdown MOS options by `code + type` so duplicates are not stored/presented.
5. Normalized Navy warrant designator catalog to wildcard CWO notation and added required examples (`711X`, `733X`).
6. Normalized Marine warrant code formatting and added required examples (`0170`, `5804`).
7. Removed duplicate legacy MOS index mirror (`backend/data/mos-index.json`) to enforce single source of truth.

## Army Warrant Completeness Result

Required codes validated present:

- `120A`, `125D`, `131A`, `140A`, `140K`, `140L`, `150A`, `150U`, `151A`
- `152C`, `152D`, `152F`, `152G`, `152H`, `153A`, `154C`
- `170A`, `170B`
- `255A`, `255N`, `255S`, `255Z`
- `350F`, `350G`, `351L`, `351M`, `352N`, `352S`, `353T`
- `890A`
- `913A`, `914A`, `915A`, `919A`
- `920A`, `920B`, `921A`, `922A`
- `948B`, `948D`, `948E`

## Branch/Rank Findings Requiring Follow-On Curation

The dataset is now structurally consistent for filtering, but some catalogs still require deeper authoritative service-manual curation for full-coverage completeness:

1. Space Force catalog is minimal and should be expanded to full enlisted/officer AFSC coverage if full-coverage mode is required.
2. Coast Guard/NOAA/USPHS titles should be validated against latest service publication naming updates.
3. Navy and Marine warrant title strings should be finalized against current service classification manuals.

## New Validation Utility

Added `scripts/validate-mos-catalog.mjs` to enforce:

- Allowed type set (`enlisted`, `warrant`, `officer`)
- Duplicate detection per branch/type
- Required Army warrant code presence

Run:

```bash
node scripts/validate-mos-catalog.mjs
```

## New Folder Source Review

Candidate files in `New folder` that can support future curation:

- `38 CFR Part 3 (up to date as of 3-12-2026).pdf`
- `38 CFR Part 4 (up to date as of 3-12-2026).pdf`
- `Index of DBQs 8-6-25.xlsx`
- `NG-Reserve quick reference.doc`
- `4212166-National Guard power point.pptx`

Most files are policy/training artifacts (PDF/DOC/PPT) and are useful for manual QA and legal rationale, but are not directly machine-ingestable MOS master lists without a curation pass.
