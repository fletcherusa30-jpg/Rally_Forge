# VA Compensation Engine - Complete Implementation Guide

## Overview

The VA Compensation Engine is a centralized module that handles all VA disability compensation calculations across Rally Forge. It provides a unified source of truth for:

- Base disability compensation rates by rating (0-100%)
- Dependent tier calculations (spouse, children, parents)
- Special Monthly Compensation (SMC) codes (K through T)
- Ancillary benefits (clothing allowance, aid & attendance, housebound)
- Effective-date-aware rate table selection
- Multi-period compensation timelines

## Module Structure

```
compensation-engine/
├── index.js                 # Core module with all lookup functions
├── year-selector.js         # Year detection and rate table loading
├── validators.js            # Input validation utilities
└── rates/
    ├── 2023.json           # 2023 VA rates (Jan 1, 2023)
    ├── 2024.json           # 2024 VA rates (Jan 1, 2024)
    ├── 2025.json           # 2025 VA rates (Jan 1, 2025)
    └── 2026.json           # 2026 VA rates (Jan 1, 2026)
```

## Core Functions

### 1. `getCompensationByRating(rating, dependents, yearOverride)`

Calculate base monthly and yearly compensation for a disability rating.

**Parameters:**
- `rating` (number): Disability rating 0-100 in 10% increments
- `dependents` (object): Configuration with `{spouse, children, parents}` counts
- `yearOverride` (number, optional): Force a specific year's rate table

**Return Value:**
```javascript
{
  baseMonthly: 3737.85,           // Base monthly amount
  dependentMonthly: 180.00,       // Additional for dependents
  totalMonthly: 3917.85,          // Base + dependents
  yearlyTotal: 47014.20,          // Total monthly × 12
  rating: 100,
  dependents: {spouse: 1, children: 1, parents: 0},
  year: 2026,
  hasDependents: true,
  breakdown: {...},               // Detailed dependent tier breakdown
  rateTableFallback: false        // Was a fallback year used?
}
```

**Example:**
```javascript
import CompensationEngine from 'compensation-engine/index.js';

// 100% veteran with spouse and 1 child
const comp = CompensationEngine.getCompensationByRating(
  100,                                           // rating
  {spouse: 1, children: 1, parents: 0},         // dependents
  null                                           // use current year
);

console.log(`Total monthly: $${comp.totalMonthly}`);
// Total monthly: $3917.85
```

### 2. `getSMCAmount(smcCode, yearOverride)`

Get the monthly amount for a Special Monthly Compensation code.

**Parameters:**
- `smcCode` (string): SMC code K, L, L½, M, M½, N, N½, O, R1, R2, S, or T
- `yearOverride` (number, optional): Force a specific year's rate table

**Return Value:**
```javascript
{
  smcMonthly: 890.00,               // Monthly SMC amount
  code: 'T',                        // The SMC code
  description: 'Highest level SMC',
  cfr: '38 CFR 3.350(b)(12)',      // Regulatory citation
  year: 2026,
  yearlyTotal: 10680.00            // SMC monthly × 12
}
```

**Important:** Per VA rules, only the HIGHEST benefit wins. Multiple SMC codes cannot be stacked.

**Example:**
```javascript
// Get SMC amount for code T
const smc = CompensationEngine.getSMCAmount('T', 2026);
console.log(`SMC T adds: $${smc.smcMonthly}/month`);
```

### 3. `getAncillaryBenefits(yearOverride)`

Get ancillary/supplemental benefits amounts (clothing, A&A, housebound).

**Parameters:**
- `yearOverride` (number, optional): Force a specific year's rate table

