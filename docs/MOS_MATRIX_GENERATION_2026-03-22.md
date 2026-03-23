# MOS/AFSC/Rating Generation Update (2026-03-22)

## Scope Completed

- Extended branch registries with missing requested Coast Guard, Navy, and Army warrant specialties.
- Regenerated analyzer MOS index from updated branch catalogs.
- Generated normalized branch export files for:
  - Army
  - Marine Corps (USMC)
  - Navy
  - Air Force (USAF)
  - Space Force (USSF)
  - Coast Guard (USCG)
- Generated cross-branch equivalency matrices:
  - USMC matrix
  - DoD-wide matrix
- Generated exposure matrices for all six branches.

## Generated Files

- `knowledge/mos/generated/army-mos.json`
- `knowledge/mos/generated/usmc-mos.json`
- `knowledge/mos/generated/navy-mos.json`
- `knowledge/mos/generated/usaf-afsc.json`
- `knowledge/mos/generated/ussf-afsc.json`
- `knowledge/mos/generated/uscg-ratings.json`
- `knowledge/mos/generated/usmc-cross-branch-matrix.json`
- `knowledge/mos/generated/dod-cross-branch-matrix.json`
- `knowledge/mos/generated/army-exposure-matrix.json`
- `knowledge/mos/generated/usmc-exposure-matrix.json`
- `knowledge/mos/generated/navy-exposure-matrix.json`
- `knowledge/mos/generated/usaf-exposure-matrix.json`
- `knowledge/mos/generated/ussf-exposure-matrix.json`
- `knowledge/mos/generated/uscg-exposure-matrix.json`

## Source Files Updated

- `knowledge/mos/army.json`
- `knowledge/mos/navy.json`
- `knowledge/mos/coast-guard.json`
- `knowledge/mos/cross-branch-equivalents.json`
- `knowledge/mos/mos.schema.json`
- `knowledge/analyzer/analyzer-index.json`

## Validation Performed

- JSON parse checks for all updated source files and all generated files.
- Duplicate check by `(code,type)` for all branch source files.
- Pattern acceptance checks for newly added code formats.
- Matrix shape validation for required JSON structures.

## Notes and Constraints

- Cross-branch equivalencies are only populated where documented mappings exist in repository data.
- Entries without a documented doctrinal equivalent are represented as empty arrays.
- Exposure matrices use existing categories and assign baseline values where branch-specific hazards were not explicitly defined in source data.
