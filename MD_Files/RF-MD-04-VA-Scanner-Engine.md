# Rally Forge — VA Scanner Engine
**Version:** Scanner v4.2.0-cfr-aware-upgrade | **Queue:** Redis Bull v2.0

---

## 1. SCANNER ARCHITECTURE OVERVIEW

```
DOCUMENT UPLOAD
      │
      ▼
┌─────────────────┐
│  multer upload  │  ← PDF file received via multipart/form-data
│  /api/scanner   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   pdfQueue.js   │  ← Bull queue (Redis-backed async processing)
│  Bull v2.0      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  pdfWorker.js   │  ← Background worker process
│  (Redis poll)   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              UnifiedScannerEngine.js                    │
│  Selects parser based on document type:                 │
│  ├── DD-214 Scanner v3.0                               │
│  ├── STR Scanner v3.0                                  │
│  ├── VA Rating Decision Scanner v4.2                   │
│  └── OCR Scanner v2.0 (fallback)                       │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐        ┌─────────────────────────────┐
│  vaSuperScanner │◄──────►│  Veteran Evidence Graph v2.0 │
│  (core engine)  │        │  backend/va_scanner/graph/   │
└─────────────────┘        └─────────────────────────────┘
```

---

## 2. SCANNER TYPES

### OCR Scanner v2.0
**File:** `backend/va_scanner/engine/pdf/pdfExtractor.js`
- Base-level PDF text extraction
- Tesseract OCR fallback for image-based PDFs
- Text normalization for downstream parsing
- Handles scanned documents and digital PDFs

### DD-214 Scanner v3.0
**Role:** Military service record parsing
- Extracts: branch, dates of service, MOS/AFSC, character of discharge, theater, deployments, awards
- Field-mapped extraction using positional analysis
- Linked to MOS validation engine

### STR Scanner v3.0 (Service Treatment Records)
**File:** `backend/engine/strs/strs-engine.js`
- Medical condition extraction from narrative text
- Condition categories: musculoskeletal, mental health, neurological, gastrointestinal, cardiovascular, etc.
- Laterality detection (left/right/bilateral)
- Severity extraction
- Negation detection (rules out "no evidence of X" false positives)
- Date and provider attribution
- Confidence scoring (High/Medium/Low per condition)

### VA Rating Decision Scanner v4.2
**File:** `backend/va_scanner/frontend/utils/scannerEnhanced.js`
- Extracts combined disability rating percentage
- Service-connected conditions with individual ratings
- Denied conditions with denial reason analysis
- SMC (Special Monthly Compensation) codes and amounts
- Dependent adjustments
- Effective dates
- TDIU (Total Disability Individual Unemployability) indicators
- Evidence spans linking to specific text passages

---

## 3. VA SUPER SCANNER (Core Engine)

**File:** `backend/va_scanner/engine/vaSuperScanner.js`
**Version:** `4.2.0-cfr-aware-upgrade`

### CFR Mathematical Operations

#### Combined Rating Formula (38 CFR §4.25)
```
WHOLE-PERSON CONCEPT:
- Veteran starts at 100% whole person efficiency
- Each disability removes % from remaining efficiency
- Combined highest-to-lowest

Example: 50% + 30% + 10%
  Step 1: 100% - 50% = 50% remaining  → 50% disabled
  Step 2: 50%  - (30% × 50%) = 35% remaining → 65% disabled
  Step 3: 35%  - (10% × 35%) = 31.5% remaining → 68.5% disabled
  Round: 68.5% → 70% (rounds to nearest 10%)

Rounding rule (§4.25): 1-4 round down, 5-9 round up
```

#### Bilateral Factor (38 CFR §4.26)
```
Applies when BOTH extremities (arms or legs) are rated:
  1. Calculate combined rating for bilateral conditions
  2. Add 10% of that combined value as bilateral factor
  3. Combine bilateral-factor-adjusted rating with remaining ratings
```

#### SMC Detection (`smc-detector.js`)
```
detectSMC() — Pattern matches decision text for explicit SMC codes:
  SMC-K: Loss/loss of use of specific body part
  SMC-L: Aid and attendance (single) / housebound
  SMC-M through SMC-T: Progressive levels of A&A / loss of use
  SMC-S: Housebound (statutory)
  SMC-O: Bilateral amputations / multi-part loss

inferSMC() — Infers possible SMC from condition combinations
```