**Return Value:**
```javascript
{
  clothing: {
    monthly: 37.25,
    yearly: 447.00,
    description: 'Annual clothing allowance for prosthetic/orthotic wear',
    cfr: '38 CFR 3.810'
  },
  aidAndAttendance: {
    monthly: 171.00,
    yearly: 2052.00,
    description: 'Aid & Attendance allowance',
    cfr: '38 CFR 3.352'
  },
  housebound: {
    monthly: 107.00,
    yearly: 1284.00,
    description: 'Housebound allowance for 100% veterans',
    cfr: '38 CFR 3.351'
  },
  year: 2026,
  yearlyTotals: {
    clothing: 447.00,
    aidAndAttendance: 2052.00,
    housebound: 1284.00
  }
}
```

### 4. `calculateVeteranCompensation(input)`

Complete calculation combining base, SMC, and ancillary benefits.

**Parameters:**
```javascript
{
  rating: 100,                              // Required: disability rating
  dependents: {                             // Optional: dependent config
    spouse: 1,
    children: 1,
    parents: 0
  },
  smcCode: 'T',                            // Optional: SMC code
  ancillary: {                             // Optional: ancillary flags
    aidAndAttendance: true,
    housebound: false
  },
  effectiveDate: '2025-06-15',            // Optional: determines rate year
  yearOverride: 2026                       // Optional: force year
}
```

**Return Value:**
```javascript
{
  summary: {
    totalMonthly: 4078.85,                 // Base + SMC + ancillary
    totalYearly: 48946.20,
    year: 2026,
    effectiveDate: '2025-06-15',
    rateTableFallback: false
  },
  components: {
    base: {...},                           // getCompensationByRating result
    smc: {...},                            // getSMCAmount result
    ancillary: {                           // Selected ancillary amounts
      aidAndAttendance: 171.00,
      housebound: 0,
      total: 171.00
    }
  },
  breakdown: {
    baseMonthly: 3737.85,
    dependentMonthly: 180.00,
    smcMonthly: 890.00,
    ancillaryMonthly: 171.00,
    totalMonthly: 4978.85,
    totalYearly: 59746.20
  }
}
```

**Example:**
```javascript
// Complete compensation for 100% veteran with SMC-T and A&A
const fullComp = CompensationEngine.calculateVeteranCompensation({
  rating: 100,
  dependents: {spouse: 1, children: 1, parents: 0},
  smcCode: 'T',
  ancillary: {aidAndAttendance: true, housebound: false},
  effectiveDate: '2025-06-15'
});

console.log(`Total: $${fullComp.summary.totalMonthly}/month`);
console.log(`Yearly: $${fullComp.summary.totalYearly}`);
```

### 5. `getCompensationTimeline(periods)`

Generate compensation across multiple effective dates (e.g., for retroactive payments or projected increases).

**Parameters:**
```javascript
[
  {
    effectiveDate: '2024-01-01',
    rating: 80,
    dependents: {spouse: 1, children: 0, parents: 0},
    smcCode: null,
    ancillary: {aidAndAttendance: false, housebound: false}
  },
  {
    effectiveDate: '2025-06-15',
    rating: 100,
    dependents: {spouse: 1, children: 1, parents: 0},
    smcCode: 'T',
    ancillary: {aidAndAttendance: true, housebound: false}
  }
]
```

**Return Value:**
```javascript
[
  {
    period: 1,
    effectiveDate: '2024-01-01',
    endDate: '2025-06-15',
    summary: {...},  // Full calculateVeteranCompensation result
    breakdown: {...}
  },
  {
    period: 2,
    effectiveDate: '2025-06-15',
    endDate: 'Present',
    summary: {...},
    breakdown: {...}
  }
]
```

### 6. `getAvailableCompensationYears()`

Get list of available rate table years.

**Return Value:**
```javascript
[2026, 2025, 2024, 2023]  // Sorted descending
```

### 7. `validateCompensationInput(input)`

Validate all fields before calculation to catch errors early.

**Return Value:**
```javascript
{
  valid: true,              // All inputs valid
  errors: []                // Empty if valid
}

// Or if invalid:
{
  valid: false,
  errors: [
    "rating must be 0-100 in 10% increments, got 75",
    "smcCode M is not valid (K-T)"
  ]
}
```

## Year-Selector Module

