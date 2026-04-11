# Rally Forge — Compensation & Benefits Engine
**Covers:** 38 CFR Math, VA Rate Tables, SMC, Dependents, State Benefits, Financial Planner

---

## 1. COMPENSATION ENGINE TOPOLOGY

```
┌─────────────────────────────────────────────────────────────┐
│               COMPENSATION CALCULATION FLOW                 │
│                                                             │
│  Input:  { rating, dependents, smcCode, effectiveDate }     │
│                    │                                        │
│                    ▼                                        │
│          ┌──────────────────┐                               │
│          │ year-selector.js │ ← Determines rate year        │
│          │ (1950–2026)      │   (effectiveDate or current)  │
│          └────────┬─────────┘                               │
│                   │                                         │
│                   ▼                                         │
│          ┌──────────────────┐                               │
│          │  Rate Lookup     │ ← YEARS/{year}.json           │
│          │  (base rates)    │   (indexed by rating%)        │
│          └────────┬─────────┘                               │
│                   │                                         │
│                   ▼                                         │
│          ┌──────────────────┐                               │
│          │ Dependent Calc   │ ← spouse + children + parents │
│          └────────┬─────────┘   (per 38 CFR §3.250)        │
│                   │                                         │
│                   ▼                                         │
│          ┌──────────────────┐                               │
│          │  SMC Lookup      │ ← SMC/{year}.json             │
│          │  (if applicable) │   (SMC-K through SMC-T)       │
│          └────────┬─────────┘                               │
│                   │                                         │
│                   ▼                                         │
│          ┌──────────────────┐                               │
│          │ Ancillary Add-On │ ← Aid&Attendance, Housebound  │
│          └────────┬─────────┘                               │
│                   │                                         │
│                   ▼                                         │
│     Output: { baseMonthly, smcMonthly, dependentMonthly,   │
│               ancillaryMonthly, totalMonthly, breakdown }  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. DOMAIN ENGINE LAYER

**Location:** `backend/domain/engines/`

### CompensationEngine.js
Primary compensation calculation engine:

```javascript
compensationEngine.calculateVeteran({
  rating: 70,                     // Combined disability rating (%)
  dependents: {
    spouse: 1,                    // 0 or 1
    children: 2,                  // count
    parents: 0                    // count of dependent parents
  },
  smcCode: 'SMC-S',              // null or SMC code
  effectiveDate: '2024-01-01',   // ISO date string
  yearOverride: null,             // force specific year
  ancillary: {
    aidAndAttendance: false,
    housebound: false
  }
})
// Returns:
{
  baseMonthly: 1716.28,
  dependentMonthly: 162.00,
  smcMonthly: 0,
  ancillaryMonthly: 0,
  totalMonthly: 1878.28,
  year: 2026,
  rateSource: 'YEARS/2026.json',
  breakdown: {
    rating: 70,
    spouse: { amount: 112.00 },
    children: [{ amount: 25.00 }, { amount: 25.00 }],
    smcCode: null
  }
}
```

### BenefitsEngine.js
Higher-level benefits evaluation:
```javascript
benefitsEngine.evaluate(onboardingResult, { requestId })
// Evaluates: compensation + federal benefits + state benefits + pathways
// Returns: comprehensive benefits eligibility report
```

---

## 3. COMPENSATION SERVICE LAYER

**File:** `backend/services/compensationService.js`

### calculateCompensationQuote()
Full calculation with validation:
- Input normalization (string → int for rating, boolean coercion for spouse)
- Delegates to `compensationEngine.calculateVeteran()`

### calculateBackPay()
Historical back-pay calculation:
```
Back Pay = Σ (monthly_rate[year] × months_in_year) for each year from startDate to endDate
```
Supports: rating changes, dependent changes, SMC changes over time

### normalizeDependentProfile()
- Spouse: boolean/string/number → 0 or 1
- Children: clamps to ≥ 0
- Parents: clamps to ≥ 0

---

## 4. STANDALONE COMPENSATION ENGINE

**Location:** `compensation-engine/`

A standalone, self-contained module separate from the backend services:

| File | Purpose |
|---|---|
| `index.js` | Main export entry point |
| `validators.js` | Input validation functions |
| `year-selector.js` | Rate year selection logic |
| `rates/` | Historical rate JSON files |
| `test-suite.js` | Built-in test cases |

This module can be used independently of the backend for scripted calculations.

---

## 5. RATE DATABASE STRUCTURE

### Base Compensation Rates (`YEARS/{year}.json`)
```json
{
  "year": 2026,
  "cola": 0.025,
  "rates": {
    "10": { "alone": 175.00, "spouse": 0, "child": 0, "parent": 0 },
    "20": { "alone": 346.00, "spouse": 0, "child": 0, "parent": 0 },
    "30": { "alone": 535.45, "spouse": 50.72, "child": 26.08, "parent": 26.08 },
    "40": { "alone": 771.67, "spouse": 68.31, "child": 32.46, "parent": 32.46 },
    "50": { "alone": 1098.64, "spouse": 87.89, "child": 39.30, "parent": 39.30 },
    "60": { "alone": 1389.56, "spouse": 107.26, "child": 46.11, "parent": 46.11 },
    "70": { "alone": 1750.80, "spouse": 126.89, "child": 52.98, "parent": 52.98 },
    "80": { "alone": 2034.27, "spouse": 144.76, "child": 59.48, "parent": 59.48 },
    "90": { "alone": 2286.97, "spouse": 165.06, "child": 66.44, "parent": 66.44 },
    "100": { "alone": 3831.30, "spouse": 205.65, "child": 105.16, "parent": 105.16 }
  }
}
```

### SMC Rates (`SMC/{year}.json`)
```json
{
  "year": 2026,
  "rates": {
    "SMC-K": 130.94,
    "SMC-L": 4185.48,
    "SMC-L1/2": 4413.45,
    "SMC-M": 4641.42,
    "SMC-M1/2": 4869.39,
    "SMC-N": 5097.36,
    "SMC-N1/2": 5397.42,
    "SMC-O": 5697.48,
    "SMC-R1": 9805.00,
    "SMC-R2": 11218.00,
    "SMC-S": 3831.30
  }
}
```

**Coverage:** 1950 through 2026 (77 years of SMC rate history)

---

## 6. 38 CFR MATHEMATICAL RULES IMPLEMENTED

### §4.14 — Avoidance of Pyramiding
- No single disability rated twice
- Secondary conditions handled separately

### §4.25 — Combined Ratings Table
- Whole-person concept calculation
- Sort highest to lowest, apply sequentially
- Round final to nearest 10%

### §4.26 — Bilateral Factor
- Applies to paired bilateral extremities
- 10% added before final rounding
- Bilateral conditions flagged during extraction

### §3.102 — Benefit of the Doubt
- When evidence is in approximate balance, resolves in veteran's favor
- Implemented in service connection analysis

### §3.250 — Dependency Rates
- Spouse eligible regardless of disability rating ≥ 30%
- Children eligible regardless of rating ≥ 10%

### §4.16 — TDIU
- Schedular: single disability ≥ 60% or combined ≥ 70% with one ≥ 40%
- Extra-schedular: any rating, with unemployability evidence

---

## 7. DEPENDENT COMPENSATION ENGINE

**File:** `backend/services/dependentCompensationEngine.js`

Calculates dependent-based compensation additions:
- **Spouse:** Fixed monthly addition based on rating tier
- **Children:** Per-child addition (under 18 or school age 18-23)
- **Parents:** Dependent parent addition (income-based)
- **Aid & Attendance:** Additional for spouse needing aid

---

## 8. BENEFITS SERVICE

**File:** `backend/services/benefitsService.js`

### Cache-First Pattern
```
1. Check benefitsRepo cache → serve if valid
2. If not cached: load onboarding record → compute benefits
3. Store result in cache
4. Return result
```

### Benefit Validation Engine
**File:** `backend/services/benefitValidationEngine.js`
- Validates benefit eligibility criteria
- Cross-checks service dates against benefit requirements
- Flags potential conflicts

---

## 9. STATE BENEFITS SYSTEM

**Files:**
- `backend/services/stateBenefitsService.js`
- `backend/services/stateBenefitsService.generated.js`
- `models/stateBenefitsRules.model.js`

### State Benefits Categories

```
For each U.S. state + territories:
  ├── Property Tax Benefits
  │     ├── Full exemption (e.g., Texas: 100% disabled = full exemption)
  │     ├── Partial exemption (e.g., California: $150,000 SOQ)
  │     └── Eligibility criteria (disability %, residency)
  │
  ├── Education Benefits
  │     ├── Tuition waivers/reductions
  │     ├── GI Bill supplements
  │     └── Vocational training programs
  │
  ├── Employment Preferences
  │     ├── State job hiring preference points
  │     ├── Certification/licensing waivers
  │     └── Entrepreneurship programs
  │
  ├── Motor Vehicle Benefits
  │     ├── License plate/registration waivers
  │     ├── Special veteran plates
  │     └── Toll exemptions
  │
  └── Additional Benefits
        ├── Cemetery/burial benefits
        ├── Health care supplements
        ├── Recreation benefits (parks, fishing/hunting)
        └── Financial assistance programs
