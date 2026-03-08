# Compensation Engine - Integration Guide

## Overview

The VA Compensation Engine is now the **single source of truth** for all compensation calculations in Rally Forge. All modules must use it to ensure:

- **Consistency**: Same calculations across all features
- **Accuracy**: Official VA rates and rules
- **Maintainability**: One place to update when rates change
- **Auditability**: Clear calculation paths for compliance

## Modules Integration Checklist

### ✅ VA Scanner (COMPLETED)

**File**: `VA SCANNER/backend/scannerRoute.js`

**Integration**: 
- Automatically calls `calculateVeteranCompensation()` after extracting rating data
- Returns compensation data in API response alongside scan results
- Handles missing/invalid data gracefully with fallback

**Response Structure**:
```javascript
{
  success: true,
  data: {...},                    // Scanner extracted data
  compensation: {                 // NEW: Compensation calculation
    success: true,
    compensation: {
      summary: {...},
      components: {...},
      breakdown: {...}
    },
    input: {...},                 // What was used for calculation
    ratedConditions: 2            // Number of rated conditions
  },
  quality: {...},
  processingTime: {...}
}
```

**Usage in Frontend**:
```javascript
// After receiving scanner response with compensation data
if (scanResponse.compensation.success) {
  const comp = scanResponse.compensation.compensation;
  
  // Display in UI
  console.log(`Monthly: $${comp.summary.totalMonthly}`);
  console.log(`Yearly: $${comp.summary.totalYearly}`);
  
  // Use in compensation summary panel
  displayCompensationPanel(comp);
}
```

---

### 🟡 Financial Planner (NEEDS INTEGRATION)

**File**: `app/frontend-modern/src/pages/FinancialPlanner.jsx` (or similar)

**Integration Steps**:

1. **Import the Compensation Engine**:
```javascript
// At top of component
import CompensationEngine from '../../../compensation-engine/index.js';
```

2. **Add Compensation Calculation State**:
```javascript
const [veteranData, setVeteranData] = useState({
  rating: 100,
  dependents: {spouse: 1, children: 0, parents: 0},
  smcCode: null,
  ancillary: {aidAndAttendance: false, housebound: false},
  yearOverride: null
});

const [compensation, setCompensation] = useState(null);
```

3. **Calculate When Data Changes**:
```javascript
useEffect(() => {
  if (veteranData.rating !== null) {
    try {
      const comp = CompensationEngine.calculateVeteranCompensation(veteranData);
      setCompensation(comp);
    } catch (error) {
      console.error('Compensation calculation error:', error.message);
    }
  }
}, [veteranData]);
```

4. **Display in UI**:
```javascript
<div className="compensation-section">
  {compensation && (
    <>
      <h3>VA Disability Compensation</h3>
      <div className="compensation-grid">
        <div>
          <label>Monthly Payment</label>
          <value>${compensation.summary.totalMonthly.toFixed(2)}</value>
        </div>
        <div>
          <label>Annual Payment</label>
          <value>${compensation.summary.totalYearly.toFixed(2)}</value>
        </div>
        <div>
          <label>Based On</label>
          <value>{compensation.summary.year} rates</value>
        </div>
      </div>
      <BreakdownTable breakdown={compensation.breakdown} />
    </>
  )}
</div>
```

5. **Add Breakdown Table Component**:
```javascript
function BreakdownTable({breakdown}) {
  return (
    <table className="breakdown-table">
      <tbody>
        <tr>
          <td>Base Compensation</td>
          <td>${breakdown.baseMonthly.toFixed(2)}</td>
        </tr>
        {breakdown.dependentMonthly > 0 && (
          <tr>
            <td>Dependent Allowance</td>
            <td>${breakdown.dependentMonthly.toFixed(2)}</td>
          </tr>
        )}
        {breakdown.smcMonthly > 0 && (
          <tr>
            <td>Special Monthly Compensation</td>
            <td>${breakdown.smcMonthly.toFixed(2)}</td>
          </tr>
        )}
        {breakdown.ancillaryMonthly > 0 && (
          <tr>
            <td>Ancillary Benefits</td>
            <td>${breakdown.ancillaryMonthly.toFixed(2)}</td>
          </tr>
        )}
        <tr className="total">
          <td>TOTAL MONTHLY</td>
          <td>${breakdown.totalMonthly.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  );
}
```

