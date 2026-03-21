# Current Treatment Scanner — Design & Modernization Specification

**Location:** `backend/va_scanner/backend/shared/scanner/currentTreatmentAnalysis/`

**Version:** 2.0  
**Last Updated:** March 17, 2026

---

## 1. Purpose

Extract current medical conditions, symptoms, medications, and active treatment patterns from recent clinical documentation. Determine current functional status and ongoing therapy for rating purposes.

---

## 2. Document Types Supported

- Progress notes (past 12 months)
- SOAP notes (Subjective, Objective, Assessment, Plan)
- Medication reconciliation lists
- Specialist consultation reports
- Mental health session notes
- Physical therapy documentation
- Pain management evaluations
- Rheumatology/Cardiology/Neurology reports
- Physical exam documentation
- Telehealth visit notes

---

## 3. Required Extraction Fields

**Active Medical Conditions:**
- Diagnosis/condition name
- Date of last encounter
- Current status (active, resolved, chronic)
- Functional impact level
- Treatment modalities

**Medications:**
- Drug name
- Dosage (amount + frequency)
- Route (oral, IV, IM, topical)
- Indication (what it treats)
- Start date
- Changes/discontinuations

**Symptoms:**
- Symptom name
- Frequency (daily, weekly, intermittent)
- Severity (mild, moderate, severe)
- Trigger factors
- Alleviating factors

**Treatment Frequency:**
- PhysicalTherapy sessions/week
- Mental health visits/month
- Specialist follow-ups/year
- Medication refill frequency

**Functional Impact:**
- Ability to work
- Mobility limitations
- Cognitive limitations
- Pain levels (0-10 scale)
- Assistive devices in use

---

## 4. Optional Extraction Fields

- ICD-10 diagnostic codes
- Lab results (values + reference ranges)
- Imaging findings
- Provider credentials (MD, PA, LPC, etc.)
- Telehealth vs in-person visits
- Refill history (medication adherence proxy)
- Goal progress notes
- Comorbidity flags

---

## 5. Rules

### Document Structure Detection
1. **SOAP Format Detection:**
   - Subjective section: Patient reports
   - Objective section: Vital signs, exam findings
   - Assessment section: Impressions, diagnoses
   - Plan section: Treatment/follow-up

2. **Medication List Detection:**
   - Structured medication table
   - Narrative medication summary
   - Rx block format

3. **Progress Note Detection:**
   - Date-stamped entry
   - Provider signature area
   - Encounter type indicator

### Condition Extraction Rules
1. **Extract active diagnoses:**
   - Present tense language ("Patient has...", "Currently...")
   - Recent encounter dates (within 12 months)
   - Treatment actively ongoing

2. **Distinguish active vs resolved:**
   - "Resolved", "treated and cured" → resolved
   - "Ongoing", "chronic", "uncontrolled" → active
   - Recent encounter + recent medication = active

3. **Extract functional impact:**
   - "Cannot", "unable to", "limited" → functional limitation
   - "No longer", "returned to...", "full duty" → functional improvement

### Medication Extraction Rules
1. **Extract from structured lists:**
   - Table format: Name | Dose | Frequency | Indication
   - Bullet format: "- Drug X: dose frequency for indication"
   - Narrative: "Patient continues..."

2. **Dosage normalization:**
   - "10 mg once daily" → 10 mg OD
   - "250mg three times per day" → 250mg TID
   - "Every 4-6 hours as needed" → Q4-6H PRN

3. **Indication extraction:**
   - Explicit: "for hypertension", "treats anxiety"
   - Inferred: "Continue current regimen"

### Symptom Extraction Rules
1. **Extract symptoms from subjective section:**
   - Pain: location, severity, character
   - Fatigue: timing, severity
   - Cognitive: memory, concentration
   - Mental health: mood, anxiety, sleep

2. **Frequency indicators:**
   - Daily, several times/day, weekly, monthly
   - Constant vs intermittent
   - Triggered by activity vs unpredictable

3. **Severity indicators:**
   - Pain scale (0-10), functional impact
   - Verbal descriptors ("severe", "mild", "moderate")
   - Impact on ADLs

### Treatment Frequency Extraction
1. **Therapy session frequency:**
   - "PT 2x/week" → 2 sessions per week
   - "Mental health monthly" → 1 per month
   - Extract plan duration

2. **Specialist referrals:**
   - "Follow up with cardiology in 3 months" → 1 per quarter
   - "PRN psychiatry" → as needed

---

## 6. Validators

