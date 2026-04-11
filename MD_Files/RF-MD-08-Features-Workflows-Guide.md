# Rally Forge — Features & Workflows Guide
**Complete feature index and user workflow documentation**

---

## 1. COMPLETE FEATURE INDEX

### Core Claim Features
| Feature | Location | Description |
|---|---|---|
| Veteran Profile Management | `/profile` | Personal info, contact, demographics |
| Military Service Entry | `/military-service` | Service periods, MOS, deployments |
| DD-214 Parsing | `/military-service` | Automated DD-214 document extraction |
| STR Upload & Analysis | `/service-records` | PDF parsing of service treatment records |
| STR AI Analysis | `/service-records` | Claude AI service connection analysis |
| Current Treatment Tracking | `/current-treatment` | Active medical condition tracking |
| VA Decision Import | `/va-decision` | VA rating decision PDF parsing |
| Claim Generator | `/claim-generator-summary` | AI claim summary + export |

### Compensation Features
| Feature | Location | Description |
|---|---|---|
| Real-Time Compensation Calc | `/dashboard` | Live monthly compensation estimate |
| 38 CFR §4.25 Math | Backend | Combined rating formula |
| Bilateral Factor (§4.26) | Backend | Bilateral extremity adjustment |
| SMC Calculation | Backend | Special Monthly Compensation |
| Dependent Addition | Backend | Spouse + children + parent addons |
| Back-Pay Calculation | API | Historical compensation calculation |
| Ancillary Benefits | Backend | A&A, Housebound, auto/clothing |
| 1950–2026 Rate History | Database | 77 years of historical rate data |

### Benefits Intelligence Features
| Feature | Location | Description |
|---|---|---|
| Federal Benefits Identification | `/resources` | GI Bill, VR&E, CHAMPVA, etc. |
| State Benefits (All 50 States) | `/state-benefits` | Property tax, education, employment |
| Benefits Eligibility Engine | Backend | Automated eligibility determination |
| PACT Act Screening | Backend | Toxic exposure presumptive screening |
| Presumptive Condition Check | Backend | Regulatory presumptive matching |
| Service Connection Pathways | Backend | Direct/Secondary/Aggravation/Presumptive |

### AI & Intelligence Features
| Feature | Location | Description |
|---|---|---|
| AI Service Connection Analysis | `/service-records` | Claude AI pathway analysis |
| Evidence Strength Scoring | Backend | 0–100 evidence quality score |
| Evidence Gap Identification | `/claim-generator-summary` | Missing evidence identification |
| Claim Readiness Meter | UI | Visual readiness percentage |
| Priority Queue Builder | `/dashboard` | Ranked action item list |
| Denial Reason Analysis | Backend | Regex + AI denial reason extraction |
| Nexus Opinion Guidance | AI | Medical nexus requirement guidance |

### Document Management
| Feature | Location | Description |
|---|---|---|
| PDF Upload (all types) | Multiple | multer + Bull Queue handling |
| OCR Processing | Backend | Tesseract OCR for scanned docs |
| Multi-Scanner Pipeline | Backend | OCR v2/DD214 v3/STR v3/RD v4.2 |
| Document Confidence Scoring | Backend | Per-field extraction confidence |
| Evidence Bundle Builder | Backend | Compile evidence for submission |
| Export to PDF | `/claim-generator-summary` | Export full claim packet |

### Developer & System Features
| Feature | Location | Description |
|---|---|---|
| System Health Dashboard | `/system-health` | DB, Redis, scanner status |
| Scanner Activity Monitor | `/scanner-activity` | Real-time queue monitoring |
| Developer Tools Workbench | `/developer-tools-workbench` | Internal API testing tools |
| Review Queue | `/review-queue` | Document review workflow |
| Workspace Updates | `/workspace-updates` | Modernization status feed |
| Audit Trail | Backend | Full correlation-ID-linked audit log |

---

## 2. PRIMARY USER WORKFLOW (Step-by-Step)

### STEP 1: Profile Setup (`/profile`)
```
User Inputs:
  ├── First Name, Middle Name, Last Name, Suffix
  ├── Date of Birth
  ├── Social Security Number (last 4 displayed)
  ├── VA File Number (C-Number)
  ├── Phone, Email
  └── Mailing Address

System Actions:
  ├── profileEditorState.js normalizes schema
  ├── Navigation guard activates (warns on unsaved changes)
  └── Workspace saved to localStorage

Completion Signals sidebar step 01 as "Ready"
```