---

### 🟡 AI Advisor (NEEDS INTEGRATION)

**File**: `app/frontend-modern/src/pages/AIAdvisor.jsx` (or similar)

**Integration Approach**:

1. **Calculate Compensation for Recommendations**:
```javascript
import CompensationEngine from '../../../compensation-engine/index.js';

function generateFinancialAdvice(veteranProfile) {
  // Calculate different scenarios
  const currentComp = CompensationEngine.calculateVeteranCompensation({
    rating: veteranProfile.rating,
    dependents: veteranProfile.dependents,
    smcCode: veteranProfile.smcCode
  });

  const maxComp = CompensationEngine.calculateVeteranCompensation({
    rating: 100,  // What if fully rated
    dependents: veteranProfile.dependents,
    smcCode: 'T'  // Premium SMC
  });

  // Generate advice based on gap
  const potentialIncrease = maxComp.summary.totalMonthly - currentComp.summary.totalMonthly;
  
  if (potentialIncrease > 1000) {
    advice.push({
      title: 'File Higher-Level Appeal',
      description: `You could potentially gain $${potentialIncrease.toFixed(2)}/month by appealing for a higher rating`,
      savings: potentialIncrease * 12 * 10  // Estimate over 10 years
    });
  }
  
  return advice;
}
```

2. **Scenario Planning**:
```javascript
function generateScenarios(veteranProfile) {
  const scenarios = [];
  
  // Scenario 1: Current rating
  scenarios.push({
    name: 'Current Rating',
    calculation: CompensationEngine.calculateVeteranCompensation({
      rating: veteranProfile.rating,
      dependents: veteranProfile.dependents,
      smcCode: veteranProfile.smcCode
    })
  });

  // Scenario 2: One rating increase
  if (veteranProfile.rating < 100) {
    const nextRating = veteranProfile.rating + 10;
    scenarios.push({
      name: `If Rating Increased to ${nextRating}%`,
      calculation: CompensationEngine.calculateVeteranCompensation({
        rating: nextRating,
        dependents: veteranProfile.dependents,
        smcCode: veteranProfile.smcCode
      })
    });
  }

  // Scenario 3: SMC added
  if (!veteranProfile.smcCode) {
    scenarios.push({
      name: 'If SMC Code T Was Added',
      calculation: CompensationEngine.calculateVeteranCompensation({
        rating: veteranProfile.rating,
        dependents: veteranProfile.dependents,
        smcCode: 'T'
      })
    });
  }

  return scenarios;
}
```

---

### 🟡 Benefits Advisory (NEEDS INTEGRATION)

**File**: `app/frontend-modern/src/pages/BenefitsAdvisory.jsx` (or similar)

**Integration Approach**:

1. **Determine Eligibility Based on Rating**:
```javascript
import CompensationEngine from '../../../compensation-engine/index.js';

function checkBenefitEligibility(veteranProfile) {
  const comp = CompensationEngine.calculateVeteranCompensation(veteranProfile);
  const rating = veteranProfile.rating;

  const benefits = [];

  // Bonus for 50%+ rating
  if (rating >= 50) {
    benefits.push({
      name: 'Career Development Program',
      description: 'Free vocational rehabilitation and training',
      eligibility: 'Rated 50% or higher'
    });
  }

  // Special rules for 100%
  if (rating >= 100) {
    benefits.push({
      name: 'Unemployment Compensation',
      description: 'Up to $3,737.85/month (2026 rate)',
      eligibility: 'Rated 100% or higher',
      amount: comp.breakdown.baseMonthly
    });

    benefits.push({
      name: 'Aid & Attendance Eligibility',
      description: 'If medically warranted',
      base: comp.components.ancillary.aidAndAttendance.monthly
    });
  }

  // SMC-based benefits
  if (veteranProfile.smcCode) {
    const smcInfo = CompensationEngine.getSMCAmount(veteranProfile.smcCode);
    benefits.push({
      name: `Special Monthly Compensation (${smcInfo.code})`,
      description: smcInfo.description,
      amount: smcInfo.smcMonthly,
      cfr: smcInfo.cfr
    });
  }

  return benefits;
}
```