### Medication Validators
- Drug name against FDA/VA formulary
- Dosage within therapeutic range for indication
- Frequency reasonable (not excessive)
- Route valid for drug class

### Diagnosis Validators
- ICD-10 code format
- Active diagnosis status consistent with encounter date
- Comorbidity reasonable (not contradictory)

### Symptom Validators
- Symptom names in medical glossary
- Severity 0-10 scale if numeric
- Frequency terms standardized (daily, weekly, etc.)

### Treatment Frequency Validators
- Therapy types valid (PT, OT, Mental health, etc.)
- Frequency reasonable for condition type
- Duration dates don't span unreasonably

### Functional Impact Validators
- Scale 1-10 if numeric
- Descriptors standardized (unable, limited, full)
- Consistency with diagnoses/medications

---

## 7. Transforms

### Medications to Indication Mapping
1. Map drug classes to standard indications
2. Identify polypharmacy (many drugs for same condition)
3. Extract medication adherence proxy (refill frequency)

### Conditions to Functional Impact Transform
1. **Severity Scoring (0-100):**
   - Mild: 0-30 (symptoms present, minimal impact)
   - Moderate: 31-60 (some functional limitation)
   - Severe: 61-100 (significant limitation or bed-bound)

2. **Functional Rating:**
   - Can work full-time → minimal impact
   - Can work part-time → moderate impact
   - Cannot work → severe impact

### Symptoms to Chronicity Transform
1. **Acute vs Chronic:**
   - 1-4 weeks = acute
   - 5-12 weeks = subacute
   - 12+ weeks = chronic

2. **Stability Assessment:**
   - Worsening: Recent escalation in frequency/severity
   - Stable: Consistent over months
   - Improving: Decreasing frequency/severity
   - Resolved: No longer mentioned

### Medication to Service Connection Discovery
1. Map medications to likely diagnoses
2. Identify medications for service-connected conditions
3. Identify medications for secondary conditions

---

## 8. Expected Folder Structure

```
backend/va_scanner/backend/shared/scanner/currentTreatmentAnalysis/
├── index.js                              # Module exports
├── currentTreatmentScanner.js             # Main scanner
├── currentTreatmentAnalysis.js            # Analysis engine
├── extractionLibrary.js                   # Text extraction rules
├── schema.js                              # Output schema
├── timelineBuilder.js                     # Chronological analysis
├── crossValidation.js                     # Cross-field validation
├── evidenceGraphMapping.js                # Evidence graph construction
├── config.json                            # Scanner metadata & versioning
├── schema/
│   ├── current-treatment-condition.schema.json
│   ├── current-treatment-medication.schema.json
│   └── current-treatment-output.schema.json
├── rules/
│   ├── condition_extraction_rules.json
│   ├── medication_extraction_rules.json
│   └── symptom_extraction_rules.json
├── validators/
│   ├── current_treatment_validators.js
│   ├── medicationValidator.js
│   └── functionalImpactValidator.js
└── databases/
    ├── medications.json                  # Drug database
    ├── diagnoses.json                    # ICD-10 mappings
    └── symptoms.json                     # Medical symptom glossary
```

---

## 9. Required Files

**Currently Exist:**
- `index.js`
- `currentTreatmentScanner.js`
- `currentTreatmentAnalysis.js`
- `extractionLibrary.js`
- `schema.js`
- `timelineBuilder.js`
- `crossValidation.js`
- `evidenceGraphMapping.js`

**Must Exist:**
- `config.json`
- `schema/current-treatment-condition.schema.json`
- `schema/current-treatment-medication.schema.json`
- `schema/current-treatment-output.schema.json`
- `rules/condition_extraction_rules.json`
- `rules/medication_extraction_rules.json`
- `rules/symptom_extraction_rules.json`
- `validators/current_treatment_validators.js`
- `validators/medicationValidator.js`
- `validators/functionalImpactValidator.js`
- `databases/medications.json`
- `databases/diagnoses.json`
- `databases/symptoms.json`

---

## 10. Modernization Requirements

### Code Quality
1. JSDoc with @param, @returns, @throws
2. Strict mode
3. Structured logging
4. Input validation on all entry points
5. Typed error handling

