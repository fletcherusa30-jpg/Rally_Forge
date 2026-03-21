# VA Rating Decision Scanner — Design & Modernization Specification

**Location:** `backend/va_scanner/backend/shared/scanner/ratingDecision/`

**Version:** 2.0  
**Last Updated:** March 17, 2026

---

## 1. Purpose

Extract all service-connected ratings, denials, effective dates, diagnostic codes, and SMC (Special Monthly Compensation) from VA Rating Decision documents. Determine VA disability compensation eligibility and amounts.

---

## 2. Document Types Supported

- Initial Rating Decision (first claim)
- Reration (rating increase/decrease)
- Supplemental Rating Decision (new evidence)
- Rating Reduction (rerate lower)
- Assumed Granted Decision
- Deferred Decision
- Multi-page Rating Decisions (common for complex cases)
- Legacy format (pre-2010s)
- Modern format (post-2010s)

---

## 3. Required Extraction Fields

**Combined Rating:**
- Final combined rating percentage (10%, 20%, ..., 100%)
- Effective date of combined rating

**Individual Conditions (Service-Connected):**
- Condition name/description
- Current assigned percentage (10%, 20%, ..., 100%)
- Effective date (when rating became effective)
- Diagnostic code (DC)
- Reason for rating decision
- Prior rating (if rerate)
- Prior effective date

**Denied Conditions:**
- Condition name as claimed
- Reason for denial (e.g., "Not service connected", "Insufficient evidence")
- Evidence considered/not considered

**Special Monthly Compensation (SMC):**
- SMC code (K, K1, L, M, N, O, P, Q, R, S, T)
- SMC effective date
- Reason for SMC award
- Prior SMC (if changed)

**Bilateral Factor:**
- Bilateral factor percentage (if applicable)
- Conditions involved
- Effective date

**Other Required Data:**
- Deferred issues (not yet rated)
- Proposed reductions (with reason)
- Favorable findings
- Unfavorable findings
- Appeal rights/deadlines
- Claim number
- Decision date
- Prior decision reference (if rerate)

---

## 4. Optional Extraction Fields

- Inferred claims (conditions identified but not claimed)
- Secondary conditions
- Comorbidity impact on ratings
- Schedule rating tables referenced
- Examiner medical opinion
- DBQ (Disability Benefits Questionnaire) references
- Presumptive condition flags
- Effective back pay (retroactive award date)
- Award notice details

---

## 5. Rules

### Document Format Detection
1. **Identify decision type:**
   - Initial vs Rerate vs Supplemental
   - Single vs Multi-condition
   - Legacy vs Modern format

2. **Detect layout:**
   - Single-column vs multi-column PDF
   - Structured table vs narrative text
   - Header/footer content

### Condition Rating Rules
1. **Extract each condition:**
   - Condition name (first line of section)
   - Current rating percentage
   - Effective date
   - Diagnostic code (6-digit number)
   - Prior rating (if shown)

2. **Service-connection determination:**
   - "Service-connected" flag present
   - Condition in service-connected table
   - Not in denied section

3. **Rating rationale:**
   - VA Schedule rating basis
   - Authority/regulations cited
   - Special circumstances

### Denial Rules
1. **Extract denied conditions:**
   - Condition name as claimed
   - "Not service-connected" reason
   - "Insufficient evidence" reason
   - "Already rated" reason

2. **Document evidence considered:**
   - Medical records reviewed
   - Medical examination results
   - Arguments considered

### SMC Rules
1. **Identify SMC award:**
   - SMC codes appear separately from ratings
   - Effective date often differs from rating date
   - Reason statements (e.g., "loss of use of both hands")

2. **Map SMC codes:**
   - A, A1, A2: Aid & Attendance
   - H, H1, H2: Housebound
   - K, K1: Loss of use of one extremity
   - L, M, N, O, P, Q, R, S, T: Progressive SMC levels

