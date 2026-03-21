# STR Scanner — Design & Modernization Specification

**Location:** `backend/va_scanner/backend/shared/scanner/strAnalysis/`

**Version:** 2.0  
**Last Updated:** March 17, 2026

---

## 1. Purpose

Extract all in-service diagnoses, complaints, injuries, and exposures from Service Treatment Records (STRs). Build complete chronological medical history during military service for service-connection analysis.

---

## 2. Document Types Supported

- Chronological STRs (primary)
- Deployment Health Assessment Questionnaires
- Immunization Records
- PULHES Profiles (physical profile)
- Hospitalization Summaries
- Sick Call Records
- Mental Health Visit Notes
- Flight Surgeon Evaluations
- Occupational Health Records
- Chemical/Hazmat Exposure Forms

---

## 3. Required Extraction Fields

**Medical Encounters:**
- Date of encounter
- Chief complaint
- Diagnosis/impression
- Treatment provided
- Provider type (MD, PA, RN, etc.)
- Specialty (Primary Care, Psychiatry, etc.)

**Service-Related Injuries:**
- Injury date
- Mechanism of injury
- Body part affected
- Line of duty status
- Duty limitations/profile

**Exposures:**
- Type (Chemical, Radiation, Biological, Environmental)
- Location
- Date range
- Unit/Assignment
- Estimated duration

**Immunizations:**
- Vaccine name
- Date administered
- Route
- Reaction/adverse events

**Profiles (PULHES):**
- Issue date
- Each PULHES component (Physical, Upper extremities, Lower extremities, Hearing, Eyes, Sed rate)
- Duration
- Duty status

---

## 4. Optional Extraction Fields

- MOS-related injury patterns
- Deployment-related health issues
- Sexual assault/harassment reports
- Substance use documentation
- Mental health treatment (non-psychiatric)
- Specialist referrals
- Lab/imaging results
- Blood type and blood bank data
- Pre-deployment screening results
- Post-deployment health assessments

---

## 5. Rules

### Encounter Detection Rules
1. **Detect encounter type:**
   - Sick call (brief encounter)
   - Hospitalization (multi-day)
   - Surgery (specific format)
   - Mental health visit (specialized format)
   - Deployment medical (field/remote)

2. **Extract chronological order:**
   - Ensure encounters sorted by date
   - Handle multi-day admissions (single encounter, multiple notes)
   - Merge duplicate entries (same date/type)

3. **Extract encounter metadata:**
   - Provider specialty
   - Location code/name
   - Urgency level
   - Classification (routine, urgent, emergency)

### Complaint/Diagnosis Rules
1. **Extract chief complaints:**
   - Multi-line complaints preserved
   - Related complaints merged

2. **Extract diagnoses:**
   - Primary diagnosis prominence
   - Secondary diagnoses captured
   - Rule-out diagnoses captured with uncertainty flag

3. **Exposure keyword detection:**
   - Vietnam-era: "Agent Orange", "herbicide", "defoliant"
   - Gulf War-era: "Burn pit", "depleted uranium", "pesticides", "anthrax vaccine"
   - OEF/OIF: "Burn pit", "IED", "blast", "particulate", "contamination"
   - All: "Chemical", "Biological", "Radiation", "Lead", "Asbestos"

### Duty Limitation Rules
1. **Extract PULHES profile:**
   - All 6 components (P, U, L, H, E, S)
   - Limitation codes (1-8 scale)
   - Effective date range

2. **Extract duty status:**
   - Full duty
   - Limited duty
   - Medical hold
   - Cannot deploy

3. **Extract limitations:**
   - Lifting restrictions (max weight)
   - Standing/walking restrictions
   - Hazardous duty restrictions

### Chronicity Indicators Rules
1. **Extract recurrence patterns:**
   - Repeated visits for same complaint
   - Treatment resistance
   - Chronic vs acute distinction

2. **Compute continuity:**
   - Time span of condition
   - Number of encounters
   - Treatment trajectory

---

## 6. Validators

### Date Validators
- Encounter dates during service period (not before entry, not after separation)
- Encounters chronologically ordered
- Multi-day admissions end-date >= start-date
- Deployment dates aligned with service history