### Configuration
1. `config.json` must include:
   ```json
   {
     "name": "Current Treatment Scanner",
     "version": "2.0.0",
     "description": "Extracts active diagnoses, medications, and treatment from clinical documentation",
     "lastUpdated": "2026-03-17T00:00:00Z",
     "extractionPipeline": [
       "Document format detection",
       "Condition extraction",
       "Medication extraction",
       "Symptom extraction",
       "Treatment frequency extraction",
       "Functional impact assessment",
       "Severity scoring",
       "Cross-validation",
       "Output normalization"
     ],
     "requiredFields": [...],
     "optionalFields": [...]
   }
   ```

2. Drug database must be updated quarterly from FDA/VA formulary

### Metadata Injection
1. Add `_metadata` including:
   - Scanner version
   - Document analysis date
   - Active condition count
   - Medication count
   - Functional severity score
   - Confidence by field
   - Recent changes detected

---

## 11. Error Handling Requirements

### Graceful Degradation
1. Missing medication indication → extract drug name/dose only
2. Symptom without severity → flag as present
3. Condition without functional impact → extract diagnosis only
4. Document format not SOAP → attempt generic extraction

### Error Categories

**Critical:**
- No medical content extracted
- No conditions found
- Completely illegible notes

**Warnings:**
- Drug name not in formulary (generic vs brand)
- ICD-10 code not found (likely OCR error)
- Inconsistent symptom descriptions

**Info:**
- New diagnosis documented
- Medication dose changed
- Treatment plan updated

---

## 12. Test Cases

### Condition Extraction
1. **SOAP note** with multiple diagnoses
2. **Specialist report** with single focused condition
3. **Multi-page documentation** spanning visits
4. **Active vs resolved distinction:** "Currently has..." vs "History of..."

### Medication Extraction
5. **Structured medication table**
6. **Narrative medication summary**
7. **Dosage variation:** mg, grams, units
8. **Frequency variation:** OD, daily, BID, twice weekly

### Symptom Extraction
9. **Severity extraction:** Pain 7/10, "severe fatigue"
10. **Frequency extraction:** Daily, weekly, PRN
11. **Trigger identification:** "Worse with activity"

### Functional Impact
12. **Work capacity assessment:** Full-time, part-time, unable
13. **Mobility impact:** Normal gait, cane, wheelchair
14. **Cognitive impact:** Normal, some difficulty, severe

### Edge Cases
15. **Shorthand notation:** "HTN", "DM2", "GERD" abbreviations
16. **Multiple providers:** Conflicting assessments resolved
17. **Telehealth notes:** Format differs from in-person
18. **Handwritten documentation:** Mixed typed/written

---

## 13. Sample Input

### Input: Progress Note from Primary Care

```
DATE: 03 MAR 2026
PATIENT: John Smith
PROVIDER: Dr. Sarah Johnson, MD - Internal Medicine

SUBJECTIVE:
Patient reports right knee pain that has been ongoing for 24 months. Pain is worse 
with walking and climbing stairs. Reports taking ibuprofen 400mg 2-3 times daily for pain.

Currently managing depression with fluoxetine 20mg daily. Sleep disrupted 2-3 times/week, 
difficulty concentrating at work.

OBJECTIVE:
Vitals: BP 142/88, HR 78, Temp 98.6F
Weight: 185 lbs (stable)
Right knee: swelling, pain with flexion, tenderness on palpation
ROM: Limited flexion to 110 degrees

ASSESSMENT:
1. Osteoarthritis, right knee - chronic, symptomatic
2. Major Depressive Disorder - currently stable on SSRI
3. Hypertension - not at goal

PLAN:
1. OA knee: Continue ibuprofen; referral to orthopedic surgery for evaluation;
   PT 2x/week x 8 weeks; may need intra-articular injection
2. Depression: Continue fluoxetine 20mg daily; monitor; f/u 1 month
3. HTN: Increase lisinopril from 10mg to 20mg daily; recheck BP in 2 weeks

MEDICATIONS:
- Fluoxetine 20mg PO daily for depression
- Ibuprofen 400mg PO 2-3x daily PRN for pain
- Lisinopril 20mg PO daily (increased today) for hypertension

F/U: 1 month or sooner if needed
```

---

## 14. Sample Output

### Output: Structured JSON