The compensation engine automatically handles year selection with intelligent fallback logic:

1. **Current Year Detection**: Uses system date to select current year's rates
2. **Effective Date Mapping**: If you provide an effective date, uses that year's rates
3. **Fallback to Most Recent**: If requested year not available, uses newest available year
4. **Manual Override**: `yearOverride` parameter forces a specific year

**Functions:**

```javascript
import {
  selectYearTable,          // Load specific year's rates
  getTableByEffectiveDate,  // Load rates for effective date's year
  getAvailableYears,        // List available years
  detectCurrentYear,        // Get system year
  getAllRateTables          // Load all rate tables at once
} from 'compensation-engine/year-selector.js';

// Automatic current year
const rates2026 = selectYearTable();

// Specific year
const rates2024 = selectYearTable(2024);

// By effective date
const ratesByDate = getTableByEffectiveDate('2025-06-15');

// All available years
const availableYears = getAvailableYears();  // [2026, 2025, 2024, 2023]
```

## Scanner Integration

The VA Scanner automatically calculates compensation after extracting rating information:

**POST /scanner/scan-pdf** (multipart file upload)
**POST /scanner/scan-text** (text body)

**Response Example:**
```javascript
{
  success: true,
  data: {
    // Extracted VA decision data
    ratingCalculation: {
      calculatedCombinedRating: 100,
      hasBilateralPairs: false,
      // ... other rating details
    },
    serviceConnected: [
      {condition: "...", percentage: 50, ...},
      {condition: "...", percentage: 40, ...}
    ],
    dependents: {
      spouse: true,
      dependentChildren: 1,
      dependentParents: 0
    },
    smc: {code: 'T', ...},
    metadata: {
      effectiveDate: '2025-06-15',
      // ...
    }
    // ... other extracted data
  },
  
  // NEW: Automatically calculated compensation
  compensation: {
    success: true,
    compensation: {
      summary: {
        totalMonthly: 4078.85,
        totalYearly: 48946.20,
        year: 2026,
        effectiveDate: '2025-06-15',
        rateTableFallback: false
      },
      components: {...},
      breakdown: {
        baseMonthly: 3737.85,
        dependentMonthly: 180.00,
        smcMonthly: 890.00,
        ancillaryMonthly: 171.00,
        totalMonthly: 4078.85,
        totalYearly: 48946.20
      }
    },
    input: {...},  // Input used for calculation
    ratedConditions: 2
  },

  quality: {...},
  processingTime: {...}
}
```

## Rate Table JSON Schema

All rate tables follow this consistent schema for interoperability:

```json
{
  "year": 2026,
  "effective_date": "2026-01-01",
  "version": "1.0.0",
  "baseCompensation": {
    "10": 174.00,
    "20": 333.00,
    // ... through 100
    "100": 3737.85
  },
  "dependents": {
    "spouse": {
      "first_child": 90.00,
      "each_additional_child": 65.00,
      "first_parent": 90.00,
      "each_additional_parent": 65.00
    },
    "no_spouse": {
      "first_child": 64.00,
      "each_additional_child": 45.00,
      "first_parent": 75.00,
      "each_additional_parent": 48.00
    }
  },
  "smc": {
    "K": {
      "description": "Loss of use of one creative organ",
      "amount": 256.00,
      "cfr": "38 CFR 3.350(b)(3)"
    },
    // ... through T
    "T": {
      "description": "Highest level SMC",
      "amount": 890.00,
      "cfr": "38 CFR 3.350(b)(12)"
    }
  },
  "ancillary": {
    "clothing_allowance": {
      "description": "...",
      "monthly": 37.25,
      "yearly": 447.00,
      "cfr": "38 CFR 3.810"
    },
    "aid_and_attendance": {
      "description": "...",
      "monthly": 171.00,
      "cfr": "38 CFR 3.352"
    },
    "housebound": {
      "description": "...",
      "monthly": 107.00,
      "cfr": "38 CFR 3.351"
    }
  },
  "rules": {
    "smc_combination": "Highest benefit wins (VA combines SMC codes per 38 CFR 3.350)",
    "bilateral_factor": "Applied per 38 CFR 4.26 (bilateral compensation increase)",
    "effective_date_logic": "Use year of effective date to determine applicable rates"
  }
}
```

