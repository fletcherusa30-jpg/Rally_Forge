# Manual Entry Forms System
## VA Rating Decision & Service Treatment Records

**Status**: ✅ Complete & Tested (24/24 assertions passing)  
**Created**: February 2025  
**Components**: 3 React components + selector router + validation suite

---

## System Overview

The Manual Entry Forms System provides TWO completely separate data collection interfaces:

1. **VA Rating Decision Manual Entry** - For adjudicative data (ratings, denials, SC basis)
2. **Service Treatment Records Manual Entry** - For medical/chronological data (events, exposures, medical history)

### Key Design Principle

**Strict Field Separation**: No fields are shared between forms. Each collects only the data appropriate to its purpose.

---

## Component Architecture

### 1. ManualEntrySelector.jsx
**Purpose**: Router component that presents user with form selection and tracks completed entries

**Features**:
- Two radio buttons: "VA Rating Decision" | "Service Treatment Record"
- Conditional rendering of appropriate form based on selection
- Live count of submitted entries
- Back button to return to selector
- Summary of all completed submissions with timestamps

**Integration**:
```jsx
import { ManualEntrySelector } from './components/ManualEntrySelector';

<ManualEntrySelector onComplete={(entries) => {
  console.log('Saved entries:', entries);
}} />
```

### 2. VARatingDecisionManualEntry.jsx
**Purpose**: Collect adjudicative (rating decision) data only

**Schema** (16 fields total):

#### Section A: Condition Identification
- `conditionName` (required, string) - e.g., "PTSD", "Left knee"
- `diagnosticType` (required, enum) - disability | injury | symptom
- `pageNumber` (optional, string) - Document page reference

#### Section B: Rating & Effective Date
- `status` (required, enum) - Service Connected | Not Service Connected | Denied | Deferred
- `ratingPercent` (conditional, number) - REQUIRED if status = "Service Connected" (0-100%)
- `effectiveDate` (optional, date) - Can be retroactive

#### Section C: Service-Connection Basis
- `scBasis` (required, enum) - direct | secondary | aggravation | presumptive | 1151
- `secondaryTo` (conditional, string) - REQUIRED if scBasis = "secondary"
- `aggravationPercent` (conditional, number) - REQUIRED if scBasis = "aggravation"
- `isBilateral` (boolean) - Whether condition involves bilateral extremities
- `extremity` (conditional, enum) - left | right | both - REQUIRED if isBilateral = true
- `inferredIssue` (boolean) - Flag if scanner inferred the issue

#### Section D: Evidence & Rationale
- `scEvidence` (optional, text) - Evidence supporting service-connection
- `evidenceNotes` (optional, text) - Cite specific evidence/test results
- `rationaleSummary` (optional, text) - Explain adjudicative rationale
- `denialReason` (conditional, text) - REQUIRED if status = "Denied"

**Validation Rules** (5 rules):
1. ✅ `conditionName` - Always required
2. ✅ `status` === "Service Connected" → `ratingPercent` required
3. ✅ `status` === "Denied" → `denialReason` required
4. ✅ `scBasis` === "secondary" → `secondaryTo` required
5. ✅ `scBasis` === "aggravation" → `aggravationPercent` required

**Output Format**:
```javascript
{
  success: true,
  serviceConnected: [
    { condition: "PTSD", percentage: 70 },
    { condition: "Tinnitus", percentage: 10 }
  ],
  denied: [
    { condition: "Claimed condition" }
  ],
  allConditions: [/* full entries */],
  ratingCalculation: {
    calculatedCombinedRating: 73,
    conditions: [70, 10],
    hasBilateralPairs: false,
    calculationMethod: "Manual entry (38 CFR §4.25)"
  },
  extractionSummary: {
    totalServiceConnected: 2,
    totalDenied: 1,
    manualEntry: true,
    entryType: 'VA_RATING_DECISION'
  }
}
```