```json
{
  "success": true,
  "data": {
    "conditions": [
      {
        "id": "cond-001",
        "diagnosis": "Osteoarthritis, right knee",
        "icd10": "M17.11",
        "status": "active",
        "chronicity": "chronic",
        "duration": "24 months",
        "lastEncounter": "2026-03-03",
        "symptoms": [
          {
            "name": "knee pain",
            "severity": 6,
            "frequency": "daily",
            "triggers": ["walking", "climbing stairs"],
            "alleviators": ["ibuprofen", "rest"]
          }
        ],
        "functionalImpact": {
          "severity": "moderate",
          "scoreNumeric": 45,
          "limitations": ["limited walking distance", "stair climbing painful"]
        },
        "currentTreatment": {
          "medications": ["ibuprofen"],
          "therapies": [
            {
              "type": "physical_therapy",
              "frequency": "2x/week",
              "duration": "8 weeks"
            }
          ],
          "planned": ["orthopedic surgery evaluation", "intra-articular injection"]
        },
        "trend": "stable"
      },
      {
        "id": "cond-002",
        "diagnosis": "Major Depressive Disorder",
        "icd10": "F32.9",
        "status": "active",
        "chronicity": "chronic",
        "lastEncounter": "2026-03-03",
        "symptoms": [
          {
            "name": "sleep disturbance",
            "severity": 5,
            "frequency": "2-3x/week"
          },
          {
            "name": "difficulty concentrating",
            "severity": 4,
            "frequency": "daily"
          }
        ],
        "functionalImpact": {
          "severity": "mild",
          "scoreNumeric": 25,
          "limitations": ["work concentration affected"]
        },
        "currentTreatment": {
          "medications": ["fluoxetine 20mg daily"],
          "therapies": [],
          "followUp": "1 month"
        },
        "trend": "stable"
      }
    ],
    "medications": [
      {
        "name": "Fluoxetine",
        "dosage": "20 mg",
        "frequency": "once daily",
        "route": "oral",
        "indication": "Major Depressive Disorder",
        "startDate": "recent",
        "status": "active",
        "refillFrequency": "monthly"
      },
      {
        "name": "Ibuprofen",
        "dosage": "400 mg",
        "frequency": "2-3 times daily",
        "route": "oral",
        "indication": "Osteoarthritis, right knee pain",
        "status": "active",
        "asNeeded": true
      },
      {
        "name": "Lisinopril",
        "dosage": "20 mg (recently increased from 10mg)",
        "frequency": "once daily",
        "route": "oral",
        "indication": "Hypertension",
        "status": "active",
        "changeDate": "2026-03-03"
      }
    ],
    "functionalSummary": {
      "overallSeverity": "moderate",
      "overallScore": 35,
      "workCapacity": "part-time capable with accommodations",
      "mobilityStatus": "limited",
      "recentChange": "minor increase in depression medication",
      "stability": "stable"
    },
    "_metadata": {
      "scannerId": "current-treatment-analysis-v2.0.0",
      "scanDate": "2026-03-17T14:30:00Z",
      "documentDate": "2026-03-03",
      "documentType": "progress_note",
      "provider": "Dr. Sarah Johnson, MD",
      "activeConditions": 3,
      "activemedications": 3,
      "recentChanges": ["Ibuprofen dosing adjustment", "Lisinopril dose increase"],
      "confidence": {
        "overall": 0.96,
        "conditions": 0.97,
        "medications": 0.95,
        "functionalImpact": 0.94
      },
      "warnings": [],
      "validationStatus": "passed"
    }
  }
}
```

---

## 15. Known Edge Cases

1. **Abbreviations:** "HTN", "DM2", "GERD" require abbreviation dictionary
2. **Conflicting assessments:** Multiple providers, different opinions
3. **Handwritten portions:** Mixed typed/handwritten documentation
4. **Medication refills:** Implies continued use but not explicitly stated
5. **Resolved conditions:** No longer in current medication list
6. **PRN medications:** Usage pattern inferred from prescription
7. **Telehealth format:** Different structure than in-person notes
8. **Specialist jargon:** Different terminology by specialty

---

## 16. Future Enhancements

### Phase 2
1. **Trend Analysis:** Detect worsening/improving conditions over time
2. **Medication Adherence:** Estimate from refill patterns
3. **Secondary Condition Prediction:** Identify likely secondary conditions

### Phase 3
4. **Natural Language Deep Dive:** Detailed sentiment analysis of notes
5. **Lab Result Integration:** Extract and interpret lab values
6. **Imaging Finding Integration:** Auto-link imaging to conditions

### Phase 4
7. **Predictive Flaring:** Identify conditions at risk of exacerbation
8. **Comparative Analysis:** Current vs historical treatment response

---

## Implementation Notes

- All dates must be ISO 8601 format
- Severity scores must be 0-100 scale
- Medication database must include brand + generic names
- Symptoms must reference validated medical glossary
- Functional impact scoring must be deterministic and auditable
