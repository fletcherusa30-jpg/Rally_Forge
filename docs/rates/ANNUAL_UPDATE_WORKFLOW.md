# Annual VA Compensation Rate Update Workflow

## Overview

This document provides a step-by-step checklist for updating Rally Forge with the latest VA disability compensation rates when they are published annually (typically December with January 1 effective date).

## Timeline

The VA typically publishes new compensation rates in early December for the following calendar year, based on the Cost-of-Living Adjustment (COLA).

**Key Dates:**
- **Early December**: VA announces new rates
- **December 1**: New rates published to VA.gov
- **January 1**: New rates become effective

**Update Window**: Mid-December (after VA publishes, before January 1)

---

## Pre-Update Preparation

### ☐ 1. Monitor for Rate Announcement

- Check VA's official rate table page: https://www.va.gov/disability/compensation-rates/veteran-rates/
- Monitor VA news releases: https://news.va.gov/
- Set calendar reminder for early December

### ☐ 2. Create Update Branch

```bash
git checkout main
git pull origin main
git checkout -b update/va-rates-[YEAR]
```

Example: `update/va-rates-2027`

---

## Update Process

### ☐ 3. Update Compensation Engine Rates

**Location**: `compensation-engine/rates/[YEAR].json`

**Steps:**

1. Create new rate file for the year:

```bash
cp compensation-engine/rates/2026.json compensation-engine/rates/2027.json
```

2. Update the following fields in the new file:
   - `year`: Set to new year (e.g., 2027)
   - `effective_date`: Set to January 1 of new year (e.g., "2027-01-01")
   - `version`: Reset to "1.0.0"
   - `_notes`: Update to reflect new year

3. Update rate values based on official VA publication:

   **Base Compensation** (`baseCompensation`):
   - 10% through 100% disability ratings
   - Verify all 11 rating levels (0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100)

   **Dependent Rates** (`dependents`):
   - `spouse.first_child`
   - `spouse.each_additional_child`
   - `spouse.first_parent`
   - `spouse.each_additional_parent`
   - `no_spouse.first_child`
   - `no_spouse.each_additional_child`
   - `no_spouse.first_parent`
   - `no_spouse.each_additional_parent`

   **SMC Codes** (`smc`):
   - Update all SMC code amounts (K through T)
   - Verify descriptions and CFR references remain accurate

   **Ancillary Benefits** (`ancillary`):
   - Aid and Attendance monthly amount
   - Housebound monthly amount

4. **Save and format** the JSON file (ensure proper indentation, UTF-8 encoding)

### ☐ 4. Update RATE DATABASE

**Location**: `RATE DATABASE/YEARS/[YEAR].json`

**Steps:**

1. Create new YEAR file:

```bash
cp "RATE DATABASE/YEARS/2026.json" "RATE DATABASE/YEARS/2027.json"
```

2. Update the file structure:
   - `year`: Set to new year
   - `effective_date`: Set to "YYYY-01-01"
   - `data_status`: Keep as "UNPOPULATED" (or "POPULATED" if fully verified)
   - `source`: Update to current VA.gov URL with effective date

3. Update `ratings` object for each rating level (10-100):
   - `veteran`: Base rate from VA table
   - Set dependent fields to `null` if not yet verified, or populate from official table

4. Populate `smc` and `ancillary` sections (or leave null if unverified)

### ☐ 5. Update RATE DATABASE Manifest

**Location**: `RATE DATABASE/MANIFESTS/rate-database-manifest.json`

**Steps:**

1. Open the manifest file
2. Add new year to the `years` array: `[..., 2027]`
3. If rates are fully verified, update `data_status` to `"POPULATED"`
4. Update `last_updated` timestamp: `"YYYY-MM-DD"`

**Before:**
```json
{
  "years": [1950, 1951, ..., 2025, 2026],
  "data_status": "UNPOPULATED",
  "last_updated": "2026-02-20"
}
```

**After:**
```json
{
  "years": [1950, 1951, ..., 2025, 2026, 2027],
  "data_status": "UNPOPULATED",
  "last_updated": "2026-12-15"
}
```

---

## Validation

### ☐ 6. Run RATE DATABASE Validator

```bash
npm run validate:rate-database
```

**Expected Output:**
- ✅ Manifest includes new year
- ✅ YEAR JSON file exists for new year
- ✅ Engine overlap years include new year
- ✅ No errors