```

### StateBenefitsPage Features
- Automatic state detection from veteran profile
- Side-by-side state comparison
- Eligibility filtering by disability rating
- Direct links to state applications

---

## 10. FEDERAL BENEFITS

**File:** `backend/services/federalService.js`
**UI:** `src/components/FederalBenefitsUI.jsx`

### Federal Benefits Tracked
- VA Healthcare enrollment tiers
- GI Bill (Chapter 30, 33, 35)
- Vocational Rehabilitation (Chapter 31)
- CHAMPVA (dependents health coverage)
- Life Insurance (VGLI)
- Home Loan Guarantee
- Adaptive Sports Program
- Disabled American Veterans (DAV) programs

---

## 11. FINANCIAL PLANNER

**File:** `backend/services/financialPlannerService.js`

### Budget Analysis
```javascript
analyzeBudget({
  monthlyIncome: 4500,
  fixedExpenses: 'Rent: 1200\nCar: 350',
  variableExpenses: 'Food: 600\nEntertainment: 200'
})
// Returns:
{
  score: 72,             // 0-100 financial health score
  savingsRate: 0.24,     // 24%
  debtToIncome: 0.38,
  emergencyFundMonths: 3.2,
  recommendations: [...]
}
```

### Retirement Projections
```javascript
// TSP (Federal Thrift Savings Plan)
futureValueAnnuity(annualContribution, rate, years)

