# VA Combined Rating Engine - CFR Compliance Documentation

## ⚖️ Legal Requirements

This implementation MUST comply with:
- **38 CFR § 4.25** - Combined ratings table
- **38 CFR § 4.26** - Bilateral factor

## 🔒 Critical Implementation Rules

### § 4.25: VA Math Formula

```
Combined = A + (100 - A) × (B / 100)
```

**REQUIRED BEHAVIOR:**
1. Sort compensable ratings from highest to lowest
2. Start with highest rating as A
3. For each subsequent rating B:
   - Calculate: `exact = A + (100 - A) × (B / 100)`
   - **ROUND to nearest whole number** (NOT floor, NOT truncate)
   - Use rounded result as new A for next step
4. Final result is raw combined rating
5. Round raw combined to nearest 10 for final combined rating
   - Values ending in 5 round UP (85→90, 95→100)

**PROHIBITED BEHAVIOR:**
- ❌ Flooring at each step
- ❌ Truncating at each step
- ❌ Keeping exact decimals through all steps
- ❌ Using pre-computed lookup tables that floor values

### § 4.26: Bilateral Factor

**REQUIRED BEHAVIOR:**
1. Applies ONLY when BOTH sides of paired extremity have compensable ratings (>0%)
2. Upper extremity: shoulder, arm, elbow, wrist, hand, upper extremity radiculopathy
3. Lower extremity: hip, knee, leg, ankle, foot, lower extremity radiculopathy
4. Procedure:
   - Combine all bilateral ratings for a body group using § 4.25
   - **ROUND** result to nearest whole number
   - Compute 10% of that rounded value
   - **ROUND** the 10% to nearest whole number
   - **ADD** (not combine) the 10% to the combined value
   - Treat result as single disability for further combination

**PROHIBITED BEHAVIOR:**
- ❌ Flooring bilateral combined or bilateral factor
- ❌ Applying to non-extremity conditions
- ❌ Applying when only one side is affected
- ❌ Applying the factor more than once to same disabilities

## 📊 Test Suite

### CFR Compliance Tests
Location: `tests/combined_rating/cfr_compliance.test.js`

**Critical Test Cases:**
1. **Real VA Letter Validation** - Tests actual 2017 decision letter that produces 95% → 100%
2. **Rounding vs Flooring** - Proves rounding at each step is required
3. **Rounding to Nearest 10** - Validates final rounding rules
4. **Edge Cases** - Zero ratings, single rating, maximum caps
5. **Determinism** - Same input always produces same output

### Running Tests
```bash
node --test tests/combined_rating/cfr_compliance.test.js
node --test tests/combined_rating/va_combined_rating.test.js
```

## 🎯 Example Calculation

**Input:** 50%, 20%, 20%, 20%, 20%, 10%, 10%, 10%, 10%

**Step-by-step (§ 4.25):**
1. Start: 50%
2. Combine 50 + 20: `50 + (100-50)×0.20 = 60.00` → **60%**
3. Combine 60 + 20: `60 + (100-60)×0.20 = 68.00` → **68%**
4. Combine 68 + 20: `68 + (100-68)×0.20 = 74.40` → **74%**
5. Combine 74 + 20: `74 + (100-74)×0.20 = 79.20` → **79%**
6. Combine 79 + 10: `79 + (100-79)×0.10 = 81.10` → **81%**
7. Combine 81 + 10: `81 + (100-81)×0.10 = 82.90` → **83%**
8. Combine 83 + 10: `83 + (100-83)×0.10 = 84.70` → **85%**
9. Combine 85 + 10: `85 + (100-85)×0.10 = 86.50` → **87%**

**Result:**
- **Raw combined:** 87%
- **Final combined (rounded to nearest 10):** 90%

## 🛡️ Protection Against Regression

The code includes:
1. **Comprehensive documentation** in function comments citing CFR sections
2. **Explicit warnings** against changing rounding behavior
3. **Test suite** that validates exact CFR compliance
4. **Real-world validation** using actual VA decision letters

**Before modifying VA math code:**
1. Consult 38 CFR § 4.25 and § 4.26
2. Run full test suite: `node --test tests/combined_rating/`
3. Validate against real VA decision letters
4. Document CFR justification for any changes

## 📚 References

- [38 CFR § 4.25 - Combined ratings table](https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-A/section-4.25)
- [38 CFR § 4.26 - Bilateral factor](https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-A/section-4.26)
- VA M21-1 Adjudication Procedures Manual

## ⚠️ CRITICAL WARNING

**DO NOT:**
- Change rounding to flooring or truncation
- Remove rounding at intermediate steps
- Use lookup tables that don't round at each step
- Skip bilateral factor when applicable
- Apply bilateral factor to non-extremity conditions

**These changes would violate CFR and produce incorrect ratings.**
