# Dependent Rate Calculation Guide

## Overview

Rally Forge calculates VA disability compensation based on official VA rate tables. Dependent compensation varies by rating level and dependent type/tier. This guide explains how dependent rates are determined and why they appear the way they do in the UI.

---

## Key Principles

1. **No Hardcoded Rates**: Dependent rates are never hardcoded in the UI or extracted from documents
2. **Rate Table Driven**: All calculations use official VA rate tables from `compensation-engine/rates/{year}.json`
3. **Tier-Based System**: Dependent rates vary depending on:
   - **Rating** (10%, 20%, ..., 100%)
   - **Type** (Spouse, Child, Parent)
   - **Tier** (Spouse present vs. Spouse absent)
4. **Bundled Rates**: When spouse + children are present, VA uses pre-bundled rates (not base + individual bonuses)

---

## 2026 Rate Examples (70% Rating)

### Base Rates
```
Veteran alone:          $1,716.28/month
With spouse:            $1,861.28/month   (difference: $145.00)
With spouse + 1 child:  $1,944.28/month   (includes first child)
```

### Dependent Tiers (Added Beyond Base)
```
Spouse Tier (spouse benefits included in base above):
  • First child:        $83/month
  • Each additional:    $83/month
  • First parent:       $125/month
  • Each additional:    $125/month

No-Spouse Tier (veteran alone):
  • First child:        $62/month
  • Each additional:    $62/month
  • First parent:       $125/month
  • Each additional:    $125/month
```

---

## How the System Works

### 1. Document Extraction
When a VA decision PDF is scanned:
- ✅ Dependent **names** and **types** are extracted
- ✅ Effective dates and removal dates are captured
- ❌ Monthly amounts are **NOT** extracted (unreliable in documents)

**File:** `Scanner/VA SCANNER/frontend/utils/extractDependents.js`

### 2. Compensation Calculation
The compensation engine calculates benefits using the compensation quote endpoint:

```javascript
POST /api/compensation/quote
{
  rating: 70,
  dependents: {
    spouse: 1,
    children: 3,
    parents: 0
  },
  effectiveDate: "2026-01-01"
}
```

**File:** `compensation-engine/index.js`

**Return Value:**
```json
{
  "breakdown": {
    "baseMonthly": 1944.28,   // Bundled rate (spouse + 1st child)
    "dependentMonthly": 166,   // Bonus for 2nd and 3rd children
    "totalMonthly": 2110.28,   // Base + bonus
    "totalYearly": 25323.36
  }
}
```

### 3. UI Display
The UI shows:
- ✅ Dependent names and types
- ✅ "Included in base rate" for spouse
- ✅ Blank/empty for children (rates embedded in total)
- ✅ **Helpful tooltip**: "Dependent rates vary by rating and tier. See 'Total Monthly' below."
- ✅ Total monthly compensation breakdown

**Files:**
- `app/frontend-modern/src/pages/ScannerHub.jsx`
- `app/frontend-modern/src/pages/VARatingDecisionPage.jsx`

---

## Why Rates Aren't Displayed Per-Dependent

### Problem Solved
Previously, the system tried to extract monthly amounts from documents, which led to errors:
```
❌ WRONG: "$3,261.10/mo" per child
  (This was actually the total payment, not per-dependent rate)
```

### Solution
Rates now come from the rate calculation engine which understands:
- Total dependent count
- Whether spouse is present
- Appropriate tier to apply
- Correct bonus calculations

Result: Users see accurate compensation combined with dependent names.

---

## Dependent Rate Rules

### Spouse Effects
- **With spouse**: Rates are HIGHER (bundled benefit)
- **Without spouse**: Rates are LOWER (separate calculation)
- Spouse itself doesn't show a rate (included in base)

### Child Tiers
- **First child**: Unique rate (bundled into "spouse+children" rate)
- **Additional children**: Same rate as first

