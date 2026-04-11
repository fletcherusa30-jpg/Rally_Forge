# Rally Forge — Frontend Pages, Routes & Components
**Layer:** React SPA | **Framework:** React 18 + Vite + React Router v6

---

## 1. APPLICATION SHELL

### Entry Point Chain
```
index.html
  └── src/main.jsx          ← ReactDOM.createRoot()
        └── App.jsx          ← BrowserRouter + Providers + Routes
              └── ClaimWorkspaceProvider   ← Global state
                    └── AppLayout.jsx      ← Nav sidebar + page shell
                          └── [Page Component]  ← Lazy-loaded
```

### AppLayout Navigation Sidebar
The sidebar renders numbered primary workflow steps and developer links:

| Icon | Route | Label | Status Logic |
|---|---|---|---|
| 01 | /profile | Profile | complete/pending based on readiness |
| 02 | /military-service | Military Service | complete/pending |
| 03 | /service-records | Service Treatment Records | complete/pending |
| 04 | /current-treatment | Current Treatment | complete/pending |
| 05 | /va-decision | VA Rating Decision | **optional** step |
| 06 | /claim-generator-summary | Claim Generator & Summary | complete/pending |
| 07 | /resources | Resources | complete/pending |
| DV | /developers | Developers | developer-only |

Navigation guards prevent moving forward with unsaved profile changes.

---

## 2. ALL ROUTES

```
/                    → ProfilePage  (default redirect)
/profile             → ProfilePage
/military-service    → MilitaryServicePage
/service-records     → ServiceTreatmentRecordsPage
/current-treatment   → CurrentTreatmentPage
/dashboard           → Dashboard (Mission Control)
/va-decision         → VARatingDecisionPage
/claim-generator-summary  → ClaimGeneratorSummaryPage
/analyzer            → redirect → /claim-generator-summary
/case-summary        → redirect → /claim-generator-summary
/resources           → ToolsPage
/tools               → redirect → /resources
/developers          → DevelopersPage
/developer-tools-workbench → DeveloperToolsWorkbenchPage
/financial-planner   → FinancialPlannerPage
/state-benefits      → StateBenefitsPage
/review-queue        → ReviewQueuePage
/scanner-activity    → ScannerActivityPage
/knowledge-base      → KnowledgeBasePage
/system-health       → SystemHealth
/workspace-updates   → WorkspaceUpdatesPage
/*                   → redirect → /
```

All routes except `/profile` and `/*` are **lazy-loaded** via React.lazy() for performance.

---

## 3. PAGE DESCRIPTIONS

### 01 — Profile Page (`/profile`)
**File:** `src/components/profile/ProfilePage.jsx`
- Veteran personal information intake
- Contact details, identity information
- Profile editor with unsaved changes tracking
- Navigation guard — warns before leaving with unsaved data

### 02 — Military Service Page (`/military-service`)
**File:** `src/pages/MilitaryServicePage.jsx`
- Service period entry (branch, dates, component, MOS/AFSC)
- DD-214 upload and parsing
- Combat status, theater, deployment tracking
- Pay grade and characterization of discharge

### 03 — Service Treatment Records Page (`/service-records`)
**File:** `src/pages/ServiceTreatmentRecordsPage.jsx`
- PDF upload for service treatment records
- AI-powered STR parsing and condition extraction
- Manual entry for conditions not in documents
- Confidence level tracking (High/Medium/Low/Manual)
- Condition categorization and laterality detection
- Negation detection (rules out false positives)

### 04 — Current Treatment Page (`/current-treatment`)
**File:** `src/pages/treatment/CurrentTreatmentPage.jsx`
- Upload current medical treatment records
- Extraction of: current conditions, functional limitations, treatment events, provider signals, medication mentions, worsening indicators, evidence snippets
- Manual entry for additional treatment details

### 05 — VA Rating Decision Page (`/va-decision`)
**File:** `src/pages/benefits/VARatingDecisionPage.jsx`
- Upload existing VA rating decision PDF
- Auto-extraction of: combined rating, service-connected conditions, denied conditions, SMC adjustments, dependent adjustments, effective dates
- Confidence scoring per extracted section
- Manual entry fallback