### Medical Term Validators
- Diagnosis terminology against ICD-9 or ICD-10 codes
- Chief complaint uses valid medical terminology
- Abbreviations exist in military medical abbreviations database

### Exposure Validators
- Exposure keywords match known exposures
- Location codes valid for branch/era
- Exposure dates match known conflict zones/operations

### Immunization Validators
- Vaccine names match military vaccine database
- Dates reasonable for military service
- Sequence reasonable (e.g., 2 doses of vaccine X with 4-week gap)

### Profile Validators
- PULHES codes valid (1-8 scale per component)
- Overall profile code matches component codes
- Duty status consistent with component codes

---

## 7. Transforms

### Complaint to Diagnosis Mapping
1. Map complaint keywords to likely diagnoses
2. Identify pain patterns for chronic conditions
3. Link repeated complaints to causation

### Injury Classification
1. **Acute vs Chronic:**
   - Single encounter = likely acute
   - Repeated encounters = likely chronic
   - Treatment trajectory shows acute→chronic transition

2. **Service-Connected Potential:**
   - Combat-related injury (IED, blast, gunshot) → HIGH
   - Occupational injury (MOS-related) → MEDIUM
   - Environmental exposure → LOW-MEDIUM
   - Pre-service condition → LOW

3. **Combat Indicators:**
   - "Shrapnel wound", "gunshot", "IED", "blast" → Direct combat
   - "Traumatic brain injury", "PTSD evaluation" → Combat exposure
   - "Environmental injury", "heat casualty" → Combat zone deployment

### Exposure Transforms
1. **Agent Orange (Vietnam-era):**
   - Location: "Vietnam", "Thailand", unit codes
   - Dates: 1961-1975
   - Flag: Presumptive eligibility

2. **Burn Pit/Desert Storm (Gulf War-era):**
   - Location: "Saudi Arabia", "Iraq", "Kuwait"
   - Dates: 1990-1992, 2001-present
   - Exposures: Burn pit, oil well fires, depleted uranium
   - Flag: Presumptive eligibility

3. **Occupational Exposure:**
   - MOS codes indicating hazard (explosives, aviation, nuclear)
   - Location-based (chemical handling, radiation)
   - Transform to presumptive condition flags

### Chronicity Scoring
1. Count encounters per diagnosis over time span
2. Calculate "chronicity score" (0-100):
   - 3+ encounters over 1+ years = chronic indicator
   - Repeated treatment = chronicity flag
   - Timeline gaps suggest intermittent acute exacerbations

---

## 8. Expected Folder Structure

```
backend/va_scanner/backend/shared/scanner/strAnalysis/
├── index.js                           # Module exports
├── strDeterministicScanner.js          # Main STR scanner
├── extractionLibrary.js                # Encounter/diagnosis extraction
├── strSchema.js                        # STR output schema
├── timelineBuilder.js                  # Chronological sequencing
├── crossValidation.js                  # Cross-field validation
├── evidenceGraphMapping.js             # Event graph construction
├── config.json                         # Scanner metadata & versioning
├── schema/
│   ├── str-encounter.schema.json       # Encounter record schema
│   └── str-output.schema.json          # Complete output schema
├── rules/
│   ├── str_encounter_rules.json        # Encounter extraction rules
│   ├── str_exposure_rules.json         # Exposure detection rules
│   └── str_chronicity_rules.json       # Chronicity/timeline rules
├── validators/
│   ├── str_validators.js               # Main validation pipeline
│   ├── exposureValidator.js            # Exposure keyword validation
│   └── chronologyValidator.js          # Date order validation
└── databases/
    ├── exposures.json                  # Known exposures by era/location
    ├── medicalTerms.json               # Military medical abbreviations
    └── mosHazards.json                 # MOS code hazard mappings
```

---

## 9. Required Files

**Currently Exist:**
- `index.js`
- `strDeterministicScanner.js`
- `extractionLibrary.js`
- `strSchema.js`
- `timelineBuilder.js`
- `crossValidation.js`
- `evidenceGraphMapping.js`

**Must Exist:**
- `config.json` (scanner metadata)
- `schema/str-encounter.schema.json`
- `schema/str-output.schema.json`
- `rules/str_encounter_rules.json`
- `rules/str_exposure_rules.json`
- `rules/str_chronicity_rules.json`
- `validators/str_validators.js`
- `validators/exposureValidator.js`
- `validators/chronologyValidator.js`
- `databases/exposures.json`
- `databases/medicalTerms.json`
- `databases/mosHazards.json`