### STEP 2: Military Service (`/military-service`)
```
Option A — Upload DD-214:
  ├── User drags PDF to upload zone
  ├── File queued in Bull/Redis
  ├── DD-214 Scanner v3.0 extracts:
  │   ├── Branch of Service
  │   ├── Dates of Service (entered/released)
  │   ├── MOS/AFSC/NEC code
  │   ├── Character of Discharge
  │   ├── Theater / Deployment history
  │   ├── Awards and decorations
  │   └── Pay grade (highest held)
  └── Results populate workspace.militaryService

Option B — Manual Entry:
  ├── User fills service period form
  ├── MOS/AFSC looked up via MOS registry
  └── Multiple periods supported

System Enrichment:
  ├── MOS validation + civilian equivalent
  ├── Occupational exposure screening
  └── Theater → exposure mapping (Vietnam → Agent Orange check)
```

### STEP 3: Service Treatment Records (`/service-records`)
```
Document Upload:
  ├── PDFs dropped into upload zone
  ├── OCR v2.0 extracts raw text (handles scanned + digital)
  ├── STR Engine v3.0 runs extraction pipeline:
  │   ├── Medical condition identification
  │   ├── Laterality (L/R/bilateral)
  │   ├── Severity level
  │   ├── Date of first occurrence
  │   ├── Follow-up occurrences (count)
  │   ├── Negation filtering (removes "no evidence of X")
  │   └── Confidence scoring (High/Medium/Low)
  │
  └── AI Analysis (if ANTHROPIC_API_KEY configured):
      ├── Per-condition service connection assessment
      ├── Legal pathway (Direct/Secondary/Presumptive)
      ├── CFR citations
      ├── Evidence strength
      └── Recommended actions

Manual Entry:
  ├── STRManualEntry.jsx form
  ├── Add conditions not in documents
  └── Marked as "Manual" confidence level

Workspace Data:
  workspace.serviceTreatmentRecords = {
    uploadedDocuments: [],
    extractedFindings: [],     ← From scanner
    manualEntries: [],         ← User-entered
    confidenceLevels: {
      high: N, medium: N, low: N, manual: N
    }
  }
```

### STEP 4: Current Treatment (`/current-treatment`)
```
Upload current medical records:
  ├── VA medical records
  ├── Private medical records
  └── Specialist reports

Extraction outputs:
  ├── currentConditions[]       ← Active diagnoses
  ├── functionalLimitations[]   ← Work/daily activity impact
  ├── treatmentEvents[]         ← Hospital visits, procedures
  ├── providerSignals[]         ← Provider types mentioned
  ├── medicationMentions[]      ← Medications prescribed
  ├── worseningIndicators[]     ← Progression language
  └── evidenceSnippets[]        ← Key text excerpts

These establish NEXUS (current vs. in-service conditions)
```

### STEP 5: VA Rating Decision (`/va-decision`) [OPTIONAL]
```
For veterans with existing ratings:
  Upload VA Rating Decision letter PDF

Extraction:
  ├── Combined Rating %
  ├── Service Connected Conditions:
  │   └── { condition, rating, effectiveDate, status }
  ├── Denied Conditions:
  │   └── { condition, denialReason, regulation cited }
  ├── SMC Adjustments:
  │   └── { code, amount, basis }
  ├── Dependent Adjustments
  ├── Effective Dates
  └── Payment history

Denial Reason Analysis:
  ├── Regex pattern matching
  ├── AI interpretation (if key present)
  └── Appeal pathway suggestions

Scanner version: v4.2.0-cfr-aware-upgrade
```

### STEP 6: Claim Generator & Summary (`/claim-generator-summary`)
```
Aggregates ALL workspace data from steps 1–5.

AI Summary Generation:
  ├── buildClaimDataUnified() assembles full claim object
  ├── Claude AI generates narrative claim summary
  ├── Service connection arguments per condition
  └── Legal basis (CFR citations) per claim

Readiness Assessment:
  ├── ReadinessMeter.jsx shows 0–100% score
  ├── Evidence gap list per condition
  ├── Priority actions ranked by impact
  └── Form recommendations

Export Options:
  ├── Full claim packet PDF
  ├── Structured data export
  └── Evidence bundle
```