Example (70% rating, with spouse):
```
Base:                  $1,716.28
Spouse addition:       $145.00    (bundled)
First child:           $83.00     (bundled with spouse)
Second child:          $83.00     (additional)
Third child:           $83.00     (additional)
─────────────────────────────────
Total:                 $2,110.28
```

### Parent Tiers
- Same rate whether first or additional
- Applied regardless of children present
- Tier varies by spouse status

---

## Code Architecture

### Rate Table Structure (`compensation-engine/rates/2026.json`)
```json
{
  "baseCompensation": {
    "70": 1716.28
  },
  "withSpouseRates": {
    "70": 1861.28
  },
  "withSpouseAndOneChildRates": {
    "70": 1944.28
  },
  "dependents": {
    "spouse": {
      "first_child": 83,
      "each_additional_child": 83,
      "first_parent": 125,
      "each_additional_parent": 125
    },
    "no_spouse": {
      "first_child": 62,
      "each_additional_child": 62,
      "first_parent": 125,
      "each_additional_parent": 125
    }
  }
}
```

### Calculation Flow

```
1. User uploads VA decision PDF
   ↓
2. Scanner extracts: Rating (70%), Spouse (yes), Children (3)
   ↓
3. Backend calls compensation engine:
   - Gets baseCompensation[70] = $1,716.28
   - Gets withSpouseAndOneChildRates[70] = $1,944.28 (uses this as base)
   - Adds: 2 additional children × $83 = $166
   ↓
4. Total = $1,944.28 + $166 = $2,110.28
   ↓
5. UI displays:
   - Dependents: Spouse (Included in base rate)
   - Dependents: Child—Name 1
   - Dependents: Child—Name 2
   - Dependents: Child—Name 3
   - [Tooltip about rates]
   - Total Monthly: $2,110.28
```

---

## Rate Updates & Maintenance

### When VA Rates Change (Annual COLA)
1. Update `compensation-engine/rates/{year}.json` with new values
2. Verify values match official VA table
3. Run regression tests: `npm run test:compensation`
4. Run dependent tests: `npm run test:dependents`

### Source of Truth
- **Authoritative**: `compensation-engine/rates/{year}.json`
- **Reference**: `knowledge/RATE_DATABASE/YEARS/{year}.json`
- **UI Data**: Uses calculation engine (never hardcoded)

### Testing Changes
```bash
# Verify all rates are correct
npm run test:compensation  # 28 tests

# Verify all dependent combinations work
npm run test:dependents    # 15 tests
```

---

## Common Questions

**Q: Why don't we see per-dependent amounts?**  
A: Rates aren't fixed per-dependent. The system calculates based on total configuration (rating, spouse status, child count). The bundled rates are more accurate than trying to allocate individual bonuses.

**Q: What if a dependent is removed?"**  
A: The system tracks removal dates and recalculates benefits. The dependent stays in the "Dependents" list (historical), but compensation adjustments show the new monthly amount after removal.

**Q: How do we know the rates are correct?**  
A: All rates come from official VA publications and are verified against the official VA rate tables. The test suite validates all 10-100% rating levels match expected values.

**Q: Can I look up the rate for a specific dependent?**  
A: No. Dependent rates always depend on the total configuration. Use the compensation breakdown shown in the UI, which reflects the correct calculation.

---

## References

- **VA Disability Compensation Rates**: 38 U.S.C. § 1114
- **Special Monthly Compensation**: 38 CFR 3.350
- **Rate Table Source**: Official VA VARO publications
- **Code References**:
  - `compensation-engine/index.js` - Calculation engine
  - `backend/api/scanner.js` - Compensation API
  - `backend/services/dependentCompensationEngine.js` - Timeline calculations

---

## Related Files

- `compensation-engine/rates/2026.json` - Official rate table
- `backend/tests/dependent-calculation.test.js` - Test validation
- `backend/tests/compensation-regression.test.js` - Rate verification
- `Scanner/VA SCANNER/frontend/utils/extractDependents.js` - Extraction logic

