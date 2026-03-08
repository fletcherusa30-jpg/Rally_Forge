# Rally Forge CFR/M21-1 Upgrade - Quick Start Guide

## 🚀 What's New in Version 4.0.0

The VA disability scanner is now **fully CFR and M21-1 aware** with comprehensive upgrades:

✅ **All 3 Defects Fixed** (semicolon splitting, condition merging, ligamentum flavum)  
✅ **SMC Detection** for all 11 levels (K, L, L½, M, M½, N, O, R1, R2, S, T)  
✅ **Ancillary Benefits** detection for 11 benefits (DEA, CHAMPVA, Clothing, Auto, SAH/SHA, A&A, Housebound, Voc Rehab, CRDP, CRSC)  
✅ **Manual Input Tab** for entering conditions without uploading documents  
✅ **CFR Part 3 & 4** knowledge bases for authoritative interpretations  

---

## 🎯 For Veterans - How to Use

### Option 1: Upload Your Decision Letter

1. **Navigate** to Scanner Hub
2. **Click** "Upload & Scan" tab
3. **Choose** your VA decision letter (PDF or text file)
4. **Click** "Run Scanner"
5. **View** your results:
   - ✓ Service-connected conditions with ratings
   - ✗ Denied conditions
   - 📊 Combined rating (with bilateral factor if applicable)
   - 🏅 SMC levels (if eligible)
   - 🏛️ Ancillary benefits (DEA, CHAMPVA, etc.)

### Option 2: Manual Entry

1. **Navigate** to Scanner Hub
2. **Click** "Manual Entry" tab
3. **Add each condition:**
   - Enter condition name (e.g., "Tinnitus")
   - Select "Service Connected" or "Denied"
   - If SC: Select percentage (0%, 10%, 20%, ..., 100%)
   - Optional: Add effective date and notes
   - Click "+ Add Condition"
4. **View** auto-calculated combined rating
5. **Click** "Save & Use These Conditions"

---

## 💻 For Developers - Integration Guide

### Using the CFR Knowledge Base

```javascript
// Service Connection Type Detection
import { detectServiceConnectionType } from '../knowledge/cfr-part3-rules.js';

const types = detectServiceConnectionType('PTSD', 'combat veteran');
// Returns: [{ type: 'DIRECT', cfr: '38 CFR 3.303' }]
// Or: [{ type: 'PRESUMPTIVE_HERBICIDE', cfr: '38 CFR 3.309(e)' }]
```

```javascript
// CFR Terminology Normalization
import { normalizeToCFRTerminology } from '../knowledge/cfr-part4-rules.js';

const normalized = normalizeToCFRTerminology('left knee arthritis');
// Returns: { 
//   anatomy: 'knee', 
//   category: 'musculoskeletal', 
//   subcategory: 'joints' 
// }
```

### Using SMC Detection

```javascript
import { detectSMC, inferSMC } from './smc-detector.js';

const conditions = [
  { condition: 'erectile dysfunction', percentage: 0 },
  { condition: 'PTSD', percentage: 70 }
];

const detected = detectSMC(conditions, fullDecisionText);
// Returns array of detected SMC levels with CFR citations

const inferred = inferSMC(conditions, metadata, fullDecisionText);
// Returns array of inferred SMC based on M21-1 duty to maximize
```

### Using Ancillary Benefits Detection

```javascript
import { detectAncillaryBenefits } from './ancillary-benefits-detector.js';

const benefits = detectAncillaryBenefits(conditions, metadata, fullDecisionText);
// Returns:
[
  {
    benefit: 'Dependents\' Educational Assistance (Chapter 35)',
    status: 'inferred eligible',
    reason: 'P&T status triggers DEA eligibility',
    cfr: '38 CFR 3.812(a)(1)',
    evidence: 'Permanent and total disability'
  },
  {
    benefit: 'CHAMPVA',
    status: 'inferred eligible',
    reason: 'P&T status triggers CHAMPVA for family',
    cfr: '38 CFR 17.270'
  }
]
```

---

## 🔍 What Gets Detected Automatically

### Service-Connected Conditions
- Condition names with pathologies merged
- Percentage ratings
- Effective dates
- Bilateral conditions (with bilateral factor calculation)
- Laterality (left/right)
- Service connection type (direct, secondary, presumptive)

### SMC Levels (All 11)
- **SMC-K**: Erectile dysfunction, loss of creative organ
- **SMC-L**: Loss of hand/foot, blindness in one eye
- **SMC-M**: Loss of both hands/feet, bilateral blindness
- **SMC-S**: Housebound (100% + 60%+ additional)
- **SMC-N**: Aid and attendance, bedridden
- **SMC-O, R1, R2**: Higher-level A&A
- **SMC-T**: TBI requiring supervision

### Ancillary Benefits (All 11)
- **DEA (Chapter 35)**: P&T → dependents education
- **CHAMPVA**: P&T → family medical coverage
- **Clothing Allowance**: Prosthetic/orthotic use
- **Auto Grant**: Loss of limb, vision impairment
- **SAH**: Bilateral lower extremity loss
- **SHA**: Bilateral upper extremity loss, blindness
- **A&A**: Aid and attendance eligibility
- **Housebound**: 100% + 60%+ additional
- **Voc Rehab**: 10%+ rating
- **CRDP**: Retiree + 50%+ rating
- **CRSC**: Combat-related + retirement

---

## 📊 Example Output

### Scanned Decision Letter Result:

```json
{
  "scannerVersion": "4.0.0-cfr-aware",
  "metadata": {
    "combinedRating": "100",
    "decisionDate": "March 15, 2017"
  },
  "serviceConnected": [
    {
      "condition": "thoracic and lumbar spine spondylosis; degenerative arthritis; ligamentum flavum",
      "percentage": 20,
      "rating": "20%",
      "effectiveDate": "March 15, 2017"
    },
    {
      "condition": "erectile dysfunction",
      "percentage": 0,
      "rating": "0%"
    }
  ],
  "smc": {
    "detectedLevels": [
      {
        "level": "K",
        "reason": "Erectile dysfunction",
        "cfr": "38 CFR 3.350(b)",
        "evidence": "Erectile dysfunction condition present"
      }
    ]
  },
  "ancillaryBenefits": [
    {
      "benefit": "Dependents' Educational Assistance (Chapter 35)",
      "status": "inferred eligible",
      "cfr": "38 CFR 3.812(a)(1)"
    },
    {
      "benefit": "CHAMPVA",
      "status": "inferred eligible",
      "cfr": "38 CFR 17.270"
    }
  ],
  "ratingCalculation": {
    "calculatedCombinedRating": 100,
    "hasBilateralPairs": true,
    "bilateralBonus": 5,
    "calculationMethod": "38 CFR §4.25 + §4.26 (with bilateral factor)"
  }
}
```

---

## 🛠️ Technical Details

### Build Information
- **Bundle Size**: 162.83 kB (↑7.81 kB from v3.3.1)
- **Modules**: 31 (↑1 module)
- **Build Time**: ~1.2s
- **Status**: ✅ Zero errors

### New Files Added
1. `VA SCANNER/knowledge/cfr-part3-rules.js` (service connection)
2. `VA SCANNER/knowledge/cfr-part4-rules.js` (rating schedule)
3. `VA SCANNER/engine/smc-detector.js` (SMC detection)
4. `VA SCANNER/engine/ancillary-benefits-detector.js` (benefits)
5. `app/frontend-modern/src/components/ManualConditionEntry.jsx` (UI)

### Files Modified
1. `VA SCANNER/engine/vaSuperScanner.js` (main scanner)
2. `app/frontend-modern/src/pages/ScannerHub.jsx` (added tabs)

---

## ✅ Verification Tests

### Defect Fixes Verified:
✅ **Defect 1** - Semicolons preserved: 5 conditions found with semicolons  
✅ **Defect 2** - Multiple anatomies separated: hallux valgus + foot arthritis split  
✅ **Defect 3** - No standalone "flavum": 0 found (merged into spine condition)  

### Scanner Output:
✅ **Combined Rating**: 100%  
✅ **Service Connected**: 23 conditions  
✅ **Denied**: 2 conditions  
✅ **Build**: Zero errors  

---

## 🚦 Quick Command Reference

### Build & Test
```bash
# Build application
npm run build

# Run defect verification test
node verify-defect-fixes.mjs

# Compare scanner output
node compare-scanner.mjs
```

### Start Development Server
```bash
# Start backend API
node backend/server.js

# Or use task runner
npm run dev
```

---

## 📚 Additional Resources

### Documentation
- **Full Documentation**: `CFR_M21_UPGRADE_DOCUMENTATION.md`
- **VA Scanner Blueprint**: `va_scanner_blueprint.md`
- **CFR Text**: `38CFR_Part3_and_Part4.md`
- **System Architecture**: `VA_SCANNER_MODEL_DESIGN.md`

### External Links
- [38 CFR Regulations](https://www.ecfr.gov/current/title-38)
- [M21-1 Manual](https://www.knowva.ebenefits.va.gov/)
- [VA Benefits Portal](https://www.va.gov/disability/)

---

## 🎓 Training Material

### For New Users

**What is SMC?**
Special Monthly Compensation is additional tax-free compensation beyond your base disability rating for severe disabilities like:
- Loss of use of limbs
- Blindness
- Need for aid and attendance
- Being housebound

**What are Ancillary Benefits?**
Additional VA benefits you may qualify for based on your disability rating:
- **DEA**: College assistance for your dependents
- **CHAMPVA**: Health insurance for your family
- **Clothing Allowance**: Annual payment for prosthetic wear
- **Auto Grant**: Up to $28,000 for adaptive vehicle modifications

### For Developers

**CFR Structure:**
- **Part 3**: Who gets service connection and why
- **Part 4**: How much compensation they receive
- **M21-1**: How VA adjudicators make decisions

**Detection Logic:**
1. **Explicit**: Text says "SMC-K granted"
2. **Implicit**: Evidence meets CFR criteria (e.g., ED → SMC-K)
3. **Inferred**: M21-1 duty to maximize (P&T → DEA/CHAMPVA)

---

## 🐛 Known Issues & Limitations

### Current Limitations:
- CFR Part 4 Diagnostic Codes: Abbreviated list (expandable)
- M21-1 Rules: Core adjudication rules only (not comprehensive)
- Financial Planner: Intentionally excluded from CFR logic

### Future Enhancements:
- Confidence scoring for each extraction
- Validation and error detection
- Full diagnostic code database
- Comprehensive M21-1 rule set
- Automated test suite (1000+ scenarios)

---

## 📞 Support

For questions or issues:
1. Check `CFR_M21_UPGRADE_DOCUMENTATION.md` for detailed info
2. Review code comments in CFR knowledge base files
3. Test with `verify-defect-fixes.mjs` script

---

**Rally Forge Team** © 2026  
**Scanner Version**: 4.0.0-cfr-aware  
**Last Updated**: February 27, 2026