---

## 3. COMPENSATION CALCULATION WORKFLOW

```
Input:
  Rating: 70%
  Dependents: Spouse + 2 children
  SMC: None
  Effective Date: 2026-01-01

Step 1: Year Selection
  year-selector.js → 2026 (current year rates)

Step 2: Base Rate Lookup
  YEARS/2026.json → $1,750.80 (70%, no dependents)

Step 3: Dependent Additions
  Spouse (70% tier): + $126.89
  Child 1: + $52.98
  Child 2: + $52.98
  Subtotal dependents: $232.85

Step 4: SMC Check
  No SMC code → $0.00

Step 5: Ancillary Check
  aidAndAttendance: false → $0.00
  housebound: false → $0.00

Step 6: Total
  $1,750.80 + $232.85 = $1,983.65/month

Step 7: Annual
  $1,983.65 × 12 = $23,803.80/year
```

---

## 4. EVIDENCE ASSESSMENT WORKFLOW

```
CONDITIONS IDENTIFIED (e.g., 8 from STRs):
  ├── Lumbar strain (High confidence, 5 occurrences) ✓
  ├── Left knee pain (High confidence, 3 occurrences) ✓
  ├── Tinnitus (Medium confidence, 1 occurrence) ◐
  ├── Hypertension (Low confidence, 1 occurrence) ○
  ├── PTSD (Manual entry) ◎
  └── [...]

PATHWAY ANALYSIS per condition:
  Lumbar strain:
    ├── Direct SC → High viability
    ├── CFR: §4.71a DC 5237
    ├── Evidence: Strong (multiple STR occurrences)
    └── Action: Get current VA exam

  PTSD:
    ├── Direct SC → Needs stressor statement
    ├── CFR: §4.130 DC 9411
    ├── Evidence: Gap (no stressor documented)
    └── Action: File VA Form 21-0781 (stressor statement)

EVIDENCE GAPS IDENTIFIED:
  ├── No nexus opinion for lumbar strain → Request DBQ
  ├── No stressor statement for PTSD → File 21-0781
  └── No C&P exam for knee → Request exam scheduling
```

---

## 5. CLAIM WORKSPACE PERSISTENCE

### What's Saved
```
Browser localStorage:
  rf_claim_workspace = {
    version: 1,
    profile: { ... },
    militaryService: { ... },
    serviceTreatmentRecords: { ... },
    currentTreatment: { ... },
    vaDecision: { ... },
    claimGeneratorSummary: { ... }
  }

Backend (MongoDB):
  - Onboarding records
  - Benefits computation cache
  - STR extraction results

Browser Events:
  - rf-claim-workspace-updated → cross-tab sync
```

### Navigation Guard Logic
```javascript
shouldAllowNavigation({
  hasUnsavedChanges: true,
  targetPath: '/military-service',
  currentPath: '/profile'
})
// Returns: false → shows warning modal
// Returns: true → allows navigation
```

---

## 6. SCANNER PROCESSING STATES

```
Document Lifecycle:
  UPLOADED → file saved to temp storage
  QUEUED   → Bull job created (jobId returned)
  ACTIVE   → Worker processing (progress: 0–100%)
  COMPLETE → Results stored, available via API
  FAILED   → Error logged, user notified
```

Scanner Activity Page shows:
- All active jobs with progress
- Completed jobs with results links
- Failed jobs with error details
- Queue depth and processing rate

---

## 7. PRIORITY QUEUE ALGORITHM

**File:** `src/pages/dashboard/Dashboard.jsx` — `buildPriorityQueue()`

Generates ranked action items based on what's loaded in the workspace:

```javascript
// Rule 1: Dependents not loaded → HIGH priority action
if (!hasDependentsLoaded) → "Review dependent eligibility now"

// Rule 2: SMC not loaded → HIGH priority action
if (!hasSmc) → "Screen for SMC opportunities"

// Rule 3: Always → evidence building guidance
"Build evidence packet for top denied condition"
```

Priority levels: **high** (red), **medium** (yellow)

---

## 8. FORM RECOMMENDATIONS

**File:** `src/components/FormRecommendationBadges.jsx`
**Map:** `src/services/laneFormMap.js`

