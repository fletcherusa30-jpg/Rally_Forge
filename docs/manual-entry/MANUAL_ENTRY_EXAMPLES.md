# Manual Entry Forms - Example Scenarios

**Purpose**: Real-world examples and expected output for both form types

---

## Scenario 1: Simple VA Rating Decision

**User Action**: Veteran manually enters single disability rating

### Form Input

| Field | Value |
|-------|-------|
| Condition Name | Tinnitus |
| Diagnostic Type | Disability |
| Page Number | 5 |
| Status | Service Connected |
| Rating % | 10 |
| Effective Date | 2020-01-15 |
| SC Basis | Direct |
| SC Evidence | Audiological testing confirms service connection |
| Rationale Summary | Continuous ringing in ears since service |

### Validation Checks Triggered
✅ Condition name provided  
✅ Status = SC → rating % required → 10% provided  
✅ SC basis = direct → secondaryTo not required ✓  
✅ All required fields present  

### Expected Output

```javascript
{
  success: true,
  serviceConnected: [
    { condition: "Tinnitus", percentage: 10 }
  ],
  denied: [],
  allConditions: [
    {
      conditionName: "Tinnitus",
      diagnosticType: "disability",
      pageNumber: "5",
      status: "Service Connected",
      ratingPercent: 10,
      effectiveDate: "2020-01-15",
      isBilateral: false,
      extremity: null,
      scBasis: "direct",
      secondaryTo: null,
      aggravationPercent: null,
      inferredIssue: false,
      scEvidence: "Audiological testing confirms service connection",
      rationaleSummary: "Continuous ringing in ears since service",
      evidenceNotes: null,
      denialReason: null,
      manualEntry: true,
      type: "VA_RATING_DECISION"
    }
  ],
  ratingCalculation: {
    calculatedCombinedRating: 10,
    conditions: [10],
    hasBilateralPairs: false,
    calculationMethod: "Manual entry (38 CFR §4.25)"
  },
  extractionSummary: {
    totalServiceConnected: 1,
    totalDenied: 0,
    manualEntry: true,
    entryType: 'VA_RATING_DECISION'
  },
  fileName: 'VA Rating Decision Manual Entry',
  submittedAt: '2025-02-21T10:30:00.000Z'
}
```

**Interpretation**:
- Single condition: Tinnitus at 10%
- Combined rating: 10% (single condition = unchanged)
- Service connection basis: Direct (no secondary condition needed)
- Total SC conditions: 1

---

## Scenario 2: Multiple Conditions with Combined Rating

**User Action**: Veteran enters 3 service-connected conditions with secondary condition

### Form Input - Entry 1

| Field | Value |
|-------|-------|
| Condition Name | Post-Traumatic Stress Disorder (PTSD) |
| Diagnostic Type | Disability |
| Status | Service Connected |
| Rating % | 70 |
| Effective Date | 2001-06-15 |
| SC Basis | Direct |
| Is Bilateral | No |
| Evidence Notes | Combat deployment Iraq 2003-2004 |

### Form Input - Entry 2

| Field | Value |
|-------|-------|
| Condition Name | Sleep Disturbance |
| Diagnostic Type | Disability |
| Status | Service Connected |
| Rating % | 50 |
| SC Basis | Secondary |
| Secondary To | Post-Traumatic Stress Disorder (PTSD) |
| Evidence Notes | Ongoing sleep disturbance attributed to service-connected PTSD |

### Form Input - Entry 3

| Field | Value |
|-------|-------|
| Condition Name | Migraine Headaches |
| Diagnostic Type | Disability |
| Status | Service Connected |
| Rating % | 20 |
| SC Basis | Aggravation |
| Aggravation % | 30 |
| Evidence Notes | Pre-existing condition worsened by military service |

### Validation Checks Triggered
✅ Entry 1: Direct SC, no secondary required  
✅ Entry 2: Secondary SC → secondaryTo = "PTSD" required ✓  
✅ Entry 3: Aggravation → aggravationPercent = 30% required ✓  

### Expected Output