2. **Display Ancillary Benefits Status**:
```javascript
function showAncillaryBenefitStatus(veteranProfile) {
  const ancillary = CompensationEngine.getAncillaryBenefits();

  return (
    <div className="ancillary-benefits">
      <h4>Available Ancillary Benefits</h4>
      
      <div className="benefit-item">
        <label>Clothing Allowance</label>
        <status>${ancillary.clothing.monthly}/month</status>
        <cfr>{ancillary.clothing.cfr}</cfr>
      </div>

      {veteranProfile.rating >= 100 && (
        <>
          <div className="benefit-item">
            <label>Aid & Attendance (if eligible)</label>
            <status>${ancillary.aidAndAttendance.monthly}/month</status>
            <cfr>{ancillary.aidAndAttendance.cfr}</cfr>
          </div>

          <div className="benefit-item">
            <label>Housebound (if eligible)</label>
            <status>${ancillary.housebound.monthly}/month</status>
            <cfr>{ancillary.housebound.cfr}</cfr>
          </div>
        </>
      )}
    </div>
  );
}
```

---

## Common Integration Patterns

### Pattern 1: Simple One-Time Calculation

```javascript
import CompensationEngine from 'compensation-engine/index.js';

const compensation = CompensationEngine.calculateVeteranCompensation({
  rating: 100,
  dependents: {spouse: 1, children: 1, parents: 0},
  smcCode: 'T',
  ancillary: {aidAndAttendance: true}
});

console.log(`Monthly: $${compensation.summary.totalMonthly}`);
```

### Pattern 2: With Effective Date (Rate Year Auto-Selection)

```javascript
const compensation = CompensationEngine.calculateVeteranCompensation({
  rating: 100,
  dependents: {spouse: 1},
  effectiveDate: '2024-06-15'  // Automatically uses 2024 rates
});
```

### Pattern 3: With Validation

```javascript
const input = {
  rating: userInput.rating,
  dependents: userInput.dependents,
  smcCode: userInput.smcCode
};

const validation = CompensationEngine.validateCompensationInput(input);

if (!validation.valid) {
  console.error('Invalid input:', validation.errors);
  return;
}

const compensation = CompensationEngine.calculateVeteranCompensation(input);
```

### Pattern 4: Scenario Comparison

```javascript
const scenarios = [
  {
    name: 'Current',
    rating: veteranProfile.rating,
    dependents: veteranProfile.dependents
  },
  {
    name: 'If 100%',
    rating: 100,
    dependents: veteranProfile.dependents
  },
  {
    name: 'If 100% + SMC-T',
    rating: 100,
    dependents: veteranProfile.dependents,
    smcCode: 'T'
  }
];

const scenarioResults = scenarios.map(scenario => ({
  ...scenario,
  calculation: CompensationEngine.calculateVeteranCompensation({
    rating: scenario.rating,
    dependents: scenario.dependents,
    smcCode: scenario.smcCode
  })
}));
```

---

## Backend Integration (Node.js)

### In Express Routes

```javascript
import CompensationEngine from '../../compensation-engine/index.js';
import express from 'express';

const router = express.Router();

// Calculate compensation endpoint
router.post('/api/calculate-compensation', (req, res) => {
  try {
    const compensation = CompensationEngine.calculateVeteranCompensation(req.body);
    res.json({success: true, compensation});
  } catch (error) {
    res.status(400).json({success: false, error: error.message});
  }
});

// Get available years
router.get('/api/compensation-years', (req, res) => {
  const years = CompensationEngine.getAvailableCompensationYears();
  res.json({success: true, years});
});
```

### In Database Operations