// FERS Pension
// VA Disability (tax-free, no reduction)
// Social Security (offset calculations)
```

### Investment Formulas
```
Future Value (Lump Sum):  FV = PV × (1 + r)^n
Future Value (Annuity):   FV = C × [(1 + r)^n - 1] / r

where:
  r = annual interest rate
  n = years
  C = annual contribution
```

---

## 12. RULES ENGINE

**File:** `backend/services/rulesEngine.js`
**Rules Loader:** `backend/engine/rulesLoader.js`

Evaluates business rules for:
- Benefits eligibility
- Service connection pathways
- Presumptive condition identification
- Appeal recommendations
- Evidence gap identification

Rules are loaded from `backend/rules/` and `rules/` (root level) as JSON/JS rule definitions.

---

## 13. RATE ESCALATOR

**File:** `backend/va_scanner/engine/rateEscalator.js`

Projects future compensation increases:
- Historical COLA (Cost of Living Adjustment) tracking
- Congressional Budget Office projections
- Year-over-year rate change calculations
- Used in financial planning projections

---

## 14. RATE LOADER

**File:** `backend/va_scanner/engine/rateLoader.js`

Efficient rate data access:
- Lazy-loads rate JSON files on first access
- Caches loaded years in memory
- `getRate(year, rating, dependentProfile)` → dollar amount
- Falls back to adjacent year if requested year unavailable
- Validates rate file integrity on load

---

## 15. COMPENSATION API RESPONSES

### Full Compensation Calculation Response
```json
{
  "success": true,
  "data": {
    "rating": 70,
    "year": 2026,
    "monthly": {
      "base": 1750.80,
      "spouse": 126.89,
      "children": 105.96,
      "parents": 0,
      "smc": 0,
      "ancillary": 0,
      "total": 1983.65
    },
    "dependentProfile": {
      "spouse": 1,
      "children": 2,
      "parents": 0
    },
    "effectiveDate": "2024-01-01",
    "breakdown": "Detailed per-item breakdown"
  }
}
```

### Dashboard Summary Response
```json
{
  "baseMonthly": 1750.80,
  "smcMonthly": 0,
  "dependentMonthly": 232.85,
  "ancillaryMonthly": 0,
  "totalMonthly": 1983.65,
  "rating": 70,
  "year": 2026
}
```
