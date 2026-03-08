# ANNUAL VA COLA UPDATE PROCEDURE

## For AI Assistant: Automated Annual Rate Verification

This document provides the exact steps for the AI system to follow **each year (typically October-November)** to update VA disability rates.

### When to Run
- **Trigger**: VA announces Cost of Living Adjustment (COLA) for following year
- **Timing**: Usually October 15 - November 15 each year
- **Implementation**: Within 1 week of official announcement
- **Effective Date**: January 1st of following year

---

## STEP 1: Get Official VA Rates

**Source**: https://www.va.gov/disability/compensation-rates/

Look for the annual COLA announcement. The announcement will include:
- New disability rating amounts (10%, 20%, ... 100%)
- New dependent addition amounts (spouse, child, parent)
- SMC rates (if applicable)
- Effective date (usually January 1st)

**Example format from VA announcement:**
```
2026 Rates (effective January 1, 2026):
- 10%: $171.23
- 20%: $338.49
- 30%: $522.36
- 40%: $727.31
- 50%: $1,031.05
- 60%: $1,304.76
- 70%: $1,808.45
- 80%: $2,093.87
- 90%: $2,355.59
- 100%: $3,823.97

Dependent Additions (effective January 1, 2026):
- Spouse: $156.20
- Child: $52.03
- Parent: $156.20
```

---

## STEP 2: Calculate COLA Factor

**Formula**: 
```
COLA_Factor = (NEW_RATE / PREVIOUS_BASELINE_RATE) - 1
```

**Example for 2027** (assuming previous baseline 2026 was $1,808.45 for 70%):

If VA announces 2027 rate of $1,871.75 for 70%:
```
COLA = ($1,871.75 / $1,808.45) - 1 = 0.0350 = 3.5%
```

Add to `COLA_HISTORY`:
```javascript
2027: 0.035,  // 3.5% VA COLA (verified 2026)
```

---

## STEP 3: Verify All Rates

Create a verification spreadsheet:

| Rating | 2026 Base | 2027 Rate | Calculated (Base × 1.035) | Official | Match? |
|--------|-----------|-----------|---------------------------|----------|--------|
| 10% | 171.23 | 177.22 | 177.22 | 177.22 | ✅ |
| 50% | 1,031.05 | 1,067.14 | 1,067.14 | 1,067.14 | ✅ |
| 70% | 1,808.45 | 1,871.75 | 1,871.75 | 1,871.75 | ✅ |
| 100% | 3,823.97 | 3,957.81 | 3,957.81 | 3,957.81 | ✅ |

If any calculated rate doesn't match official VA rate:
1. Calculate what COLA_HISTORY value should be
2. Check if there was a special adjustment (note it)
3. Use adjusted COLA that matches official rates

---

## STEP 4: Update Code

**File**: `VA SCANNER/engine/rateEscalator.js`

**ACTION**: Update COLA_HISTORY object

```javascript
COLA_HISTORY = {
  2026: 0.00,   // Base year (no change)
  2027: 0.035,  // 3.5% (UPDATE THIS LINE with new COLA)
  2028: 0.030,  // Projected 3.0%
  2029: 0.025,  // Projected 2.5%  
  2030: 0.025   // Projected 2.5%
};
```

**Change to** (example for 2027 announcement):
```javascript
COLA_HISTORY = {
  2026: 0.00,   // Base year
  2027: 0.035,  // 3.5% (VA COLA 2027, verified Nov 2026)
  2028: 0.030,  // Projected 3.0%
  2029: 0.025,  // Projected 2.5%  
  2030: 0.025,  // Projected 2.5%
  2031: 0.025   // ADD next year projection
};
```

---

## STEP 5: Run Verification Tests

```bash
cd "c:\Dev\Rally Forge"

# Run rate escalation test
node tests/test-rate-escalator.js
```

**Expected Output:**
```
TEST 2: Disability Rating Amounts ($)
Rating | 2026 | 2027 | 2028 | 2029 | 2030
  10%    | 171.23 | 177.22 | 182.54 | 187.10 | 191.78
  70%    | 1808.45 | 1871.75 | 1927.90 | 1976.10 | 2025.50
  100%   | 3823.97 | 3957.81 | 4076.54 | 4178.46 | 4282.92
```

**Verify**:
- 2027 amounts match official VA announcement ✅
- Rates increase progressively for future years ✅
- Percentages match COLA history ✅

---

## STEP 6: Run Integration Tests

```bash
# Test dependent extraction still works
node tests/test-dependent-extraction.js
```

**Expected**: All 19 tests pass ✅

```bash
# Test scanner integration
npm test -- tests/test-dependent-extraction.js
```

**Expected**: 19 assertions passed ✅

---

## STEP 7: Verify With Comparison Function

```javascript
// In Node.js console or test file:
import { verifyRates } from './VA SCANNER/engine/rateEscalator.js';

const officialVA2027Rates = {
  '10': 177.22,
  '20': 350.44,
  '30': 540.44,
  '40': 752.56,
  '50': 1067.14,
  '60': 1350.92,
  '70': 1871.75,
  '80': 2167.31,
  '90': 2438.73,
  '100': 3957.81
};

const report = verifyRates(2027, officialVA2027Rates);
console.log(report.status);  // Should be "VERIFIED_CORRECT"
```

If status is not "VERIFIED_CORRECT":
- Check `report.discrepancies` for mismatches
- Recalculate COLA factor
- Update and retest

---

## STEP 8: Update Documentation

**Files to Update**:

1. **This file** (`ANNUAL_COLA_UPDATE.md`)
   - Add new year to schedule
   - Document actual COLA announced vs. projection

2. **DEPENDENT_EXTRACTION_AND_AUTO_RATES.md**
   - Update example calculations with new year
   - Add year to COLA history examples