#### Ancillary Benefits Detection (`ancillary-benefits-detector.js`)
```
Screens for entitlement to:
  - TDIU (Total Disability Individual Unemployability)
  - Aid and Attendance
  - Housebound Status
  - Automobile Adaptive Equipment
  - Clothing Allowance
  - Dependency benefits
```

---

## 4. CFR RULES ENGINE

### CFR Part 3 Rules (`backend/va_scanner/knowledge/cfr-part3-rules.js`)
- Service connection type determination:
  - **Direct** — condition present in service records
  - **Secondary** — condition caused/aggravated by SC condition
  - **Aggravation** — pre-existing condition worsened in service
  - **Presumptive** — legally presumed without direct evidence
  - **PACT Act** — toxic exposure presumptives (post 2022)

### CFR Part 4 Rules (`backend/va_scanner/knowledge/cfr-part4-rules.js`)
- CFR terminology normalization (maps lay terms → CFR diagnostic codes)
- Bilateral applicability check (which conditions qualify for bilateral factor)
- Diagnostic code lookup

---

## 5. EXTRACTION UTILITIES

**Location:** `backend/va_scanner/frontend/utils/`

| Utility | Purpose |
|---|---|
| `extractClaimantInfo.js` | Extract veteran name, SSN, VA file number, DOB |
| `extractTDIU.js` | Detect TDIU claims and entitlement |
| `extractCombatStatus.js` | Identify combat veteran designations |
| `extractSMC.js` | Parse SMC codes from decision text |
| `extractServiceConnected.js` | Extract service-connected conditions + ratings |
| `extractDenied.js` | Extract denied conditions + denial reasons |
| `extractDependents.js` | Parse dependent information and adjustments |
| `extractEvidence.js` | Identify evidence references and citations |
| `extractPayments.js` | Parse payment amounts and retroactive pay |
| `extractAncillary.js` | Ancillary benefit detections |
| `benefitScan.js` | Full benefit scan orchestration |
| `pactActDetection.js` | PACT Act toxic exposure screening |
| `textNormalizer.js` | Normalize whitespace, OCR artifacts |
| `scannerEnhanced.js` | Enhanced scanner with multi-pass extraction |
| `pdfExtractor.js` | Raw PDF/OCR extraction |

---

## 6. CONFIDENCE SCORING

**File:** `backend/va_scanner/engine/confidenceScorer.js`

```
ExtractionScorer class methods:
  .score(extraction)    → 0.0 – 1.0 confidence score
  .classify(score)      → 'high' | 'medium' | 'low'
  .explain(extraction)  → Human-readable confidence rationale

Scoring Factors:
  - Text clarity (OCR quality)
  - Pattern match precision
  - Contextual corroboration
  - Field completeness
  - Multiple occurrence confirmation
```

---

## 7. VA RATE DATABASE

**Location:** `backend/va_scanner/rates/`

### Historical Compensation Rates
- **Coverage:** 1950 – 2026 (77 years)
- **Format:** JSON per year
- **Path:** `rates/YEARS/{year}.json`
- **Content:** Disability percentages 10%-100% with/without dependents

### SMC (Special Monthly Compensation) Rates
- **Coverage:** 1950 – 2026
- **Path:** `rates/SMC/{year}.json`
- **Codes:** SMC-K through SMC-T, plus combinations

### SMC Dependent Rates
- **Path:** `rates/SMC_DEPENDENTS/`
- Additional dependent adjustments for SMC recipients

### Ancillary Benefit Rates
- **Path:** `rates/ANCILLARY/`
- Aid and Attendance, Housebound, auto/clothing allowances

### Rate Manifests
- **Path:** `rates/MANIFESTS/`
- Validation manifests, year availability index
- Validation: `npm run validate:rate-database`

### 2026 SMC Metadata
- **File:** `rates/2026_smc.meta.json`
- Current year SMC rates with legislative references

---

## 8. DENIAL REASON ANALYSIS

### Regex Extractor (`backend/engine/DenialReasonRegexExtractor.js`)
Pattern-based extraction of:
- "no nexus established"
- "no in-service occurrence"
- "not well-grounded"
- "insufficient medical evidence"
- "not service-connected"
- Pre-existing condition language

### LLM Template (`backend/engine/DenialReasonLLMTemplate.js`)
AI-powered denial reason analysis for:
- Complex multi-part denials
- Legal language interpretation
- Appeal pathway suggestions