### Bilateral Factor Rules
1. **Identify bilateral applicability:**
   - Two extremities affected
   - Percentage applied to combined rating
   - Effective date

### Deferred Issues Rules
1. **Extract deferred conditions:**
   - Condition description
   - Defer date
   - Scheduled exam date/reason
   - Follow-up action

### Effective Date Rules
1. **Calculate retroactive dates:**
   - Claim effective date (earliest date VA can award)
   - Rating effective date (when rating begins)
   - Back pay calculation
   - Appeal effective dates

---

## 6. Validators

### Percentage Validators
- Rating percentages: 0%, 10%, 20%, ..., 100%
- SMC percentages: Must align with individual ratings
- Combined rating: Must match VA Combined Rating Table
- Bilateral factor: 10% max additional

### Diagnostic Code Validators
- 6-digit format
- Valid DC in VA Disability Rating Schedule
- Appropriate for claimed condition

### Date Validators
- Effective date within reasonable range (not future)
- Effective date before decision date
- Multiple effective dates ordered chronologically
- Back pay date calculation accurate

### SMC Code Validators
- Valid SMC code: A, A1, A2, H, H1, H2, K, K1, L, M, N, O, P, Q, R, S, T
- SMC effective date present
- SMC rating requirements met (e.g., K requires 50%+ rating)

### Ratings Consistency
- Individual ratings don't exceed 100%
- Combined rating matches individual ratings per VA formula
- No rating > 10% for non-service-connected condition
- SMC awarded only for SC conditions

---

## 7. Transforms

### Combined Rating Calculation
1. **VA Combined Rating Formula:**
   - Start with highest rating (e.g., 60%)
   - Calculate non-compensable fraction (40%)
   - Apply next condition to non-compensable (e.g., 30% of 40% = 12%)
   - Combined becomes 60% + 12% = 72%
   - Continue until all conditions applied

2. **Rounding rules:**
   - Round up 0.5 and above
   - Standard rounding to nearest 10%

### Diagnostic Code Mapping
1. Map diagnostic codes to condition names
2. Identify presumptive conditions by code
3. Link to VA Schedule for future reference

### SMC to Compensation Transform
1. Map SMC code to monthly dollar amount
2. SMC amount often exceeds base rating compensation
3. Example: SMC K = additional comp on top of rating

### Bilateral Factor Transform
1. Calculate additional percentage
2. Apply to combined rating
3. Compute compensation impact

### Back Pay Calculation
1. Effective date → back pay start date
2. Back pay period = decision date - effective date
3. Monthly compensation during back pay period

### Rerate Impact
1. Compare prior rating to new rating
2. Calculate increase/decrease amount
3. Identify rating changes and reasons

### Appeal Rights Extraction
1. Time limit for appeal (typically 1 year)
2. Higher-level review vs appeal
3. Supplemental claim option

---

## 8. Expected Folder Structure

```
backend/va_scanner/backend/shared/scanner/ratingDecision/
├── index.js                              # Module exports
├── vaDecisionScanner.js                  # Main scanner entry
├── ratingDecisionAnalysis.js             # Analysis engine
├── cueAnalysis.js                        # Contextual analysis
├── config.json                           # Scanner metadata & versioning
├── schema/
│   ├── rating-decision-condition.schema.json
│   ├── rating-decision-smc.schema.json
│   └── rating-decision-output.schema.json
├── rules/
│   ├── rating_extraction_rules.json
│   ├── rating_validation_rules.json
│   └── smc_rules.json
├── validators/
│   ├── rating_validators.js              # Main validation pipeline
│   ├── diagnosticCodeValidator.js        # DC validation
│   ├── smcValidator.js                   # SMC code validation
│   └── combinedRatingValidator.js        # Combined rating verification
├── transforms/
│   ├── combinedRatingCalculator.js       # Multi-condition rating
│   ├── bilateralFactorCalculator.js      # Bilateral computation
│   └── backPayCalculator.js              # Retroactive compensation
└── databases/
    ├── diagnosticCodes.json              # 6-digit DC mappings
    ├── smcCodes.json                     # SMC code amounts
    ├── scheduleRatings.json              # VA Schedule tables
    └── presumptiveMappings.json          # Presumptive condition mappings
```