### 06 — Claim Generator & Summary (`/claim-generator-summary`)
**File:** `src/tabs/claim-generator-summary/ClaimGeneratorSummaryTab.jsx`
- Full AI-powered claim summary generation
- Evidence packet assembly
- Claim readiness score
- Export tools (PDF, structured data)
- Evidence gap identification
- Form recommendation badges
- Source evidence grid

### Dashboard (`/dashboard`)
**File:** `src/pages/dashboard/Dashboard.jsx`
- Mission Control overview
- Compensation Snapshot (Base Monthly, SMC Monthly, Dependent Monthly, Total Estimate)
- Priority queue (action items ranked by impact)
- Links to other sections

### Financial Planner (`/financial-planner`)
**File:** `src/components/financial/FinancialPlannerPage.jsx`
- Budget analysis and financial health scoring
- Retirement projections (TSP, FERS, VA benefits)
- Emergency fund adequacy calculator
- Debt-to-income ratio analysis
- Savings rate optimization

### State Benefits (`/state-benefits`)
**File:** `src/pages/benefits/StateBenefitsPage.jsx`
- State-specific veteran benefits by state
- Property tax exemptions, education benefits, employment preferences, motor vehicle benefits

### Review Queue (`/review-queue`)
**File:** `src/pages/claims/ReviewQueuePage.jsx`
- Pending review items
- Document processing status
- Queue management UI

### Scanner Activity (`/scanner-activity`)
**File:** `src/pages/scanner/ScannerActivityPage.jsx`
- Real-time scanner processing status
- OCR/PDF job status
- Scanner diagnostic information

### Knowledge Base (`/knowledge-base`)
**File:** `src/pages/KnowledgeBasePage.jsx`
- Searchable legal and medical knowledge
- 38 CFR references
- Condition lookup
- Exposure information

### System Health (`/system-health`)
**File:** `src/pages/system/SystemHealth.jsx`
- Backend health check status
- Database connectivity
- Redis queue status
- Scanner version information

### Resources / Tools (`/resources`)
**File:** `src/pages/ToolsPage.jsx`
- Links to VA resources
- External tools
- Reference materials

### Developers (`/developers`)
**File:** `src/pages/DevelopersPage.jsx`
- Developer-only information page
- API documentation references

### Developer Tools Workbench (`/developer-tools-workbench`)
**File:** `src/app/developer/DeveloperToolsWorkbenchPage.jsx`
- Internal developer testing tools
- API smoke test interface

### Workspace Updates (`/workspace-updates`)
**File:** `src/pages/system/WorkspaceUpdatesPage.jsx`
- System modernization status
- Workspace change feed

---

## 4. GLOBAL STATE — ClaimWorkspaceContext

**File:** `src/context/ClaimWorkspaceContext.jsx`

The central state store holds the entire veteran claim workspace:

```
workspace {
  profile: { ... }                         ← Personal info
  profileEditor: {
    hasUnsavedChanges: boolean
  }
  militaryService: {
    records: [],                            ← Service periods
    summary: null,
    updatedAt: null
  }
  serviceTreatmentRecords: {
    uploadedDocuments: [],                  ← PDF documents
    extractedFindings: [],                  ← AI-extracted conditions
    manualEntries: [],                      ← Manually entered conditions
    confidenceLevels: {
      high: 0, medium: 0, low: 0, manual: 0
    },
    summary: null
  }
  currentTreatment: {
    uploadedDocuments: [],
    extractedFindings: {
      currentConditions: [],
      functionalLimitations: [],
      treatmentEvents: [],
      providerSignals: [],
      medicationMentions: [],
      worseningIndicators: [],
      evidenceSnippets: []
    },
    manualEntries: []
  }
  vaDecision: {
    manualEntries: [],
    extractedFindings: {
      combinedRating: '',
      decisionMetadata: {},
      serviceConnectedConditions: [],
      deniedConditions: [],
      smcAdjustments: [],
      dependentAdjustments: [],
      effectiveDates: [],
      confidenceBySection: {},
      evidenceSpans: []
    }
  }
  claimGeneratorSummary: { ... }           ← AI-generated claim summary
}
```