**If warnings appear:**
- Acceptable if `data_status: UNPOPULATED` (null values allowed)
- Must resolve all warnings if `data_status: POPULATED`

### ☐ 7. Run Strict Validation (for CI/Release)

```bash
npm run validate:rate-database:strict
```

**Expected Behavior:**
- May fail if `data_status: UNPOPULATED` (warnings treated as errors)
- Must pass if `data_status: POPULATED`

### ☐ 8. Run Compensation Regression Tests

```bash
npm run test:compensation
```

**Action Required:**
Update test file `backend/tests/compensation-regression.test.js`:

1. Add expected values for new year:

```javascript
const EXPECTED_2027_RATING_MONTHLY = {
  10: [VALUE],
  20: [VALUE],
  // ... all ratings 10-100
  100: [VALUE]
};
```

2. Add new test suite:

```javascript
describe('2027 Base Compensation Rates', () => {
  for (const [rating, expectedAmount] of Object.entries(EXPECTED_2027_RATING_MONTHLY)) {
    it(`should return correct ratingMonthly for ${rating}% in 2027`, () => {
      const quote = CompensationEngine.calculateVeteranCompensation({
        rating: Number(rating),
        effectiveDate: '2027-01-01',
        dependents: { spouse: 0, children: 0, parents: 0 }
      });

      const actualAmount = quote.breakdown.baseMonthly;
      
      assert.ok(
        Math.abs(actualAmount - expectedAmount) < 0.01,
        `Expected ${rating}% to return $${expectedAmount}, but got $${actualAmount}`
      );
    });
  }
});
```

3. Run tests again to verify

### ☐ 9. Run Dependent Calculation Tests

```bash
npm run test:dependents
```

**Action Required (if dependent rates changed):**

Update `DEPENDENT_RATES_2026` to `DEPENDENT_RATES_2027` in `backend/tests/dependent-calculation.test.js` with new year's rates.

### ☐ 10. Run Full Test Suite

```bash
npm test
```

**Expected**: All tests pass ✅

---

## Manual Verification

### ☐ 11. Test Live Calculations

**Using Browser Console or Node REPL:**

```javascript
import CompensationEngine from './compensation-engine/index.js';

// Test 100% rating for new year
const result = CompensationEngine.calculateVeteranCompensation({
  rating: 100,
  effectiveDate: '2027-01-01',
  dependents: { spouse: 0, children: 0, parents: 0 }
});

console.log(result.breakdown.baseMonthly); // Should match VA.gov published rate
```

**Verify Against Official Source:**
- Navigate to https://www.va.gov/disability/compensation-rates/veteran-rates/
- Compare displayed values with engine output
- Test at least: 10%, 30%, 50%, 70%, 100%

### ☐ 12. Test with Dependents

```javascript
// Test 70% with 2 children + 1 parent (spouse tier)
const withDependents = CompensationEngine.calculateVeteranCompensation({
  rating: 70,
  effectiveDate: '2027-01-01',
  dependents: { spouse: 1, children: 2, parents: 1 }
});

console.log(withDependents.summary.totalMonthly);
```

Manually verify:
- Base = 70% rate
- Dependents = first_child + additional_child + first_parent
- Total = Base + Dependents

### ☐ 13. Test Year Boundaries

```javascript
// Ensure 2026 rates still work
const dec2026 = CompensationEngine.calculateVeteranCompensation({
  rating: 100,
  effectiveDate: '2026-12-31',
  dependents: { spouse: 0, children: 0, parents: 0 }
});

// Ensure 2027 rates activate on Jan 1
const jan2027 = CompensationEngine.calculateVeteranCompensation({
  rating: 100,
  effectiveDate: '2027-01-01',
  dependents: { spouse: 0, children: 0, parents: 0 }
});

console.log('2026-12-31:', dec2026.breakdown.baseMonthly); // Should be 2026 rate
console.log('2027-01-01:', jan2027.breakdown.baseMonthly); // Should be 2027 rate
```

---

## Documentation Updates

### ☐ 14. Update Status Documentation

**File**: `RATE DATABASE/CURRENT_STATUS_AND_OPERATION.md`

1. Update "Runtime Verification" section with new year examples
2. Add new year to "Source of Truth" references
3. Update any year-specific examples

### ☐ 15. Update README Files

**Update these files if they reference specific years:**