---

## 10. Modernization Requirements

### Code Quality
1. Add JSDoc with @param, @returns, @throws
2. Add strict mode
3. Add logging at pipeline stages
4. Add input validation
5. Add typed error handling

### Configuration
1. `config.json` must include:
   ```json
   {
     "name": "STR Scanner",
     "version": "2.0.0",
     "description": "Extracts diagnoses and exposures from military service treatment records",
     "lastUpdated": "2026-03-17T00:00:00Z",
     "extractionPipeline": [
       "Encounter detection",
       "Complaint extraction",
       "Diagnosis parsing",
       "Exposure detection",
       "Timeline building",
       "Chronicity scoring",
       "Cross-validation",
       "Output normalization"
     ],
     "supportedEras": ["Vietnam", "Gulf War", "OEF/OIF", "Modern"],
     "requiredFields": [... ],
     "optionalFields": [...]
   }
   ```

2. Exposure database must be versioned and branch-specific

### Metadata Injection
1. Add `_metadata` to output with:
   - Scanner version
   - Scan date
   - Encounter count
   - Exposure flags detected
   - Chronicity scores
   - Confidence overall + byField
   - Validation warnings

---

## 11. Error Handling Requirements

### Graceful Degradation
1. Unreadable encounter → skip but log
2. Missing diagnosis → extract complaint only
3. Invalid date format → parse as best-guess, flag
4. Unrecognized exposure keyword → extract text, flag for review

### Error Categories

**Critical:**
- Cannot parse as STR document
- No encounters extracted
- Completely corrupted

**Warnings:**
- Date format ambiguous (MM/DD vs DD/MM)
- Diagnosis not in ICD-10 database
- Exposure keyword not recognized

**Info:**
- Successfully parsed N encounters
- Detected exposure: [type]
- Chronicity score > 50

---

## 12. Test Cases

### Core Extraction
1. **Chronological encounter sequence:** Extract 10+ encounters, verify sorted
2. **Multi-line complaints:** Complaint spanning 3+ lines
3. **Recurring diagnosis:** Same diagnosis across multiple encounters
4. **Exposure detection:** Vietnam, Gulf War, Iraq/Afghanistan scenarios
5. **PULHES profile:** Complete and partial profiles
6. **Hospitalization:** Multi-day admission with daily notes

### Validation
7. **Date validation:** Out-of-order dates detected and flagged
8. **Diagnosis validation:** ICD-10 mapping tested
9. **Exposure keywords:** All known exposures recognized

### Transforms
10. **Chronicity scoring:** 3+ encounters → chronic flag
11. **Service connection assessment:** Injury type → scoring
12. **Exposure transform:** Location + dates → presumptive flags

### Edge Cases
13. **Missing dates:** Encounter with no date extracted
14. **Deployment notes:** Field medical records with minimal documentation
15. **Mental health encounters:** Sensitive content extraction
16. **Pre-deployment screening:** Baseline health documented

---

## 13. Sample Input

### Input: Scanned STR packet (10-20 pages)

**Expected Content:**
```
[Encounter 1]
DATE: 3 MAR 2002
LOCATION: Medical Clinic, Camp Lejeune
PROVIDER: Capt. James MD, Internal Medicine

CHIEF COMPLAINT: Cough, fever, right shoulder pain

HISTORY OF PRESENT ILLNESS:
29 y/o male marine reports 3-day history of productive cough with fever to 102.5F. 
Also reports right shoulder pain, worse with overhead activities. Denies recent trauma.

PHYSICAL EXAM: Temp 101.2F, clear breath sounds bilateral, right shoulder tenderness...

ASSESSMENT & PLAN:
1. Acute bronchitis - Rx: Amoxicillin 500mg TID x 10 days
2. Shoulder strain - PT referral, duty limited; no overhead lifting x 2 weeks

PROFILE ISSUED:
H4, E4, S3 - Limited duty until 17 MAR 2002

[Encounter 2]
DATE: 10 MAR 2002
LOCATION: Occupational Health Clinic
COMMENTS: Exposure assessment - burn pit contamination, Camp Lejeune

DOCUMENTATION: Exposure to airborne particulates from burn pit area during March 1-10.
Estimated 8 hours/day, 10 days total. No PPE available.

[... more encounters ...]
```