**Features**:
- Real-time validation with error messages
- Combined rating calculation (38 CFR §4.25 formula)
- Add/Remove entries
- Display current numbers: Service Connected count, Combined Rating
- Save & Process button to export data

### 3. STRManualEntry.jsx
**Purpose**: Collect medical/chronological (Service Treatment Record) data only

**Schema** (14 fields total):

#### Section A: Event Details
- `conditionName` (required, string) - e.g., "Knee injury", "Burn pit respiratory symptoms"
- `dateOfEvent` (required, date) - When the medical event occurred
- `type` (required, enum) - injury | illness | exposure | symptom
- `location` (optional, string) - e.g., "Camp Lejeune", "Kuwait"
- `severity` (optional, enum) - mild | moderate | severe | unknown

#### Section B: Medical Documentation
- `provider` (optional, string) - Medical provider name or facility
- `description` (required, text) - Detailed description of event/treatment

#### Section C: Exposure & Service Context
- `lineOfDuty` (required, enum) - Yes | No | Unknown
- `inServiceEvent` (boolean) - Confirmed as in-service event
- `exposureType` (conditional, enum) - agent orange | burn pits | radiation | asbestos | noise | other | null
- `MOSRelevant` (conditional, boolean) - REQUIRED if exposureType is selected

#### Section D: Chronicity & Continuity
- `chronicityEvidence` (optional, text) - Evidence of continuous/recurrent symptoms
- `continuityNotes` (conditional, text) - REQUIRED if chronicityEvidence is provided
- `nexusIndicators` (optional, text) - Evidence establishing nexus to service

**Validation Rules** (3 rules):
1. ✅ `conditionName` & `dateOfEvent` & `description` - Always required
2. ✅ `exposureType` selected → `MOSRelevant` must be evaluated
3. ✅ `chronicityEvidence` provided → `continuityNotes` required

**Output Format**:
```javascript
{
  success: true,
  records: [
    { condition: "PTSD", date: "2004-03-15", description: "Combat trauma" }
  ],
  allRecords: [/* full entries */],
  patientHistory: {
    totalMedicalEvents: 3,
    inServiceCount: 3,
    exposureEvents: 1,
    chronicConditions: 2
  },
  exposureSummary: {
    exposureTypes: ["burn pits", "agent orange"],
    MOSRelevantCount: 1
  },
  extractionSummary: {
    totalRecords: 3,
    manualEntry: true,
    entryType: 'SERVICE_TREATMENT_RECORD'
  }
}
```

**Features**:
- Real-time validation with conditional fields
- Conditional exposure type → MOS evaluation
- Conditional chronicity → continuity notes requirement
- Add/Remove records
- Display statistics: In-Service Events, Exposures Documented, Chronic Conditions
- Save & Process button to export data

---

## Field Separation Verification

### VA Rating Decision Fields (16 Total)
Adjudicative only - who gets service-connected, what rating, why?
```
conditionName, diagnosticType, pageNumber, status, ratingPercent, 
effectiveDate, isBilateral, extremity, scBasis, secondaryTo, 
aggravationPercent, inferredIssue, scEvidence, rationaleSummary,
evidenceNotes, denialReason
```

### STR Fields (14 Total)
Medical/chronological only - what happened, when, where, with whom?
```
conditionName, dateOfEvent, type, location, provider, description,
severity, lineOfDuty, MOSRelevant, exposureType, inServiceEvent,
chronicityEvidence, continuityNotes, nexusIndicators
```

### No Overlap
Zero shared adjudicative fields between forms
- VA adjudicative fields (`ratingPercent`, `scBasis`, `denialReason`, `isBilateral`, `extremity`) NOT in STR
- STR medical fields (`dateOfEvent`, `provider`, `severity`, `lineOfDuty`, `exposureType`) NOT in VA Rating

---

## Validation Rules

### VA Rating Decision (5 Rules)