```javascript
{
  success: true,
  serviceConnected: [
    { condition: "Post-Traumatic Stress Disorder (PTSD)", percentage: 70 },
    { condition: "Sleep Disturbance", percentage: 50 },
    { condition: "Migraine Headaches", percentage: 20 }
  ],
  denied: [],
  allConditions: [
    {
      conditionName: "Post-Traumatic Stress Disorder (PTSD)",
      diagnosticType: "disability",
      status: "Service Connected",
      ratingPercent: 70,
      effectiveDate: "2001-06-15",
      isBilateral: false,
      extremity: null,
      scBasis: "direct",
      secondaryTo: null,
      aggravationPercent: null,
      inferredIssue: false,
      scEvidence: null,
      rationaleSummary: null,
      evidenceNotes: "Combat deployment Iraq 2003-2004",
      denialReason: null,
      manualEntry: true,
      type: "VA_RATING_DECISION"
    },
    {
      conditionName: "Sleep Disturbance",
      diagnosticType: "disability",
      status: "Service Connected",
      ratingPercent: 50,
      effectiveDate: null,
      isBilateral: false,
      extremity: null,
      scBasis: "secondary",
      secondaryTo: "Post-Traumatic Stress Disorder (PTSD)",
      aggravationPercent: null,
      inferredIssue: false,
      scEvidence: null,
      rationaleSummary: null,
      evidenceNotes: "Ongoing sleep disturbance attributed to service-connected PTSD",
      denialReason: null,
      manualEntry: true,
      type: "VA_RATING_DECISION"
    },
    {
      conditionName: "Migraine Headaches",
      diagnosticType: "disability",
      status: "Service Connected",
      ratingPercent: 20,
      effectiveDate: null,
      isBilateral: false,
      extremity: null,
      scBasis: "aggravation",
      secondaryTo: null,
      aggravationPercent: 30,
      inferredIssue: false,
      scEvidence: null,
      rationaleSummary: null,
      evidenceNotes: "Pre-existing condition worsened by military service",
      denialReason: null,
      manualEntry: true,
      type: "VA_RATING_DECISION"
    }
  ],
  ratingCalculation: {
    calculatedCombinedRating: 88,
    conditions: [70, 50, 20],
    hasBilateralPairs: false,
    calculationMethod: "Manual entry (38 CFR §4.25)"
  },
  extractionSummary: {
    totalServiceConnected: 3,
    totalDenied: 0,
    manualEntry: true,
    entryType: 'VA_RATING_DECISION'
  },
  fileName: 'VA Rating Decision Manual Entry',
  submittedAt: '2025-02-21T10:35:00.000Z'
}
```

**Combined Rating Calculation**:
```
Step 1: 70% (first, highest rating)
Step 2: 70 + ((100-70) × 50%) = 70 + 15 = 85%
Step 3: 85 + ((100-85) × 20%) = 85 + 3 = 88%
Result: 88%
```

**Interpretation**:
- 3 service-connected conditions
- Combined rating: 88%
- Secondary relationship clearly documented
- Aggravation basis documented with 30% escalation

---

## Scenario 3: Denied Conditions

**User Action**: Veteran enters both approved and denied conditions

### Form Input - Entry 1

| Field | Value |
|-------|-------|
| Condition Name | Right Shoulder Pain |
| Diagnostic Type | Disability |
| Status | Service Connected |
| Rating % | 30 |
| SC Basis | Direct |

### Form Input - Entry 2

| Field | Value |
|-------|-------|
| Condition Name | Claimed Hemorrhoids |
| Diagnostic Type | Disability |
| Status | Denied |
| Denial Reason | Insufficient medical evidence to establish nexus to military service |

### Form Input - Entry 3

| Field | Value |
|-------|-------|
| Condition Name | Claimed Knee Problem |
| Diagnostic Type | Disability |
| Status | Deferred |
| Page Number | 8 |

### Validation Checks Triggered
✅ Entry 1: SC status → rating % provided ✓  
✅ Entry 2: Denied status → denialReason provided ✓  
✅ Entry 3: Deferred → no rating required ✓  

### Expected Output