---

## 9. EVIDENCE GRAPH v2.0

**Location:** `backend/va_scanner/graph/`

### Graph Components

| Directory | Purpose |
|---|---|
| `bundles/evidenceBundleBuilder.js` | Assembles evidence node bundles |
| `insights/` | Evidence pattern insights and recommendations |
| `integration/` | External data source integrations |
| `observability/` | Graph telemetry and monitoring |
| `registry/` | Evidence node type registry |
| `schema/` | Evidence graph schema definitions |
| `validators/` | Graph data validation |
| `verification/` | Evidence verification workflows |

### How the Evidence Graph Works
```
Each condition becomes a NODE in the graph with:
  - Source documents (STRs, CPs, private records)
  - In-service occurrence evidence
  - Nexus links (connecting in-service to current condition)
  - Rating decision references
  - CFR legal basis

EDGES represent relationships:
  - Direct causation (condition A caused condition B)
  - Aggravation links
  - Temporal relationships (in-service → post-service)
  - Documentation corroboration

OUTPUT: Evidence completeness score + gap identification
```

---

## 10. STRS ENGINE (Service Treatment Records)

**Files:**
- `backend/engine/strs/strs-engine.js` — Main extraction engine
- `backend/engine/strs/strs-normalization.js` — Text normalization
- `backend/engine/strs/strs-validation.js` — Result validation

### STR Extraction Pipeline
```
1. PDF TEXT EXTRACTION
   └── pdfExtractor.js → raw text

2. TEXT NORMALIZATION
   └── strs-normalization.js → clean, structured text

3. CONDITION EXTRACTION
   └── strs-engine.js
       ├── Pattern matching (regex + NLP patterns)
       ├── Medical terminology recognition
       ├── Condition categorization
       ├── Laterality detection
       ├── Severity extraction
       ├── Date attribution
       └── Negation filtering

4. AI ANALYSIS (optional, requires ANTHROPIC_API_KEY)
   └── strsAiAnalyzerService.js
       ├── Service connection assessment
       ├── Legal pathway identification
       ├── CFR citation recommendation
       └── Evidence strength scoring

5. CONFIDENCE SCORING
   └── ExtractionScorer → per-condition confidence

6. VALIDATION
   └── strs-validation.js → output schema validation
```

### Condition Categories Extracted
- Musculoskeletal (back, knee, shoulder, etc.)
- Mental Health (PTSD, depression, anxiety)
- Neurological (TBI, headaches, neuropathy)
- Hearing (hearing loss, tinnitus)
- Respiratory (asthma, sleep apnea)
- Cardiovascular (hypertension, CAD)
- Gastrointestinal (GERD, IBS)
- Dermatological (skin conditions)
- Ophthalmological (vision conditions)
- Genitourinary (bladder, kidney)
- Presumptive Conditions (Agent Orange, Gulf War, PACT Act)

---

## 11. SCANNER DIAGNOSTICS

**File:** `backend/api/scannerDiagnostics.js`

```
GET /api/scanner/diagnostics
  Returns:
  {
    scanners: {
      ocr: { version: '2.0', status, lastJob, errorCount },
      dd214: { version: '3.0', status, ... },
      str: { version: '3.0', status, ... },
      ratingDecision: { version: '4.2', status, ... }
    },
    queue: { pending, active, completed, failed },
    uptime: seconds
  }
```

---

## 12. PACT ACT SCREENING

**File:** `backend/va_scanner/frontend/utils/pactActDetection.js`

Screens for PACT Act (Sergeant First Class Heath Robinson Act, 2022) eligibility:
- **Burn Pit Exposure** — Southwest Asia deployments post-08/02/1990
- **Agent Orange** — Vietnam/Korea/Thailand/Guam service periods
- **Radiation** — Nuclear testing / Hiroshima / Nagasaki / Palomares / Thule
- **Camp Lejeune** — Service 08/01/1953 – 12/31/1987
- **Ionizing Radiation** — Nuclear weapons testing
- **Project 112/SHAD** — Chemical/biological testing participants

Detection returns:
```json
{
  "eligible": true,
  "exposureType": "burn_pit",
  "deployments": ["Iraq 2004-2005"],
  "presumptiveConditions": ["rhinitis", "sinusitis", "rare cancers"]
}
```