| Rule | Condition | Action | Error Message |
|------|-----------|--------|----------------|
| 1 | Always | `conditionName` must not be empty | "Condition name is required" |
| 2 | `status` = SC | `ratingPercent` required | "Rating percent required for Service Connected conditions" |
| 3 | `status` = Denied | `denialReason` required | "Denial reason required for Denied conditions" |
| 4 | `scBasis` = secondary | `secondaryTo` required | "Primary condition required for secondary conditions" |
| 5 | `scBasis` = aggravation | `aggrevationPercent` required | "Aggravation percent required for aggravation claims" |

### STR (3 Rules)

| Rule | Condition | Action | Error Message |
|------|-----------|--------|----------------|
| 1 | Always | All three required: `conditionName`, `dateOfEvent`, `description` | "[field] is required" |
| 2 | `exposureType` = not null | `MOSRelevant` must be evaluated | "MOS relevance must be evaluated when exposure type is selected" |
| 3 | `chronicityEvidence` = not empty | `continuityNotes` required | "Continuity notes required when chronicity evidence is provided" |

---

## Combined Rating Calculation

For VA Rating Decision entries with multiple Service Connected conditions, the system automatically calculates combined rating using 38 CFR §4.25 formula:

```
Formula: Combined = First % + ((100 - First %) × Rest %) / 100

Example:
Ratings: 70%, 50%, 20%
Step 1: 70 + ((30) × 0.5) = 70 + 15 = 85%
Step 2: 85 + ((15) × 0.2) = 85 + 3 = 88%
Result: 88%
```

Implementation:
```javascript
const calculateCombined = () => {
  const ratings = entries
    .filter(c => c.status === 'Service Connected' && c.ratingPercent > 0)
    .map(c => c.ratingPercent)
    .sort((a, b) => b - a);
  
  if (ratings.length === 0) return 0;
  if (ratings.length === 1) return ratings[0];
  
  let combined = ratings[0];
  for (let i = 1; i < ratings.length; i++) {
    combined = Math.round(combined + ((100 - combined) * ratings[i]) / 100);
  }
  return combined;
};
```

---

## Browser Integration

### Using ManualEntrySelector in Parent Component

```jsx
import { ManualEntrySelector } from './components/ManualEntrySelector';

export function MyPage() {
  const handleEntryComplete = (entries) => {
    console.log('[MyPage] Received entries:', entries);
    // Send to backend API or process locally
  };

  return (
    <div>
      <h1>Manual Data Entry</h1>
      <ManualEntrySelector onComplete={handleEntryComplete} />
    </div>
  );
}
```

### Styling

All components follow dark theme consistent with existing app:
- Background: `#0f172a` (slate-900)
- Container: `#1e293b` (slate-800)
- Buttons: `#14b8a6` (teal-500)
- Text: `#cbd5e1` (slate-300)
- Errors: `#ef4444` (red-500)

---

## Test Coverage

**File**: `tests/test-manual-entry-forms.js`  
**Total Tests**: 24 assertions  
**Status**: ✅ All passing

### Test Categories

**VA Rating Validation** (7 tests)
- Condition name required
- Status=SC requires rating
- Status=Denied requires reason
- Secondary basis requires primary condition
- Aggravation basis requires percent
- Bilateral extremity handling
- Combined rating calculation

**STR Validation** (7 tests)
- Condition name required
- Date of event required
- Description required
- Exposure exposure type requires MOS evaluation
- Chronicity evidence requires continuity notes
- Line of duty status
- Exposure types validation

**Field Separation** (4 tests)
- VA has 16 adjudicative fields only
- STR has 14 medical/chronological fields only
- No shared adjudicative fields in STR
- No shared medical fields in VA

**Output Format** (2 tests)
- VA output includes rating calculation metadata
- STR output includes patient history metadata

**Validation Chaining** (4 tests)
- NSC doesn't require rating
- Severity optional with description
- Effective date optional but can be retroactive
- Multiple exposures tracked separately

### Running Tests

```bash
cd "c:\Dev\Rally Forge"
node tests/test-manual-entry-forms.js
```