## Usage Examples

### Basic Usage

```javascript
import CompensationEngine from 'compensation-engine/index.js';

// 1. Get base compensation
const base = CompensationEngine.getCompensationByRating(50, {spouse: 1, children: 2});
console.log(`Base + dependents: $${base.totalMonthly}`);

// 2. Add SMC
const smc = CompensationEngine.getSMCAmount('K');

// 3. Complete calculation
const total = CompensationEngine.calculateVeteranCompensation({
  rating: 50,
  dependents: {spouse: 1, children: 2},
  smcCode: 'K',
  ancillary: {aidAndAttendance: true}
});

console.log(`Total monthly: $${total.summary.totalMonthly}`);
console.log(`Total yearly: $${total.summary.totalYearly}`);
```

### With Effective Dates

```javascript
// Auto-select rates based on effective date
const comp = CompensationEngine.calculateVeteranCompensation({
  rating: 100,
  dependents: {spouse: 1},
  smcCode: 'T',
  effectiveDate: '2024-06-15'  // Uses 2024 rate table
});

console.log(`Rating effective: ${comp.summary.effectiveDate}`);
console.log(`Using 2024 rates: ${comp.summary.year === 2024}`);
```

### Multiple Periods (Timeline)

```javascript
// Retroactive increases (e.g., appeal decision)
const timeline = CompensationEngine.getCompensationTimeline([
  {
    effectiveDate: '2023-01-01',
    rating: 50,
    dependents: {spouse: 1}
  },
  {
    effectiveDate: '2024-06-15',  // Appeal granted
    rating: 80,
    dependents: {spouse: 1, children: 1}
  },
  {
    effectiveDate: '2025-01-01',
    rating: 100,
    dependents: {spouse: 1, children: 1},
    smcCode: 'T',
    ancillary: {aidAndAttendance: true}
  }
]);

timeline.forEach(period => {
  console.log(`${period.effectiveDate}: $${period.summary.totalMonthly}/month`);
});
```

### Validation

```javascript
// Validate before calculation
const validation = CompensationEngine.validateCompensationInput({
  rating: 75,
  smcCode: 'M'
});

if (!validation.valid) {
  console.error('Invalid input:', validation.errors);
}
```

## Regulatory Compliance

All calculations follow VA regulations:

- **38 CFR §3.350**: SMC codes and rates
- **38 CFR §3.351**: Housebound allowance
- **38 CFR §3.352**: Aid & Attendance rates
- **38 CFR §3.810**: Clothing allowance
- **38 CFR §4.25**: Combined ratings table
- **38 CFR §4.26**: Bilateral factor application

SMC codes follow the hierarchy (highest benefit wins):
```
T > S > R2 > R1 > O > N½ > N > M½ > M > L½ > L > K
```

## Future Enhancements

1. **New Rate Tables**: Simply add new YYYY.json files to `compensation-engine/rates/`
2. **Historical Data**: Load 2022, 2021, etc. for retroactive calculations
3. **COLA Projections**: Generate future rates with typical COLA increments
4. **Batch Processing**: Calculate compensation for multiple veterans simultaneously
5. **PDF Reports**: Generate formal compensation summary documents
6. **Widget Integration**: Embed compensation calculator in Financial Planner

## Error Handling

Methods throw descriptive errors for invalid inputs:

```javascript
try {
  CompensationEngine.getCompensationByRating(75);  // Invalid: not 10% increment
} catch (error) {
  console.error(error.message);  
  // "Invalid rating: 75. Must be 0-100 in 10% increments."
}
```

## Performance Notes

- Rate tables cached in memory (minimal file I/O)
- Calculations complete in <10ms
- No external API calls required
- Suitable for bulk processing