---

## 9. Required Files

**Currently Exist:**
- `index.js`
- `vaDecisionScanner.js`
- `ratingDecisionAnalysis.js`
- `cueAnalysis.js`

**Must Exist:**
- `config.json`
- `schema/rating-decision-condition.schema.json`
- `schema/rating-decision-smc.schema.json`
- `schema/rating-decision-output.schema.json`
- `rules/rating_extraction_rules.json`
- `rules/rating_validation_rules.json`
- `rules/smc_rules.json`
- `validators/rating_validators.js`
- `validators/diagnosticCodeValidator.js`
- `validators/smcValidator.js`
- `validators/combinedRatingValidator.js`
- `transforms/combinedRatingCalculator.js`
- `transforms/bilateralFactorCalculator.js`
- `transforms/backPayCalculator.js`
- `databases/diagnosticCodes.json`
- `databases/smcCodes.json`
- `databases/scheduleRatings.json`
- `databases/presumptiveMappings.json`

---

## 10. Modernization Requirements

### Code Quality
1. JSDoc with @param, @returns, @throws
2. Strict mode
3. Structured logging at each pipeline stage
4. Input validation
5. Typed error handling

### Configuration
1. `config.json` must include:
   ```json
   {
     "name": "VA Rating Decision Scanner",
     "version": "2.0.0",
     "description": "Extracts service-connected ratings, SMC, denials, and compensation from VA Rating Decisions",
     "lastUpdated": "2026-03-17T00:00:00Z",
     "extractionPipeline": [
       "Document format detection",
       "Layout analysis",
       "Condition extraction",
       "Rating extraction",
       "SMC extraction",
       "Denial extraction",
       "Bilateral factor extraction",
       "Combined rating calculation",
       "Back pay calculation",
       "Effective date normalization",
       "Cross-validation",
       "Output normalization"
     ],
     "supportedDecisionTypes": ["Initial", "Rerate", "Supplemental", "Reduction"],
     "requiredFields": [...],
     "optionalFields": [...]
   }
   ```

2. Database files must include versioning and update dates

### Metadata Injection
1. Add `_metadata` including:
   - Scanner version
   - Document analysis date
   - Decision type
   - Combined rating
   - Service-connected condition count
   - Denied condition count
   - SMC awarded (yes/no)
   - Back pay period (if applicable)
   - Confidence overall + byField
   - Validation status

---

## 11. Error Handling Requirements

### Graceful Degradation
1. Multi-column PDF → parse column-by-column
2. Missing diagnostic code → extract via condition name
3. Unclear SMC → extract with confidence flag
4. Illegible effective date → parse nearby dates for context

### Error Categories

**Critical:**
- Cannot identify as Rating Decision
- No conditions extracted
- No combined rating found

**Warnings:**
- Combined rating doesn't match individual ratings
- SMC code not recognized
- Effective date appears future-dated
- Multi-column layout challenging

**Info:**
- Decision type identified
- Back pay period calculated
- Total service-connected conditions: N
- Presumptive conditions detected

---

## 12. Test Cases

### Core Extraction
1. **Single condition, initial rating**
2. **Multi-condition with different effective dates**
3. **Rerate (prior rating displayed)**
4. **Denial-heavy decision (10 denied, 2 awarded)**
5. **SMC decision (K-level with back pay)**
6. **Bilateral decision (both legs)**

### Rating Validation
7. **Combined rating verification:** Individual ratings validate combined
8. **SMC eligibility:** SMC only with eligible rating %
9. **Retroactive effective date:** Back pay calculated correctly
10. **Rerate comparison:** Prior vs new rating identified

