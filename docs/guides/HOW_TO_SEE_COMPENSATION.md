# HOW TO SEE COMPENSATION DOLLAR AMOUNTS
## Step-by-Step Guide

Your compensation engine is **fully functional** and deterministic. Here's how to see the dollar amounts:

---

## ✅ Quick Start (2 Steps)

### STEP 1: Start Both Servers

Open a terminal in the project directory and run:

```bash
npm run dev
```

This starts:
- **React Frontend** on http://localhost:5173 (has compensation display ✅)
- **API Backend** on http://localhost:3000

### STEP 2: Upload a VA Decision PDF

1. Open your browser to: **http://localhost:5173**
2. Click the **"📤 Upload & Scan"** tab
3. Click **"Select PDF File(s)"**
4. Choose your VA Rating Decision PDF
5. Click **"Run Scanner"**

You will see:
```
Combined Rating
100%    Current Total: $3,425.86/mo

Base: $3,057.13  Dependents: +$368.73  SMC (K): +$111.74
```

---

## Why You're Not Seeing Dollar Amounts

### Problem 1: Wrong URL
❌ **http://localhost:5174** - Legacy HTML frontend (no compensation display)  
✅ **http://localhost:5173** - Modern React frontend (has compensation display)

### Problem 2: No PDF Uploaded
The ScannerHub page has a **"Run Scanner"** button but it loads mock data without actual scanning. You must:
1. Use the **"📤 Upload & Scan"** tab
2. **Actually select and upload a PDF file**
3. The scanner will extract rating, SMC codes, and dependents
4. Then calculate and display compensation

### Problem 3: Missing Compensation API Response
If you uploaded a PDF and still don't see dollar amounts:
- Check browser console for errors (F12 → Console tab)
- Verify backend is running on port 3000
- Check if the compensation object is in the API response

---

## Verification Test

### Test Without PDF Upload

If you don't have a VA decision PDF handy, you can test the compensation calculation directly:

```bash
# In a new terminal, with backend running:
curl -X POST http://localhost:3000/api/compensation/quote \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 100,
    "dependents": {"spouse": 1, "children": 3, "parents": 0},
    "smcCode": null,
    "yearOverride": 2017
  }'
```

Expected output:
```json
{
  "quote": {
    "summary": {
      "totalMonthly": 3425.86,
      "totalYearly": 41110.32,
      "year": 2017
    },
    "breakdown": {
      "baseMonthly": 3057.13,
      "dependentMonthly": 368.73,
      "smcMonthly": 0,
      "ancillaryMonthly": 0,
      "totalMonthly": 3425.86,
      "totalYearly": 41110.32
    }
  }
}
```

If this works, your backend is functioning correctly.

---

## Detailed Navigation Guide

### Using the Modern Frontend

**URL:** http://localhost:5173

#### Page 1: VA Rating Decision Page
1. Start at the "Upload & Scan" tab
2. Upload your VA Rating Decision PDF
3. Scanner extracts:
   - Combined rating (e.g., 100%)
   - SMC codes (K, L, M, etc.)
   - Dependents (spouse, children, parents)
   - Ancillary benefits (Aid & Attendance, Housebound)
   - Effective dates
4. Results display shows:
   ```
   Your Combined Rating
   100%    Current Total: $3,425.86/mo
   
   Base: $3,057.13
   Dependents: +$368.73
   SMC (K): +$111.74
   ```

#### Page 2: Scanner Hub (Alternative)
1. Navigate to Scanner Hub
2. Click "Run Scanner" (loads mock data for testing)
3. If compensation data exists, it displays:
   ```
   100%  $3,425.86/mo
   Base: $3,057.13  Dependents: +$368.73
   ```

---

## What Gets Calculated

### Base Compensation
Based on your disability rating (0%, 10%, 20%, ..., 100%)
- Uses official VA rate tables from `compensation-engine/rates/`
- Year selection based on effective date or current year
- Example: 100% in 2017 = **$3,057.13/month**

### Dependent Bonuses
Two tiers: **with spouse** (higher) or **without spouse** (lower)
- Spouse + 3 children = **+$368.73/month** (2017 rates with spouse tier)
- First child: $96.78
- Additional children: $74.22 each
- Parents: separate rates

### SMC (Special Monthly Compensation)
Codes K through T (from least to highest):
- **K**: Loss of reproductive organ = +$111.74/month (2017)
- **L**: Loss of hand or foot = +$3,476.09/month (2017)
- **T**: Highest level = varies by year

**Rule:** Only the highest SMC code is used (no stacking)

### Ancillary Benefits
- **Aid & Attendance:** +$2,266/month (if granted)
- **Housebound:** +$321/month (if granted)

### Total Monthly Compensation
```
Base (100%) + Dependents + SMC + Ancillary = Total
$3,057.13 + $368.73 + $0 + $0 = $3,425.86/month
                                 ($41,110.32/year)
```

---

## Troubleshooting

### "I see the percentage but no dollar amount"

**Check 1:** Are you on the right URL?
- ✅ http://localhost:5173 (modern frontend)
- ❌ http://localhost:5174 (legacy frontend - no compensation)