3. **Backend scanner.js comments**
   - Update year comment if hardcoded anywhere

4. **Frontend rateDisplay component**
   - Verify current year calculation is correct

---

## STEP 9: Deploy Changes

```bash
# Commit code
git add VA_SCANNER/engine/rateEscalator.js
git commit -m "Update VA COLA rates for 2027 (3.5% increase, effective Jan 1, 2027)"

# Push to production
git push origin main
```

**No other changes needed.** All future scans will automatically use 2027 rates starting January 1, 2027.

---

## STEP 10: Document the Update

Create a note in version history:

```markdown
## [VERSION] - 2026-11-15

### VA COLA Update - 2027 Rates

- **COLA Announced**: October 15, 2026
- **Rate Increase**: 3.5% (2027 rates effective January 1, 2027)
- **Verification**: All rates verified against VA.gov official announcement
- **Implementation**: Single-line update to COLA_HISTORY
- **Impact**: All 70% disability ratings now $1,871.75/mo (♦ +$63.30 from 2026)
- **Verification Status**: ✅ PASSED (19 tests, all assertions passing)

### Updated COLA History
```javascript
COLA_HISTORY = {
  2026: 0.00,   // Base
  2027: 0.035,  // 3.5% (verified)
  ... 
}
```

### Testing Performed
- ✅ test-rate-escalator.js: All calculations match official VA rates
- ✅ test-dependent-extraction.js: All 19 assertions passing
- ✅ verifyRates() function: Zero discrepancies

### Impact to End Users
- Existing scanned decisions: Display rates based on scan year (no change)
- New scans after 2027-01-01: Automatically use 2027 rates
- Manual entry: Can select any year, rates auto-calculate

No action required by users. Rates update automatically.
```

---

## QUICK REFERENCE: Complete Update Checklist

**Every Year (Oct-Nov):**
- [ ] VA announces COLA for next year
- [ ] Get official rates from VA.gov
- [ ] Calculate COLA_History value
- [ ] Update `COLA_HISTORY` in rateEscalator.js (1 line)
- [ ] Run `test-rate-escalator.js` and verify
- [ ] Run `test-dependent-extraction.js` and verify
- [ ] Run `verifyRates()` comparison
- [ ] Update documentation
- [ ] Commit and deploy
- [ ] Document in version history
- [ ] Notify users (optional)

**Time Required**: ~30 minutes
**Code Changes**: 1 line
**Risk Level**: Very Low (backwards compatible)
**Verification**: Fully automated via tests

---

## Example: 2027 COLA Update (Complete)

**Scenario**: VA announces 3.5% COLA for 2027

### Official Rates from VA.gov:
```
70%: $1,871.75  (was $1,808.45 in 2026)
Spouse: $161.67 (was $156.20 in 2026)
```

### Calculate COLA:
```
($1,871.75 / $1,808.45) - 1 = 0.035 = 3.5%
```

### Update Code:
```javascript
// Before (in rateEscalator.js):
COLA_HISTORY = {
  2026: 0.00,
  2027: 0.035,  // Projection (placeholder)
  ...
};

// After:
COLA_HISTORY = {
  2026: 0.00,
  2027: 0.035,  // 3.5% COLA (verified Nov 2026) ← ONLY CHANGE
  ...
};
```

### Test:
```bash
$ node tests/test-rate-escalator.js
TEST 2: Disability Rating Amounts ($)
70%    | 1808.45 | 1871.75 | ... ✅
```

### Deploy:
```bash
git commit -m "Update 2027 COLA: 3.5% increase"
git push origin main
```

### Result:
✅ All 2027+ scans automatically use correct rates
✅ No code recompilation needed
✅ Zero user action required
✅ Rates verified against official VA announcement

---

## Troubleshooting Annual Updates

**Q: Calculated rate doesn't match official VA rate?**
1. Recalculate COLA: (Official / Base_2026) - 1
2. Round to 4 decimals: 0.0350
3. Update COLA_HISTORY with recalculated value
4. Rerun tests
5. If still mismatch: Check if there was special adjustment from VA

**Q: How do I know which COLA to update?**
- Update the COLA for the NEXT year (year+1)
- If it's November 2026 and VA announces 2027 rates: Update 2027 COLA
- Not the current year COLA (2026 is locked at 0.00)

**Q: Should I update projected rates for future years?**
- Optional: VA sometimes provides guidance for 2-3 years ahead
- If in doubt: Update only the year announced
- Otherwise: Use projections (2.5-3.5% typical) as placeholders
- Update them as soon as official announcement comes

**Q: What if VA announces different rates on different dates?**
- Use the official announcement date as the reference
- All rates effective same date: Use that as baseline
- Double-check all components (disability, dependents, SMC) are from same official announcement

**Q: Does this affect old scanned decisions?**
- No! Old scans use rates from their scan date
- New scans use current-year rates
- This is intentional: maintains historical accuracy

**Q: How do I manually verify a specific rate?**
```javascript
import { getDisabilityAmount } from './rateEscalator.js';

// Check if 70% in 2027 matches official
const calculated = getDisabilityAmount('70', 2027);  // Should be 1871.75
console.log(calculated);  // 1871.75 ✅
```

---

## Security Note

Only update COLA_HISTORY after:
1. Official VA.gov announcement confirmed
2. Multiple official sources verify same rates
3. All tests pass with new rates
4. Documentation updated

DO NOT:
- Update based on rumors or unofficial sources
- Use rounded estimates instead of official figures
- Skip testing before deployment

---

## End of Annual Update Procedure

Next review: October 2027 (when VA announces 2028 COLA)

**Questions?** See `DEPENDENT_EXTRACTION_AND_AUTO_RATES.md` for detailed system documentation.