```javascript
{
  success: true,
  serviceConnected: [
    { condition: "Right Shoulder Pain", percentage: 30 }
  ],
  denied: [
    { condition: "Claimed Hemorrhoids" },
    { condition: "Claimed Knee Problem" }
  ],
  allConditions: [
    {
      conditionName: "Right Shoulder Pain",
      diagnosticType: "disability",
      pageNumber: null,
      status: "Service Connected",
      ratingPercent: 30,
      effectiveDate: null,
      isBilateral: false,
      extremity: null,
      scBasis: "direct",
      secondaryTo: null,
      aggravationPercent: null,
      inferredIssue: false,
      scEvidence: null,
      rationaleSummary: null,
      evidenceNotes: null,
      denialReason: null,
      manualEntry: true,
      type: "VA_RATING_DECISION"
    },
    {
      conditionName: "Claimed Hemorrhoids",
      diagnosticType: "disability",
      pageNumber: null,
      status: "Denied",
      ratingPercent: null,
      effectiveDate: null,
      isBilateral: false,
      extremity: null,
      scBasis: null,
      secondaryTo: null,
      aggravationPercent: null,
      inferredIssue: false,
      scEvidence: null,
      rationaleSummary: null,
      evidenceNotes: null,
      denialReason: "Insufficient medical evidence to establish nexus to military service",
      manualEntry: true,
      type: "VA_RATING_DECISION"
    },
    {
      conditionName: "Claimed Knee Problem",
      diagnosticType: "disability",
      pageNumber: "8",
      status: "Deferred",
      ratingPercent: null,
      effectiveDate: null,
      isBilateral: false,
      extremity: null,
      scBasis: null,
      secondaryTo: null,
      aggravationPercent: null,
      inferredIssue: false,
      scEvidence: null,
      rationaleSummary: null,
      evidenceNotes: null,
      denialReason: null,
      manualEntry: true,
      type: "VA_RATING_DECISION"
    }
  ],
  ratingCalculation: {
    calculatedCombinedRating: 30,
    conditions: [30],
    hasBilateralPairs: false,
    calculationMethod: "Manual entry (38 CFR §4.25)"
  },
  extractionSummary: {
    totalServiceConnected: 1,
    totalDenied: 2,
    manualEntry: true,
    entryType: 'VA_RATING_DECISION'
  },
  fileName: 'VA Rating Decision Manual Entry',
  submittedAt: '2025-02-21T10:40:00.000Z'
}
```

**Interpretation**:
- 1 service-connected condition at 30%
- 2 denied conditions with documented denial reasons
- Combined rating based only on SC conditions (30%)
- Status variety shows form handles all decision types

---

## Scenario 4: Simple STR Entry

**User Action**: Medical professional manually enters in-service injury record

### Form Input

| Field | Value |
|-------|-------|
| Condition Name | Acute Knee Injury |
| Date of Event | 2003-06-15 |
| Event Type | Injury |
| Location | Fort Something, TX |
| Provider | Combat Support Hospital |
| Description | Soldier fell while performing training exercise, immediate right knee pain and swelling |
| Severity | Severe |
| Line of Duty | Yes |
| Confirmed In-Service Event | Yes |
| Exposure Type | (None selected) |

### Validation Checks Triggered
✅ Condition name provided  
✅ Date of event provided  
✅ Description provided  
✅ No exposure type → MOS eval not required ✓  

### Expected Output

```javascript
{
  success: true,
  records: [
    {
      condition: "Acute Knee Injury",
      date: "2003-06-15",
      description: "Soldier fell while performing training exercise, immediate right knee pain and swelling"
    }
  ],
  allRecords: [
    {
      conditionName: "Acute Knee Injury",
      dateOfEvent: "2003-06-15",
      type: "injury",
      location: "Fort Something, TX",
      provider: "Combat Support Hospital",
      description: "Soldier fell while performing training exercise, immediate right knee pain and swelling",
      severity: "severe",
      lineOfDuty: "Yes",
      MOSRelevant: null,
      exposureType: null,
      inServiceEvent: true,
      chronicityEvidence: null,
      continuityNotes: null,
      nexusIndicators: null,
      manualEntry: true,
      type: "SERVICE_TREATMENT_RECORD"
    }
  ],
  patientHistory: {
    totalMedicalEvents: 1,
    inServiceCount: 1,
    exposureEvents: 0,
    chronicConditions: 0
  },
  exposureSummary: {
    exposureTypes: [],
    MOSRelevantCount: 0
  },
  extractionSummary: {
    totalRecords: 1,
    manualEntry: true,
    entryType: 'SERVICE_TREATMENT_RECORD'
  },
  fileName: 'Service Treatment Records Manual Entry',
  submittedAt: '2025-02-21T11:00:00.000Z'
}
```