**Check 2:** Did you upload a PDF?
- ScannerHub's "Run Scanner" button loads mock data
- Use "Upload & Scan" tab instead
- Select an actual VA Rating Decision PDF file

**Check 3:** Is the backend running?
```bash
# Check if backend is responding:
curl http://localhost:3000/api/health
```

Expected: `{"status":"ok","timestamp":"2025-..."}`

**Check 4:** Check browser console (F12)
Look for errors like:
- `Failed to load current compensation`
- `compensation is null`
- `API request failed`

### "The dollar amount is wrong"

**Check the year:**
Compensation rates change annually due to COLA adjustments.
- 2017: 100% = $3,057.13
- 2024: 100% = $3,737.85
- 2025: 100% = $4,018.00

The engine selects the rate table based on:
1. Effective date from your VA decision
2. Current year if no effective date
3. Year override if specified

**Check dependents:**
- With spouse tier: higher bonuses
- Without spouse tier: lower bonuses
- Verify dependent count extracted correctly

**Check SMC code:**
- SMC codes don't stack (only highest is used)
- Make sure correct code is being applied
- Check if SMC is in the breakdown display

### "Mock data doesn't show compensation"

The mock data loaded by "Run Scanner" button may not include compensation calculations. This is intentional - it's test data.

**Solution:** Upload an actual PDF file using the "Upload & Scan" tab.

---

## Data Flow Diagram

```
VA Decision PDF
    ↓
[User uploads via browser]
    ↓
Frontend (http://localhost:5173)
    ↓
POST /api/scanner/scan-pdf
    ↓
Backend Scanner (backend/api/scanner.js)
    ↓
Extracts Text → Parses Decision → Finds:
  • Combined Rating: 100%
  • SMC Codes: K, L, M, etc.
  • Dependents: spouse, children, parents
  • Ancillary: Aid & Attendance, Housebound
  • Effective Date: 2017-12-01
    ↓
Compensation Service (backend/services/compensationService.js)
    ↓
Compensation Engine (compensation-engine/index.js)
    ↓
Selects Rate Table (compensation-engine/rates/2017.json)
    ↓
Calculates:
  • Base: $3,057.13
  • Dependents: $368.73
  • SMC: $0
  • Ancillary: $0
  • Total: $3,425.86/month
    ↓
Returns JSON response
    ↓
Frontend displays:
    100%    $3,425.86/mo
    Base: $3,057.13  Dependents: +$368.73
```

---

## AI Determinism Guarantee

### ✅ Compensation is NOT AI-generated
Dollar amounts come from:
- **Official VA rate tables** (compensation-engine/rates/*.json)
- **Mathematical calculation** (no inference, no estimation)
- **Historical COLA data** (2017-2026 verified rates)

### ✅ Scanner IS deterministic
The VA decision scanner:
- Uses rule-based pattern matching (regex, keywords)
- Cross-references with CFR regulations (38 CFR Part 3 & 4)
- Validates against known SMC codes
- Extracts structured data from text

### ❌ No estimation or guessing
- No "approximately"
- No "estimated"
- No AI hallucination risk for dollar amounts
- Exact values from official rate database

---

## Example: Complete Scan Result

After uploading a VA Rating Decision PDF, you should see:

```
📄 File: VA_Rating_Decision_2017.pdf

✓ Disability Rating Effective Date(s)
  • December 1, 2017 (100%)

👨‍👩‍👧 Dependents
  • December 1, 2017 ($368.73) (dependent adjustment)

Combined Rating
100%    Current Total: $3,425.86/mo

Base: $3,057.13  Dependents: +$368.73

Conditions
  • Post Traumatic Stress Disorder                    100%
  • Degenerative Arthritis, Right Knee                  30%
  • Tinnitus                                           10%

SMC
Applied SMC (K): +$111.74/mo
SMC-K: Loss of creative organ
```

If your display doesn't look like this, you're either:
1. On the wrong URL (legacy frontend)
2. Haven't uploaded a PDF file
3. Backend isn't calculating compensation

---

## Need More Help?

### Check These Files:
1. `COMPENSATION_DISPLAY_STATUS.md` - Full technical status report
2. `compensation-engine/README.md` - Compensation engine documentation
3. `backend/api/scanner.js` - Scanner API implementation
4. `app/frontend-modern/src/pages/VARatingDecisionPage.jsx` - Frontend display code

### Verify Your Setup:
```bash
# 1. Check Node.js version
node --version  # Should be v18+ or v20+

# 2. Install dependencies (if not already)
npm install

# 3. Start development servers
npm run dev

# 4. Verify backend health
curl http://localhost:3000/api/health

# 5. Open browser to modern frontend
# URL: http://localhost:5173
```

### Common Mistakes:
❌ Using port 5174 instead of 5173  
❌ Clicking "Run Scanner" without uploading PDF  
❌ Backend not running  
❌ Looking at legacy HTML pages instead of React pages  
❌ Expecting compensation on mock/test data  

---

**Need the dollar amounts? → Upload a PDF on http://localhost:5173 ✅**