---

## 14. Sample Output

### Output: Structured JSON

```json
{
  "success": true,
  "data": {
    "encounters": [
      {
        "date": "2002-03-03",
        "location": "Medical Clinic, Camp Lejeune",
        "provider": {
          "rank": "Captain",
          "name": "James",
          "specialty": "Internal Medicine"
        },
        "encounter": {
          "type": "sick_call",
          "urgencyLevel": "routine",
          "classification": "acute"
        },
        "complaints": ["Cough, fever", "Right shoulder pain"],
        "diagnoses": [
          {
            "primary": "Acute bronchitis",
            "icd10": "J20.9",
            "treatment": "Amoxicillin 500mg TID x 10 days"
          },
          {
            "primary": "Shoulder strain",
            "icd10": "M25.51",
            "treatment": "PT referral, duty limited"
          }
        ],
        "profile": {
          "issued": "2002-03-03",
          "expires": "2002-03-17",
          "code": "H4E4S3",
          "components": { "H": 4, "E": 4, "S": 3 },
          "dutyStatus": "limited"
        },
        "serviceConnectionPotential": "MEDIUM"
      }
    ],
    "exposures": [
      {
        "type": "burn_pit",
        "location": "Camp Lejeune",
        "dateRange": {
          "start": "2002-03-01",
          "end": "2002-03-10"
        },
        "estimatedHours": 80,
        "ppe": "none",
        "presumptiveFlag": true,
        "condition": "burn_pit_exposure_flag"
      }
    ],
    "chronicityAssessment": {
      "totalEncounters": 12,
      "chronicity": {
        "shoulder_pain": { "encounters": 5, "score": 65, "status": "chronic" },
        "respiratory": { "encounters": 3, "score": 35, "status": "recurrent_acute" }
      }
    },
    "_metadata": {
      "scannerId": "str-analysis-v2.0.0",
      "scanDate": "2026-03-17T14:30:00Z",
      "encounterCount": 12,
      "exposuresDetected": ["burn_pit"],
      "presumptiveConditions": ["burn_pit_exposure"],
      "confidence": {
        "overall": 0.94,
        "encounters": 0.95,
        "diagnoses": 0.92,
        "exposures": 0.88
      },
      "warnings": [],
      "validationStatus": "passed"
    }
  }
}
```

---

## 15. Known Edge Cases

1. **Missing dates:** Encounter documented but no date provided
   - Mitigation: Extract relative timing ("day after previous encounter")

2. **Deployment medical records:** Minimal documentation, abbreviations
   - Mitigation: Extended medical abbreviation database

3. **Handwritten entries:** Mixed typed/handwritten STRs
   - Mitigation: OCR + handwriting model

4. **Pre-deployment screening:** Baseline health documented (not treatment)
   - Mitigation: Extract as encounter with null diagnosis

5. **Mental health notes:** Sensitive, potentially redacted content
   - Mitigation: Extract presence of mental health evaluation without content details

6. **Sexual assault reporting:** Specialized documentation
   - Mitigation: Flag presence, extract minimal details for safety

7. **Duplicate encounters:** Same record entered twice
   - Mitigation: Hash-based de-duplication

8. **Spanning pages:** Encounter/exposure spans page boundary
   - Mitigation: Continuation detection

---

## 16. Future Enhancements

### Phase 2
1. **Presumptive Condition Mapping:** Auto-flag exposures for presumptive research
2. **MOS-Injury Correlation:** Link injuries to specific MOS hazards
3. **Deployment Timeline:** Merge STR with DD-214 deployment data

### Phase 3
4. **Natural Language Processing:** Extract narrative text without structured entry
5. **Biometric Integration:** Link to medical imaging/lab results
6. **Predictive Health:** Identify conditions requiring preemptive screening

---

## Implementation Notes

- All dates must be ISO 8601 format
- Chronicity scoring must be auditable (counts and date ranges shown)
- Exposure keywords must match known exposure database (branch/era specific)
- Confidence scores based on field presence, validation pass rate, OCR quality