**Interpretation**:
- Single acute injury event
- In-service confirmed
- Severity documented
- No chronic condition status yet (single event)
- No exposure events

---

## Scenario 5: Complex STR with Exposure and Chronicity

**User Action**: Veteran manually enters medical records with exposures and ongoing symptoms

### Form Input - Record 1

| Field | Value |
|-------|-------|
| Condition Name | Respiratory Symptoms |
| Date of Event | 2006-08-15 |
| Event Type | Exposure |
| Location | Camp Lejeune, NC |
| Provider | Naval Hospital Camp Lejeune |
| Description | Initial onset of persistent dry cough during deployment to Camp Lejeune. Attributed to burn pit proximity near barracks. |
| Severity | Moderate |
| Line of Duty | Yes |
| Exposure Type | Burn Pits |
| MOS Relevant | Yes |
| In-Service Event | Yes |
| Chronicity Evidence | Ongoing cough documented in VA medical records 2006-2025. Multiple respiratory exams. |
| Continuity Notes | Cough has persisted for 19 years with periods of exacerbation during seasonal changes. Treated with bronchodilators and inhalers. |
| Nexus Indicators | Temporal relationship to burn pit exposure documented. Environmental health records confirm burn pit operations near barracks during assignment. |

### Form Input - Record 2

| Field | Value |
|-------|-------|
| Condition Name | Skin Rash (Secondary to Burn Pit Exposure?) |
| Date of Event | 2007-03-20 |
| Event Type | Symptom |
| Location | Camp Lejeune, NC |
| Description | Unexplained rash appearing on arms and neck during continued assignment at Camp Lejeune |
| Severity | Mild |
| Line of Duty | Yes |
| Exposure Type | Burn Pits |
| MOS Relevant | Yes |
| In-Service Event | Yes |
| Chronicity Evidence | Periodic rashes documented 2007-2015, then resolved after reassignment away from Camp Lejeune |
| Continuity Notes | Rash reappeared with same characteristics during brief return visit to area in 2010. Resolved after return home. Pattern suggests environmental causation. |

### Validation Checks Triggered
Record 1:
✅ All required fields provided  
✅ Exposure type selected → MOSRelevant required → Yes provided ✓  
✅ Chronicity evidence provided → continuityNotes required → provided ✓  

Record 2:
✅ All required fields provided  
✅ Exposure type selected → MOSRelevant required → Yes provided ✓  
✅ Chronicity evidence provided → continuityNotes required → provided ✓  

### Expected Output