- `RATE DATABASE/README.md`
- `compensation-engine/README.md` (if exists)
- Root `README.md` (if compensation rates mentioned)

---

## Commit and Release

### ☐ 16. Commit Changes

```bash
git add .
git commit -m "Update VA compensation rates for [YEAR]

- Added [YEAR] rate table to compensation-engine
- Added [YEAR] to RATE DATABASE
- Updated manifest with new year
- Updated regression tests with [YEAR] expected values
- Verified all tests pass
- Validated against official VA.gov rates

Source: https://www.va.gov/disability/compensation-rates/veteran-rates/
Effective Date: [YEAR]-01-01"
```

### ☐ 17. Push and Create Pull Request

```bash
git push origin update/va-rates-[YEAR]
```

**PR Checklist:**
- ✅ All tests pass
- ✅ Validator passes (or expected warnings documented)
- ✅ Manual verification completed
- ✅ Documentation updated
- ✅ Rate source documented in commit message

### ☐ 18. Code Review

**Reviewer should verify:**
- [ ] Rates match official VA.gov publication
- [ ] All rating levels (10-100) updated
- [ ] Dependent rates updated (both tiers)
- [ ] SMC codes updated
- [ ] Ancillary benefits updated
- [ ] Tests updated and passing
- [ ] JSON files valid (no syntax errors)
- [ ] Year boundaries tested

### ☐ 19. Deploy to Production

**Pre-deployment:**
```bash
# Run full validation in strict mode
npm run validate:rate-database:strict

# Run all tests
npm test

# Build application
npm run build
```

**Deployment:**
- Merge PR to main
- Tag release: `git tag -a v[VERSION] -m "VA rates update [YEAR]"`
- Push tags: `git push origin --tags`
- Deploy to production environment

### ☐ 20. Post-Deployment Verification

**In Production:**
1. Navigate to compensation calculator
2. Set effective date to January 1, [YEAR]
3. Test sample ratings: 30%, 50%, 70%, 100%
4. Compare results with VA.gov
5. Test with dependent profiles
6. Verify no errors in console or logs

---

## Checklist Summary

**Preparation:**
- [ ] Monitored for VA rate announcement
- [ ] Created update branch

**Updates:**
- [ ] Updated compensation-engine rates file
- [ ] Updated RATE DATABASE YEAR file
- [ ] Updated RATE DATABASE manifest

**Validation:**
- [ ] Ran validator (standard)
- [ ] Ran validator (strict mode)
- [ ] Updated and ran regression tests
- [ ] Updated and ran dependent tests
- [ ] Ran full test suite

**Manual Verification:**
- [ ] Tested live calculations
- [ ] Tested with dependents
- [ ] Tested year boundaries

**Documentation:**
- [ ] Updated status documentation
- [ ] Updated README files

**Release:**
- [ ] Committed changes with descriptive message
- [ ] Created pull request
- [ ] Code review completed
- [ ] Deployed to production
- [ ] Post-deployment verification

---

## Troubleshooting

### Validator Fails with "Missing YEAR file"

**Solution**: Ensure file exists at `RATE DATABASE/YEARS/[YEAR].json` and is listed in manifest

### Tests Fail with Rate Mismatch

**Solution**: 
1. Verify rates in `compensation-engine/rates/[YEAR].json` match VA.gov
2. Update test expected values in `backend/tests/compensation-regression.test.js`

### Year Selector Uses Wrong Year

**Solution**: Check `effective_date` in rate file and `year` field match the intended year

### Strict Validation Fails

**Solution**: 
- If `data_status: UNPOPULATED`, this is expected (warnings treated as errors)
- If `data_status: POPULATED`, fix null values or rate mismatches

---

## Contact & Resources

**Official VA Rate Tables:**
- https://www.va.gov/disability/compensation-rates/veteran-rates/
- https://www.va.gov/disability/compensation-rates/veteran-rates-with-dependents/

**Internal Documentation:**
- `RATE DATABASE/CURRENT_STATUS_AND_OPERATION.md`
- `RATE DATABASE/README.md`
- `RATE DATABASE.md`

**Support:**
- For rate database questions: See RATE DATABASE docs
- For compensation engine questions: See `compensation-engine/` code comments
- For test failures: Run `npm test` with verbose output

---

**Last Updated**: February 28, 2026  
**Next Update Due**: December 2026 (for 2027 rates)
