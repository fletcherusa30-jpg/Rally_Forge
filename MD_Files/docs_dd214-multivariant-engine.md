# DD-214 Multi-Variant Parsing Engine (vNext)

## Scope
The scanner now supports variant detection and structured analysis for:
- DD214 member copies (Member 1, Member 4, Service, Veterans)
- DD214 continuation sheets
- DD215 correction forms
- NGB22/NGB23 guard-reserve equivalents
- Legacy DD214 identification paths
- Redacted/edited variants

## Pipeline Order
1. OCR correction pass (`dd214OcrCorrection.js`)
2. Variant detection (`dd214VariantModel.js`)
3. Block detection (`dd214BlockDetectionModel.js`)
4. Deterministic extraction (`dd214Scanner.js`)
5. Normalization and analysis schema build (`dd214Analysis/index.js`)
6. Cross-validation flags (`dd214Analysis/crossValidation.js`)

## Output Contract
`dd214Analysis` now emits:
- `identification`
- `serviceDates`
- `separation`
- `rankAndSpecialty`
- `awards`
- `deployments`
- `remarks`
- `crossValidationFlags`
- `confidenceScores`
- `notes`

Safety boundary:
- Human review only.
- No legal advice.
- No eligibility determinations.

## Evidence Graph Mapping
DD214 analysis still supports evidence graph mapping through:
- `DD214ServicePeriod`
- `DD214Deployment`
- `DD214Award`
- `DD214Separation`
- `DD214CharacterOfService`
- `DD214MOS`
- `DD214EligibilityIndicator`
- `DD214CombatIndicator`
- `DD214HazardousDutyIndicator`

## Tests
Variant and schema tests:
- `tests/dd214/dd214-variants.test.js`