```javascript
{
  success: true,
  records: [
    {
      condition: "Respiratory Symptoms",
      date: "2006-08-15",
      description: "Initial onset of persistent dry cough during deployment to Camp Lejeune..."
    },
    {
      condition: "Skin Rash (Secondary to Burn Pit Exposure?)",
      date: "2007-03-20",
      description: "Unexplained rash appearing on arms and neck during continued assignment at Camp Lejeune"
    }
  ],
  allRecords: [
    {
      conditionName: "Respiratory Symptoms",
      dateOfEvent: "2006-08-15",
      type: "exposure",
      location: "Camp Lejeune, NC",
      provider: "Naval Hospital Camp Lejeune",
      description: "Initial onset of persistent dry cough during deployment to Camp Lejeune. Attributed to burn pit proximity near barracks.",
      severity: "moderate",
      lineOfDuty: "Yes",
      MOSRelevant: true,
      exposureType: "burn pits",
      inServiceEvent: true,
      chronicityEvidence: "Ongoing cough documented in VA medical records 2006-2025. Multiple respiratory exams.",
      continuityNotes: "Cough has persisted for 19 years with periods of exacerbation during seasonal changes. Treated with bronchodilators and inhalers.",
      nexusIndicators: "Temporal relationship to burn pit exposure documented. Environmental health records confirm burn pit operations near barracks during assignment.",
      manualEntry: true,
      type: "SERVICE_TREATMENT_RECORD"
    },
    {
      conditionName: "Skin Rash (Secondary to Burn Pit Exposure?)",
      dateOfEvent: "2007-03-20",
      type: "symptom",
      location: "Camp Lejeune, NC",
      provider: null,
      description: "Unexplained rash appearing on arms and neck during continued assignment at Camp Lejeune",
      severity: "mild",
      lineOfDuty: "Yes",
      MOSRelevant: true,
      exposureType: "burn pits",
      inServiceEvent: true,
      chronicityEvidence: "Periodic rashes documented 2007-2015, then resolved after reassignment away from Camp Lejeune",
      continuityNotes: "Rash reappeared with same characteristics during brief return visit to area in 2010. Resolved after return home. Pattern suggests environmental causation.",
      nexusIndicators: null,
      manualEntry: true,
      type: "SERVICE_TREATMENT_RECORD"
    }
  ],
  patientHistory: {
    totalMedicalEvents: 2,
    inServiceCount: 2,
    exposureEvents: 2,
    chronicConditions: 2
  },
  exposureSummary: {
    exposureTypes: ["burn pits"],
    MOSRelevantCount: 2
  },
  extractionSummary: {
    totalRecords: 2,
    manualEntry: true,
    entryType: 'SERVICE_TREATMENT_RECORD'
  },
  fileName: 'Service Treatment Records Manual Entry',
  submittedAt: '2025-02-21T11:10:00.000Z'
}
```

**Interpretation**:
- 2 medical events at Camp Lejeune
- Both related to same exposure (burn pits)
- Both marked MOS Relevant
- Both documented as chronic with continuity of symptoms
- Clear temporal relationship to location/exposure
- Evidence pattern supports presumptive condition claim

---

## Scenario 6: Validation Error Scenarios

### Example Error 1: Missing Required Condition Name (VA Rating)

**User enters**:
- Condition Name: (empty)
- Status: Service Connected
- Rating %: 20

**Validation Result**: ❌ FAIL
```
Error: "Condition name is required"
Form State: Entry NOT added, field highlighted in red
User Action: User must fill condition name
```

### Example Error 2: Denied Status Without Reason (VA Rating)

**User enters**:
- Condition Name: "Claimed Back Pain"
- Status: Denied
- Denial Reason: (empty)

**Validation Result**: ❌ FAIL
```
Error: "Denial reason required for Denied conditions"
Form State: Entry NOT added, denial reason field highlighted
User Action: User must provide denial reason
```

### Example Error 3: Secondary Condition Without Primary (VA Rating)

**User enters**:
- Condition Name: "Knee Pain"
- SC Basis: Secondary
- Secondary To: (empty)
- Rating %: 30

**Validation Result**: ❌ FAIL
```
Error: "Primary condition required for secondary conditions"
Form State: Entry NOT added, secondary to field highlighted
User Action: User must specify which condition is primary
```

### Example Error 4: Exposure Without MOS Evaluation (STR)

**User enters**:
- Condition Name: "Burn Pit Respiratory Symptoms"
- Date of Event: "2006-08-15"
- Description: "Cough from burn pit exposure"
- Exposure Type: "Burn Pits"
- MOS Relevant: (unchecked)

**Validation Result**: ❌ FAIL
```
Error: "MOS relevance must be evaluated when exposure type is selected"
Form State: Record NOT added, MOS checkbox field highlighted
User Action: User must check/uncheck MOS Relevant
```

### Example Error 5: Chronicity Without Continuity Notes (STR)

**User enters**:
- Condition Name: "PTSD"
- Date of Event: "2004-03-15"
- Description: "Combat-related stress"
- Chronicity Evidence: "Continuous symptoms throughout 20 years"
- Continuity Notes: (empty)

**Validation Result**: ❌ FAIL
```
Error: "Continuity notes required when chronicity evidence is provided"
Form State: Record NOT added, continuity notes field highlighted
User Action: User must provide continuity notes
```

---

## Test Data for Automated Testing

### VA Rating Test Data

