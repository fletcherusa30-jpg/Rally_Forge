# TERA Test Suite

Comprehensive test cases for TERA calculations.

## Files

- `tera_test_cases.json` - 8 test cases covering various scenarios

## Test Coverage

### Valid Scenarios
1. **TERA-001**: E-7 with 15 years (minimum eligibility)
2. **TERA-002**: O-4 with 17 years (mid-range)
3. **TERA-003**: E-8 with 19 years (maximum eligibility)
4. **TERA-004**: O-5 with 18.5 years (fractional years)
5. **TERA-005**: E-9 with 19.75 years (near 20-year mark)
6. **TERA-006**: E-7 with 16 years + SBP and tax deductions

### Invalid Scenarios
7. **TERA-007**: E-6 with 14.42 years (below minimum - should fail)
8. **TERA-008**: E-8 with 20.08 years (exceeds TERA limit - should fail)

## Validation Rules

- `multiplier === years_of_service * 0.025`
- `monthlyPay === high36Average * multiplier`
- `annualPay === monthlyPay * 12`
- `years_of_service >= 15 && years_of_service < 20`
- `sbp_premium === baseCoverage * 0.065`

## Running Tests

Tests can be executed against the TERA calculation engine to verify correct calculation logic.