### Format Handling
11. **Multi-column layout**
12. **Multi-page decision**
13. **Legacy format (pre-2010)**
14. **Modern format**

### Edge Cases
15. **Deferred issue (no rating yet, scheduled exam)**
16. **Proposed reduction (new rerate pending)**
17. **Multiple effective dates** (different conditions effective at different times)
18. **0% rating** (not service-connected but documented)

---

## 13. Sample Input

### Input: Scanned Multi-Page Rating Decision PDF

**Page 1:**
```
DEPARTMENT OF VETERANS AFFAIRS
RATING DECISION

Claim #: 123-45-6789
Decision Date: 15 MAR 2026
Veteran: SMITH, JOHN MICHAEL

RATING DECISION

The following conditions are service-connected:

1. Knee condition (right), post-surgical
   Evaluation: 30%      Effective Date: 01 MAR 2023
   Diagnostic Code: 5099-8999
   Previous Evaluation: 20% effective 01 JAN 2022
   Rationale: Increase based on recent orthopedic examination and functional limitation

2. Tinnitus, bilateral
   Evaluation: 10%      Effective Date: 01 MAR 2023
   Diagnostic Code: 6260-6204
   Rationale: Per VA Schedule, persistent bilateral tinnitus at 10%

3. Hypertension, essential
   Evaluation: 10%      Effective Date: 01 MAR 2026
   Diagnostic Code: 7101-7101
   Rationale: Service-connected on initial claim; meets Schedule requirements

COMBINED RATING: 40%   Effective Date: 01 MAR 2023
(Calculated per VA Combined Rating Table)

Previous Combined Rating: 30% effective 01 JAN 2022

SPECIAL MONTHLY COMPENSATION:
SMC Code K - Bilateral loss of use of lower extremities (effective 01 MAR 2026)
Monthly Award: $1,087.31

DENIALS:
The following conditions are NOT service-connected:

1. Claimed: "Anxiety disorder"
   Reason: Insufficient medical evidence to establish service connection
   Evidence Reviewed: Submitted treatment records do not establish in-service origin

RETROACTIVE AWARDS:
Back pay period: 01 MAR 2023 - 15 MAR 2026 = 3 years
Monthly compensation during back pay period: $892.45 (30% + prior SMC rates)
Total back pay due: $32,128.20

[Page 2 continues with detailed rating rationale and appeal rights...]
```

---

## 14. Sample Output

### Output: Structured JSON