```javascript
const vaRatingTestCases = [
  {
    name: 'Simple Service Connected',
    data: {
      conditionName: 'Tinnitus',
      status: 'Service Connected',
      ratingPercent: 10,
      scBasis: 'direct'
    },
    expectedRating: 10
  },
  {
    name: 'Multiple Conditions',
    data: [
      { conditionName: 'PTSD', status: 'SC', ratingPercent: 70, scBasis: 'direct' },
      { conditionName: 'Sleep', status: 'SC', ratingPercent: 50, scBasis: 'secondary', secondaryTo: 'PTSD' },
      { conditionName: 'Migraine', status: 'SC', ratingPercent: 20, scBasis: 'aggravation', aggravationPercent: 30 }
    ],
    expectedRating: 88
  },
  {
    name: 'Denied Conditions',
    data: [
      { conditionName: 'Claimed', status: 'SC', ratingPercent: 30, scBasis: 'direct' },
      { conditionName: 'Denied', status: 'Denied', denialReason: 'No nexus' }
    ],
    expectedRating: 30,
    expectedDenied: 1
  }
];
```

### STR Test Data

```javascript
const strTestCases = [
  {
    name: 'Simple Injury',
    data: {
      conditionName: 'Knee Injury',
      dateOfEvent: '2003-06-15',
      type: 'injury',
      description: 'Training exercise injury',
      lineOfDuty: 'Yes'
    },
    expectedEventType: 'injury',
    expectedInService: true
  },
  {
    name: 'Exposure with Chronicity',
    data: {
      conditionName: 'Respiratory',
      dateOfEvent: '2006-08-15',
      type: 'exposure',
      description: 'Burn pit exposure',
      exposureType: 'burn pits',
      MOSRelevant: true,
      chronicityEvidence: 'Ongoing cough',
      continuityNotes: 'Persistent 19 years'
    },
    expectedExposures: 1,
    expectedChronic: 1
  }
];
```

---

## Backend Integration - Expected API Calls

### VA Rating Decision API

```bash
POST /api/manual-entries/va-rating
Content-Type: application/json

{
  "conditions": [
    {
      "conditionName": "PTSD",
      "ratingPercent": 70,
      "scBasis": "direct",
      "effectiveDate": "2001-06-15"
    }
  ],
  "veteranId": "V123456",
  "fileName": "VA Rating Decision Manual Entry",
  "submittedAt": "2025-02-21T10:30:00.000Z"
}

Response:
{
  "success": true,
  "entryId": "manual-va-12345",
  "processedConditions": 1,
  "combinedRating": 70,
  "savedAt": "2025-02-21T10:30:15.000Z"
}
```

### STR API

```bash
POST /api/manual-entries/str
Content-Type: application/json

{
  "records": [
    {
      "conditionName": "Respiratory Symptoms",
      "dateOfEvent": "2006-08-15",
      "type": "exposure",
      "description": "Burn pit exposure",
      "exposureType": "burn pits",
      "MOSRelevant": true
    }
  ],
  "veteranId": "V123456",
  "fileName": "Service Treatment Records Manual Entry",
  "submittedAt": "2025-02-21T11:00:00.000Z"
}

Response:
{
  "success": true,
  "entryId": "manual-str-12345",
  "recordsProcessed": 1,
  "exposuresFound": 1,
  "savedAt": "2025-02-21T11:00:15.000Z"
}
```

---

## Document Citation Examples

For documentation/rationale fields, examples include:

### VA Rating Evidence Phrases
- "Service member's own testimony establishes service connection..."
- "Medical evidence clearly shows nexus to military service..."
- "Presumptive condition under 38 USC §1101..."
- "Secondary to service-connected PTSD per 38 CFR §3.310..."
- "Bilateral rating applied per 38 CFR §4.3..."
- "Aggravation of pre-existing condition documented..."

### STR Chronicity Phrase Examples
- "Continuous symptoms with periodic exacerbation..."
- "Multiple hospitalizations and VA clinic visits documented..."
- "Ongoing treatment with..."
- "Symptom pattern consistent throughout service member's post-service lifetime..."
- "Recurrent episodes requiring medical intervention..."

---

**Next**: Use these examples for QA testing, backend validation, and training data.