Expected output:
```
✓ Passed: 24
✗ Failed: 0
✓✓✓ ALL TESTS PASSED ✓✓✓
```

---

## Data Flow Diagram

```
User Selection (ManualEntrySelector)
         ↓
    [Radio Buttons]
    /            \
   ↙              ↘
VA Rating      STR Entry
Decision          ↓
Form         Medical/Chronological
 ↓           Form
[16 adjudicative      [14 medical fields]
  fields]             No overlap!
 ↓                        ↓
Validation (5 rules)  Validation (3 rules)
 ↓                        ↓
Output: {            Output: {
  serviceConnected,    records,
  denied,              patientHistory,
  ratingCalculation    exposureSummary,
}                        }
```

---

## Common Use Cases

### Use Case 1: Manual VA Rating Decision Entry
**Scenario**: VA Decision document received but scanner couldn't parse it

1. Select "VA Rating Decision Manual Entry"
2. Enter condition: "Hypertension"
3. Set diagnostic type: "Disability"
4. Set status: "Service Connected"
5. Set rating: "20%"
6. Set SC basis: "Direct"
7. System auto-calculates: combined rating = 20% (single condition)
8. Click "Save & Process Entries"
9. Result includes rating calculation metadata

### Use Case 2: Manual STR Entry with Exposure
**Scenario**: Medical records from Camp Lejeune contamination claim

1. Select "Service Treatment Records Manual Entry"
2. Enter condition: "Rash"
3. Set date: "2006-03-15"
4. Set location: "Camp Lejeune, NC"
5. Set exposure type: "burn pits" → automatically requires MOS evaluation
6. Check "MOS Relevant to Exposure"
7. Enter description: "Unexplained skin rash during assignment"
8. System validates dependency: exposure requires MOS eval
9. Click "Save & Process Records"
10. Result includes exposure summary with MOS count

### Use Case 3: Multiple Conditions with Different SC Bases
**Scenario**: Service member with both direct SC and secondary SC conditions

**Entry 1**:
- Condition: "PTSD"
- Status: Service Connected
- Rating: 70%
- SC Basis: Direct

**Entry 2**:
- Condition: "Sleep Apnea"
- Status: Service Connected
- Rating: 50%
- SC Basis: Secondary
- Secondary To: "PTSD"

System calculates combined rating:
```
70% + ((30) × 0.5) = 70 + 15 = 85%
```

---

## Error Handling

### Validation Errors
Each field shows inline error message when validation fails:
```jsx
{errors.ratingPercent && (
  <span style={{ color: '#ef4444' }}>
    Rating percent required for Service Connected conditions
  </span>
)}
```

### Field Dependencies
Conditional fields only appear when parent condition is met:
```jsx
{newEntry.exposureType && (
  <div>
    <label>MOS Relevant to Exposure *</label>
    <input type="checkbox" ... />
  </div>
)}
```

---

## Production Deployment

### Pre-Deployment Checklist
- ✅ 24/24 tests passing
- ✅ Field separation verified (zero overlap)
- ✅ Combined rating calculation validated
- ✅ All validation rules implemented
- ✅ Component styling consistent
- ✅ Error messages user-friendly
- ✅ Documentation complete

### Backend Integration (Next Phase)
1. Create `/api/manual-entries/va-rating` endpoint
2. Create `/api/manual-entries/str` endpoint
3. Validate received data against schemas
4. Store in separate database tables
5. Index by type for later retrieval/merge with scanner results

---

## Related Documentation
- [`VA_SCANNER_MODEL_DESIGN.md`](VA_SCANNER_MODEL_DESIGN.md) - Overall system architecture
- [`DEPENDENT_EXTRACTION_AND_AUTO_RATES.md`](docs/DEPENDENT_EXTRACTION_AND_AUTO_RATES.md) - Dependent extraction system
- [`test-manual-entry-forms.js`](tests/test-manual-entry-forms.js) - Test suite

---

**Last Updated**: February 2025  
**Status**: Production Ready - All Tests Passing ✅
