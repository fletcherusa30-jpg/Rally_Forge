# TERA Calculation Engine

JavaScript engine for calculating TERA retirement pay.

## Files

- `tera_calculator.js` - Main calculation engine class

## Features

- Eligibility validation (15-20 years service requirement)
- Retirement pay calculation (years × 0.025 × high-36 average)
- Comparison to 20-year retirement
- SBP (Survivor Benefit Plan) premium calculation
- Federal and state tax withholding
- Net pay calculation after deductions
- COLA (Cost of Living Adjustment) projections
- Batch processing for multiple scenarios

## Usage

```javascript
const TERACalculationEngine = require('./tera_calculator.js');
const engine = new TERACalculationEngine();

const result = engine.calculate({
  serviceMember: { /* ... */ },
  serviceRecord: { /* ... */ },
  deductions: { /* optional */ }
});

console.log(result.calculation.monthlyPay);
```

## API

- `validateEligibility(serviceRecord)` - Check TERA eligibility
- `calculate(input)` - Full TERA retirement calculation
- `calculateComparison(...)` - Compare to 20-year retirement
- `calculateDeductions(...)` - Calculate SBP and tax deductions
- `calculateNetPay(...)` - Net pay after deductions
- `calculateCOLAProjections(...)` - Project future pay with COLA
- `batchCalculate(inputs)` - Process multiple calculations