Common VA Forms mapped to situations:
| Situation | VA Form |
|---|---|
| Initial claim filing | 21-526EZ |
| Dependency changes | 21-686c |
| PTSD stressor statement | 21-0781 |
| Combat PTSD statement | 21-0781a |
| Aid & Attendance | 21-2680 |
| Unemployability (TDIU) | 21-8940 |
| Higher Level Review | 20-0996 |
| Board Appeal Notice | 10182 |
| Supplemental Claim | 20-0995 |

---

## 9. TESTING COVERAGE

### Automated Tests
```bash
# Compensation regression
npm run test:compensation
  → tests/benefits/compensation-regression.test.js

# Dependent calculation
npm run test:dependents
  → tests/benefits/dependent-calculation.test.js

# STRS engine
npm run test:strs-engine
  → tests/treatment/strs-engine.test.js

# STRS integration
npm run test:strs-integration
  → tests/treatment/strs-integration.test.js

# STR event precision
npm run test:strs-precision
  → tests/treatment/strs-event-precision.test.js

# API smoke tests
npm run test:api-smoke
  → tooling/scripts/run-api-smoke-with-server.mjs

# Analyzer derivations
npm run test:analyzer-derivations

# Profile editor state
npm run test:profile-editor-state

# Profile navigation guard
npm run test:profile-navigation-guard

# Frontend profile UI
npm run test:profile-ui

# Scanner benchmark
npm run test:scanner-benchmark
```

### CI Pipeline
```bash
npm run ci:deploy-gate
  ├── ci:lint            ← ESLint
  ├── ci:typecheck       ← TypeScript
  ├── ci:validate:schema ← JSON schemas
  ├── ci:unit            ← Unit tests
  ├── ci:integration     ← Integration tests
  ├── ci:e2e             ← End-to-end tests
  ├── ci:file-audit      ← File structure audit
  ├── ci:build           ← Production build
  └── ci:package:validate ← Build artifact validation
```

---

## 10. CI/CD & QUALITY CONTROLS

### Ratchet Policy (`docs/CI_RATCHET_POLICY.md`)
- Quality scores cannot regress between commits
- Baseline tracked in snapshot files
- `ci:quality:enforce-baseline` fails build if quality drops

### File Audit (`ci:file-audit`)
- Ensures required files exist
- Checks for orphaned references
- Validates route manifest completeness

### Audit Architecture Scan
**File:** `backend/services/auditArchitectureScanService.js`
- Scans codebase for architecture violations
- Detects missing required patterns
- Reports modernization progress

---

## 11. DEVELOPER TOOLS

### Development Doctor
```bash
npm run dev:doctor
```
- Checks all required environment variables
- Validates port availability
- Confirms database connections
- Tests Redis connectivity
- Verifies AI API key (if set)

### Port Cleanup
```bash
npm run prestart
# Runs: tooling/scripts/free-dev-ports.mjs
# Frees ports 3000, 5173, 5174 before starting
```

### API Audit
```bash
npm run audit:refs
# Scans for missing API references
# Reports broken endpoint links
```

### Rate Database Validation
```bash
npm run validate:rate-database
# Validates all 77 years of rate data
# Checks for missing rates, schema conformance
# Ensures SMC/ANCILLARY rate completeness
```

---

## 12. MODERNIZATION STATUS

**Version:** Backend v2.0 (Fully Modernized)

| Component | Old Version | New Version | Status |
|---|---|---|---|
| OCR Scanner | v1.x | v2.0 | ✅ Complete |
| DD-214 Scanner | v2.x | v3.0 | ✅ Complete |
| STR Scanner | v2.x | v3.0 | ✅ Complete |
| Rating Decision Scanner | v3.x | v4.2 | ✅ Complete |
| Queue System | Sync | Redis Bull v2.0 | ✅ Complete |
| Evidence Graph | v1.0 | v2.0 | ✅ Complete |
| Domain Layer | Direct DB | Repository pattern | ✅ Complete |
| Error Handling | Basic | AppError hierarchy | ✅ Complete |
| Rate Database | Partial | 1950–2026 complete | ✅ Complete |

**Modernization Timeline:** `docs/MASTER_MODERNIZATION_TIMELINE.md`
**Execution Order:** `docs/MASTER_EXECUTION_ORDER.md`