**Persistence:** localStorage key `rf_claim_workspace` + cross-tab sync via `rf-claim-workspace-updated` events.

**Derived State:** `workspaceDerivations.js` computes workflow readiness, navigation permissions, completion percentages.

---

## 5. KEY COMPONENTS

### Upload & Intake
| Component | Purpose |
|---|---|
| `UploadIntake.jsx` | PDF drag-and-drop upload handler |
| `ManualIntake.jsx` | Structured manual data entry forms |
| `ManualEntrySelector.jsx` | Toggle between upload and manual entry |
| `STRManualEntry.jsx` | Manual service treatment record entry |

### Evidence & Claim
| Component | Purpose |
|---|---|
| `EvidenceIndexCard.jsx` | Evidence item display card |
| `EvidenceGapList.jsx` | Missing evidence identification UI |
| `SourceEvidenceGrid.jsx` | Tabular evidence source view |
| `WorkflowCarryForwardCard.jsx` | Cross-step data propagation status |
| `ClaimSignalsBar.jsx` | Visual signal strength indicator |

### Results & Scoring
| Component | Purpose |
|---|---|
| `ReadinessMeter.jsx` | Visual readiness percentage gauge |
| `ScoreFactorList.jsx` | Score breakdown by factor |
| `CompensationBreakdownCard.jsx` | Monthly compensation item-by-item |
| `BenefitReport.jsx` | Full benefits report rendering |

### Benefits & Financial
| Component | Purpose |
|---|---|
| `FederalBenefitsUI.jsx` | Federal benefits display |
| `StateBenefitsUI.jsx` | State-specific benefits UI |
| `FormRecommendationBadges.jsx` | VA form recommendations (21-526EZ, etc.) |

### Utility
| Component | Purpose |
|---|---|
| `Card.jsx` | Base card container component |
| `InfoPopup.jsx` | Inline information tooltip |
| `ExportToolbar.jsx` | PDF/data export controls |
| `KnowledgeWidget.jsx` | Inline knowledge lookups |

---

## 6. FRONTEND SERVICES

### Profile Services (`src/services/profile/`)
- `profileEditorState.js` — Profile schema normalization + versioning (PROFILE_SCHEMA_VERSION)
- `profileNavigationGuard.js` — Navigation guard logic (`shouldAllowNavigation()`)

### API Client (`src/api/`)
- `client.js` — Base API client with `getCompensationData()`, `getClaimWorkspace()`, `saveClaimWorkspace()` and all backend API calls

### Utility Services
- `caseSummaryExport.js` — Export claim summary to PDF/structured data
- `compensationUtils.js` — Frontend compensation formatting helpers
- `laneFormMap.js` — Maps appeal lanes to VA form numbers
- `normalization/` — Data normalization helpers
- `professionalSearch/` — Professional provider search helpers

---

## 7. TABS

### Claim Generator Summary Tab (`src/tabs/claim-generator-summary/`)
- `ClaimGeneratorSummaryTab.jsx` — Main tab rendering
- `schema.js` — `createClaimGeneratorSummarySection()` — data schema builder

### Military Service Tab (`src/tabs/military-service/`)
### Current Treatment Tab (`src/tabs/current-treatment/`)
### STR Tab (`src/tabs/strs/`)
### Rating Decision Tab (`src/tabs/rating-decision/`)

---

## 8. STATE MANAGEMENT — claimDataUnified

**File:** `src/state/claimDataUnified/index.js`

`buildClaimDataUnified()` — Assembles the full unified claim data object from all workspace sections, used for claim summary generation and export.

---

## 9. TESTING (Frontend)

| Test Type | Runner | Location |
|---|---|---|
| Component unit tests | Vitest + React Testing Library | `src/tests/` |
| Profile page interactions | `vitest run` | `src/tests/profile-page.interactions.test.jsx` |
| STR feedback UI | Custom runner | `tooling/scripts/run-vitest-feedback-safe.mjs` |

Run: `npm run test:profile-ui` or `npm run test:strs-feedback-ui`
