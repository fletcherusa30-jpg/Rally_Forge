# TERA Calculation Schemas

JSON schemas for TERA retirement calculations.

## Files

- `tera_calculation_schema.json` - Complete JSON schema for TERA calculations

## Schema Structure

### Required Fields
- `serviceMember` - Service member demographics (name, branch, rank, DOB)
- `serviceRecord` - Service history (entry date, retirement date, years of service, high-36)
- `calculation` - Retirement calculation results (multiplier, monthly/annual pay)

### Optional Fields
- `deductions` - SBP, federal tax, state tax withholdings
- `netPay` - Net pay after deductions
- `cola` - Cost of Living Adjustment projections
- `comparison` - Comparison to 20-year retirement
- `metadata` - Calculation metadata and validation status

## Validation Rules

- Years of service: 15.0 - 19.999
- Multiplier: 0.375 - 0.4975 (years × 0.025)
- Paygrade: E-1 through E-9, W-1 through W-5, O-1 through O-10
- Branch: Army, Navy, Air Force, Marine Corps, Space Force, Coast Guard