```javascript
async function createVeteranProfile(veteranData) {
  // Calculate current compensation
  const compensation = CompensationEngine.calculateVeteranCompensation({
    rating: veteranData.rating,
    dependents: veteranData.dependents
  });

  // Store calculation metadata
  veteranData.compensationCalculation = {
    calculatedAt: new Date(),
    rateYearUsed: compensation.summary.year,
    monthlyAmount: compensation.summary.totalMonthly,
    yearlyAmount: compensation.summary.totalYearly
  };

  // Save to database
  return await VeteranProfile.create(veteranData);
}
```

---

## Updating Rates

When new VA rates are released:

1. **Create New Rate Table**:
```bash
# Create 2027.json based on official VA rates
cp compensation-engine/rates/2026.json compensation-engine/rates/2027.json

# Update values in 2027.json with new rates
```

2. **No Code Changes Needed**:
   - The engine automatically detects new rate files
   - Year selection works immediately
   - All modules get new rates without changes

3. **Validation**:
   - Run `node compensation-engine/test-suite.js` to verify
   - Check specific rates against official VA tables
   - Validate SMC codes and ancillary amounts

---

## Testing the Integration

### Unit Tests

```javascript
import CompensationEngine from 'compensation-engine/index.js';

describe('Compensation Engine Integration', () => {
  test('Should calculate correct compensation', () => {
    const comp = CompensationEngine.calculateVeteranCompensation({
      rating: 100,
      dependents: {spouse: 1}
    });
    
    expect(comp.summary.totalMonthly).toBeGreaterThan(0);
    expect(comp.breakdown.baseMonthly).toBe(3737.85);
  });

  test('Should handle missing SMC code', () => {
    const comp = CompensationEngine.calculateVeteranCompensation({
      rating: 50,
      dependents: {}
    });
    
    expect(comp.components.smc.smcMonthly).toBe(0);
  });

  test('Should validate inputs', () => {
    const validation = CompensationEngine.validateCompensationInput({
      rating: 75  // Invalid
    });
    
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});
```

### End-to-End Test

```javascript
// Test full integration from scanner to compensation display
test('Complete compensation flow', async () => {
  // 1. Scan VA document
  const scanResponse = await fetch('/api/scanner/scan-pdf', {
    method: 'POST',
    body: formData
  });
  
  const result = await scanResponse.json();
  
  // 2. Verify compensation was calculated
  expect(result.compensation.success).toBe(true);
  
  // 3. Verify calculations are correct
  const comp = result.compensation.compensation;
  expect(comp.summary.totalMonthly).toBeGreaterThan(0);
  expect(comp.breakdown.baseMonthly).toBeLessThanOrEqual(3737.85);
});
```

---

## Reference Implementation Checklist

- [ ] VA Scanner ✅ (Already integrated)
- [ ] Financial Planner (Add compensation calculation UI)
- [ ] AI Advisor (Add scenario planning with compensation)
- [ ] Benefits Advisory (Add eligibility and ancillary benefits)
- [ ] Future modules (Import and use CompensationEngine)

## Support & Debugging

### Common Issues

**Issue**: "Cannot find module 'compensation-engine'"
- **Solution**: Use relative path: `../../compensation-engine/index.js`

**Issue**: Compensation not calculating
- **Solution**: Ensure `rating` is 0-100 in 10% increments (10, 20, 30, etc.)

**Issue**: Different results in different modules
- **Solution**: Verify all modules import from `index.js`, not direct functions

**Issue**: New rate table not being used
- **Solution**: Run `getAvailableCompensationYears()` to verify file exists

### Debugging Helpers

```javascript
// Log all available years
console.log(CompensationEngine.getAvailableCompensationYears());

// Validate input before calculation
const validation = CompensationEngine.validateCompensationInput(input);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}

// Get rate table being used
const comp = CompensationEngine.calculateVeteranCompensation({...});
console.log(`Using rates from: ${comp.summary.year}`);
console.log(`Fallback applied: ${comp.summary.rateTableFallback}`);
```