```json
{
  "success": true,
  "data": {
    "decisionMetadata": {
      "claimNumber": "123-45-6789",
      "decisionDate": "2026-03-15",
      "veteranName": "Smith, John Michael",
      "decisionType": "rerate"
    },
    "serviceConnectedConditions": [
      {
        "id": "sc-001",
        "conditionName": "Knee condition (right), post-surgical",
        "diagnosticCode": "5099-8999",
        "currentRating": "30%",
        "effectiveDate": "2023-03-01",
        "previousRating": "20%",
        "previousEffectiveDate": "2022-01-01",
        "rationale": "Increase based on recent orthopedic examination and functional limitation",
        "ratingChangeType": "increase",
        "scheduleReference": "VA Schedule, Part IV - 5099-8999"
      },
      {
        "id": "sc-002",
        "conditionName": "Tinnitus, bilateral",
        "diagnosticCode": "6260-6204",
        "currentRating": "10%",
        "effectiveDate": "2023-03-01",
        "rationale": "Per VA Schedule, persistent bilateral tinnitus at 10%"
      },
      {
        "id": "sc-003",
        "conditionName": "Hypertension, essential",
        "diagnosticCode": "7101-7101",
        "currentRating": "10%",
        "effectiveDate": "2026-03-01",
        "rationale": "Service-connected on initial claim; meets Schedule requirements"
      }
    ],
    "deniedConditions": [
      {
        "claimedCondition": "Anxiety disorder",
        "denialReason": "Insufficient medical evidence to establish service connection",
        "evidenceConsidered": ["Submitted treatment records"]
      }
    ],
    "ratingCalculation": {
      "individualRatings": [
        { "condition": "Knee", "rating": 30 },
        { "condition": "Tinnitus", "rating": 10 },
        { "condition": "Hypertension", "rating": 10 }
      ],
      "combinedRating": "40%",
      "combinedRatingEffectiveDate": "2023-03-01",
      "previousCombinedRating": "30%",
      "bilateralFactor": {
        "applied": true,
        "percentage": "10%",
        "reason": "Bilateral loss of use of lower extremities"
      }
    },
    "specialMonthlyCompensation": {
      "awarded": true,
      "smcCode": "K",
      "smcCodeDescription": "Bilateral loss of use of lower extremities",
      "monthlyAmount": 1087.31,
      "effectiveDate": "2026-03-01",
      "previousSmc": null
    },
    "retroactiveAward": {
      "backPayStart": "2023-03-01",
      "backPayEnd": "2026-03-15",
      "backPayMonths": 36,
      "monthlyCompensationDuringBackPay": 892.45,
      "totalBackPayDue": 32128.20
    },
    "compensation": {
      "currentMonthly": 1087.31,
      "currentYearly": 13047.72,
      "ratingChangeImpact": "Increased from 30% to 40%"
    },
    "_metadata": {
      "scannerId": "va-rating-decision-v2.0.0",
      "scanDate": "2026-03-17T14:30:00Z",
      "docFormat": "modern",
      "decisionType": "rerate",
      "decisionPages": 2,
      "serviceConnectedCount": 3,
      "deniedCount": 1,
      "deferredCount": 0,
      "smcAwarded": true,
      "backPayCalculated": true,
      "confidence": {
        "overall": 0.98,
        "ratings": 0.99,
        "smcDetection": 0.97,
        "combinedRatingCalc": 0.99
      },
      "warnings": [],
      "validationStatus": "passed"
    }
  }
}
```

---

## 15. Known Edge Cases

1. **Multi-page decisions:** Conditions span page boundary
2. **0% ratings:** Not service-connected but formally documented
3. **Deferred issues:** Scheduled exam, no current rating
4. **Proposed reductions:** Anticipated future change
5. **Multiple effective dates:** Different conditions effective at different times
6. **Retroactive decisions:** Decision made years after service separation
7. **Legacy formats:** Pre-standardization format variations
8. **SMC offset:** SMC may offset base rating compensation in some cases
9. **Bilateral complexities:** Three conditions, two bilateral
10. **Appeal pending:** Mid-appeal decision document

---

## 16. Future Enhancements

### Phase 2
1. **Presumptive Condition Mapping:** Auto-flag presumptive conditions
2. **Schedule Rating Reference:** Link to specific Schedule sections
3. **Appeal Deadline Tracking:** Extract and alert on appeal deadlines

### Phase 3
4. **Comparative Analysis:** Compare current decision vs prior decisions
5. **Secondary Condition Prediction:** Identify likely secondary conditions base on primary SC
6. **Compensation Projection:** Project future increases/changes

### Phase 4
7. **Bilateral Optimization:** Suggest conditions for bilateral factor eligibility
8. **SMC Opportunity:** Identify conditions meeting SMC criteria
9. **Rerate Triggers:** Identify conditions due for rerate review

---

## Implementation Notes

- Combined rating must be calculated using VA Combined Rating Table (deterministic)
- All percentages must be in 10% increments (10%, 20%, ..., 100%)
- All dates must be ISO 8601 format
- Diagnostic codes must be 6-digit format
- SMC codes must be from valid set: A, A1, A2, H, H1, H2, K, K1, L, M, N, O, P, Q, R, S, T
- Back pay calculations must account for actual monthly changes
- Confidence scores based on field presence, validation pass rate, OCR quality
- All extracted data must be auditable (traceable to source text and page number)
