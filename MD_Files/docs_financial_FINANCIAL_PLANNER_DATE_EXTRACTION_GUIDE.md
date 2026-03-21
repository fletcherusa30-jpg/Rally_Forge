# Financial Planner & Date Extraction - Quick Start Guide

**Version**: 1.0  
**Date**: February 27, 2026  
**Audience**: Veterans, Veterans Service Officers, Developers

---

## Table of Contents

1. [What's New](#whats-new)
2. [Financial Planner Tab - Getting Started](#financial-planner-tab---getting-started)
3. [Rating Date Extraction - User Guide](#rating-date-extraction---user-guide)
4. [Scanner Date Display - What to Expect](#scanner-date-display---what-to-expect)
5. [Troubleshooting](#troubleshooting)
6. [Developer Guide](#developer-guide)

---

## What's New

### 1. Financial Planner Tab 🎯

**Location**: Top navigation bar, immediately after "AI Advisor"

**Purpose**: Module for analyzing VA financial benefits, retirement planning, and disability compensation forecasts

**Status**: ✅ Available now

### 2. Rating Decision Date & Effective Dates 📅

**Location**: Top of Scanner Results panel

**Purpose**: Extract and display important dates from VA rating decisions:
- **Rating Decision Date**: When VA made the decision
- **Effective Date(s)**: When benefits began or changed

**Status**: ✅ Available now for all PDF and text file uploads

---

## Financial Planner Tab - Getting Started

### Accessing the Financial Planner

1. **Open Rally Forge application**
   - Navigate to http://localhost:5173 (if running locally)
   - Or access your deployed server URL

2. **Click the Financial Planner tab**
   - Located in the top navigation bar
   - Appears between "AI Advisor" and the right edge
   - Label: "💼 Financial Planner" or "Financial Planner"

3. **View the Status Message**
   ```
   Financial Planner module is loaded and ready for financial analysis 
   and retirement planning.
   ```

### Where to Find It in VS Code

If you're a developer:

**VS Code Explorer** (left sidebar):
```
Rally Forge                    ← Main workspace
├── backend/
├── app/
├── VA SCANNER/
└── ...

Financial Planner             ← Dedicated top-level folder
├── financial-engine.js
├── financial-planner.html
├── financial-style.css
├── FinancialPlanner.md
└── README.md
```

The Financial Planner appears as a **separate workspace folder**, not nested under any other module.

---

## Rating Date Extraction - User Guide

### What Gets Extracted

When you upload a VA rating decision (PDF or text), the scanner now extracts:

**1. Rating Decision Date**
- The date VA made the rating decision
- Examples of what the system recognizes:
  - "Rating Decision dated January 15, 2026"
  - "This decision is dated January 15, 2026"
  - "Date of Decision: January 15, 2026"

**2. Effective Date(s)**
- The date(s) when benefits become effective
- Examples of what the system recognizes:
  - "Effective Date: January 15, 2026"
  - "Your benefits are effective January 15, 2026"
  - "The effective date for this evaluation is January 15, 2026"
  - "We assigned an effective date of January 15, 2026"

**3. Multiple Effective Dates**
- If the decision mentions multiple effective dates (e.g., increase effective on a different date)
- Example:
  ```
  Original Rating Decision Date: January 15, 2026
  Effective Date 1: January 15, 2026 (initial rating)
  Effective Date 2: March 01, 2026 (rating increase)
  Effective Date 3: May 15, 2026 (additional condition)
  ```

### How to Use It

1. **Upload your rating decision**
   - Click "Upload & Scan" tab
   - Select your PDF or text file
   - Click "Run Scanner"

2. **View the extracted dates**
   - After scan completes, look for the date section:
     ```
     📅 Rating Decision Date:
        January 15, 2026
     
     ✓ Effective Date(s):
        • January 15, 2026
        • March 01, 2026
     ```

3. **Use the dates**
   - Note the dates for your records
   - Verify they match your physical decision letter
   - Report any discrepancies if dates are missing

### If Dates Are Missing

If the system shows:
```
📅 Rating Decision Date:
   Not found in document

✓ Effective Date(s):
   Not found in document
```

**This means**:
- The document doesn't match VA formatting patterns
- The PDF may be a non-standard format
- The document might be corrupted or scanned poorly

**What to do**:
1. Manually check your physical decision letter for these dates
2. Note them separately
3. Try uploading a clearer/better scanned version

---

## Scanner Date Display - What to Expect

### Results Panel Layout

When you scan a document, results appear in this order:

```
═══════════════════════════════════════
📄 ClaimLetter-2017-12-15.pdf
⏱️ Scanned in 245ms

═══════════════════════════════════════
📅 Rating Decision Date:           ← NEW
   January 15, 2026

✓ Effective Date(s):              ← NEW
   • January 15, 2026

═══════════════════════════════════════
Combined Rating:
90%

═══════════════════════════════════════
✓ Service Connected (23)
├ Right shoulder rotator cuff (20%)
├ Tinnitus (10%)
└ [20 more...]

╳ Denied (2)
├ Lower back pain
└ Migraine headaches

═══════════════════════════════════════
```

### Date Format Examples

The system recognizes and displays dates in these formats:

| Format | Example | Extracted As |
|--------|---------|---|
| Month Day, Year | January 15, 2026 | January 15, 2026 |
| MM/DD/YYYY | 01/15/2026 | January 15, 2026 |
| YYYY-MM-DD | 2026-01-15 | January 15, 2026 |
| Day Month Year | 15 January 2026 | January 15, 2026 |

---

## Troubleshooting

### "Rating Decision Date: Not found in document"

**Possible Causes**:
1. Document is not a VA rating decision
2. Document formatting doesn't match expected patterns
3. PDF is corrupted or unclear
4. Document is a denial notice (may have different format)

**Solutions**:
1. ✓ Check that you uploaded the correct document
2. ✓ Try uploading a clearer scan (at least 300 DPI)
3. ✓ Verify the original letter has a visible decision date
4. ✓ Try converting PDF to text and re-uploading

### "Effective Date(s): Not found in document"

**Possible Causes**:
1. Document doesn't specify effective dates
2. Effective dates are in a non-standard format
3. Document is incomplete

**Solutions**:
1. ✓ Check your physical letter for "Effective Date" or "Effective"
2. ✓ Look for dates near benefit descriptions
3. ✓ Try uploading a complete/full document

### Dates Appear But Seem Wrong

**What to check**:
1. Verify the date matches your physical letter
2. Look for multiple decision dates if there was an appeal
3. Check if document shows date ranges

**If still wrong**:
1. Note the discrepancy
2. File a correction with VA
3. Report the issue to your VSO

---

## Developer Guide

### API Response Format

When you call the scanner API, dates are included in the response:

```javascript
{
  "success": true,
  "data": {
    "metadata": {
      "ratingDecisionDate": "January 15, 2026",
      "effectiveDate": "January 15, 2026",
      "allEffectiveDates": [
        "January 15, 2026",
        "March 01, 2026"
      ],
      "combinedRating": "90%",
      "veteranName": "John Q Veteran",
      "fileNumber": "123456789"
    },
    "serviceConnected": [...],
    "denied": [...],
    "ratingCalculation": {...}
  }
}
```

### Using the Metadata in Your Code

```javascript
// Frontend example
const response = await fetch('/api/scanner/scan-pdf', {
  method: 'POST',
  body: formData
});

const result = await response.json();
const { ratingDecisionDate, allEffectiveDates } = result.data.metadata;

console.log(`Decision made on: ${ratingDecisionDate}`);
console.log(`Benefits effective on: ${allEffectiveDates.join(', ')}`);
```

### Accessing Metadata in Components

```jsx
// React Component
function ScanResults({ result }) {
  return (
    <div>
      <h3>Important Dates</h3>
      <p>Rating Decision: {result.metadata?.ratingDecisionDate || 'Not found'}</p>
      {result.metadata?.allEffectiveDates?.map(date => (
        <p key={date}>Effective: {date}</p>
      ))}
    </div>
  );
}
```

### API Endpoints

**POST /api/scanner/scan-pdf**
```javascript
// Request
{
  file: File  // PDF file from form upload
}

// Response includes metadata with:
// - ratingDecisionDate
// - effectiveDate
// - allEffectiveDates
```

**POST /api/scanner/scan-text**
```javascript
// Request
{
  text: string  // Raw text content
}

// Response includes metadata with:
// - ratingDecisionDate
// - effectiveDate
// - allEffectiveDates
```

### Custom Date Parsing

To extract dates from custom formats, modify `extractMetadata()` in:
```
VA SCANNER/engine/vaSuperScanner.js
```

Current patterns:
```javascript
const ratingDecisionDate =
  (text.match(/Rating Decision\s+(?:D|d)ated[:\s]+([A-Z][a-z]+ \d{1,2}, \d{4})/i) || [])[1] ||
  (text.match(/This decision is dated[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i) || [])[1] ||
  // ... more patterns
```

Add your custom patterns as additional OR conditions.

### Testing Date Extraction

```javascript
// Test file: test-date-extraction.js
import { scanVaDecision } from './VA SCANNER/engine/vaSuperScanner.js';

const testText = `
VA RATING DECISION
This decision is dated January 15, 2026
File Number: 123456789

Effective Date: January 15, 2026
The effective date for this evaluation is February 01, 2026

Service Connected Conditions:
1. Tinnitus, 10%, effective January 15, 2026
`;

const result = scanVaDecision(testText);
console.log('Extracted Dates:');
console.log('- Rating Decision:', result.metadata.ratingDecisionDate);
console.log('- Effective Dates:', result.metadata.allEffectiveDates);
```

---

## Integration with Financial Planner

### Proposed Future Enhancement

Once Financial Planner module is built out, it could use extracted dates for:

1. **Benefit Timeline Analysis**
   - Show timeline of rating changes
   - Calculate total retroactive benefits
   - Project future payment amounts

2. **Financial Planning**
   - Use effective dates to calculate exact benefit periods
   - Plan retirement using accurate payment start dates
   - Calculate family member benefits from correct dates

3. **Compliance Tracking**
   - Verify dates match between uploaded docs
   - Flag suspicious effective dates
   - Audit trail of decision dates

---

## FAQ

**Q: Can the system extract dates from images or scanned PDFs?**  
A: Yes! The system first converts PDFs to text (using built-in PDF extraction), then applies date patterns.

**Q: What if my document has handwritten dates?**  
A: The system requires machine-readable text. If your PDF is handwritten, you'll need a clearer scan or OCR conversion.

**Q: Does the system validate that dates make sense?**  
A: Currently no, but that's a planned enhancement. Always verify dates match your letter.

**Q: Can I manually input dates if extraction fails?**  
A: Yes! Use the "Manual Entry" tab to create conditions with specific dates.

**Q: Are extracted dates stored securely?**  
A: Yes, all data follows VA security standards and is protected like all other veteran information.

---

## Support & Feedback

**Issues or Suggestions?**

1. Check the troubleshooting section above
2. Verify your document format matches VA standards
3. Contact your Veterans Service Officer
4. Report bugs to the development team with:
   - Document example (redacted personal info)
   - Expected dates
   - Actual results

---

## Related Documentation

- [CFR M21 Upgrade Documentation](./CFR_M21_UPGRADE_DOCUMENTATION.md) - Technical details on CFR compliance
- [Cleanup Strategy](./CLEANUP_STRATEGY.md) - Safe cleanup guidelines
- [Enhancement Summary](./ENHANCEMENT_SUMMARY_2026-02-27.md) - Complete list of changes

---

**Version**: 1.0  
**Last Updated**: February 27, 2026  
**Status**: ✅ Ready for Production
