# Rally Forge Architecture Documentation

**Last Updated:** February 27, 2026  
**Version:** 1.0  
**Status:** Canonical Stack Established

---

## Executive Summary

Rally Forge is a comprehensive VA benefits analysis and financial planning platform. This document defines the **canonical (active) architecture** that all development should follow. Legacy implementations exist but are not wired into the active stack.

---

## Canonical Architecture Stack

### Core Directories

| Component | Path | Purpose |
|-----------|------|---------|
| **Backend** | `C:\Dev\Rally Forge\backend` | Express.js API server on port 4000 |
| **Frontend** | `C:\Dev\Rally Forge\app\frontend-modern` | React + Vite frontend on port 5173 |
| **Scanner Core** | `C:\Dev\Rally Forge\VA SCANNER` | Document scanning & extraction engine |
| **Compensation** | `C:\Dev\Rally Forge\compensation-engine` | VA ratings & benefit calculations |
| **Financial Planner** | `C:\Dev\Rally Forge\FINANCIAL PLANNER` | Retirement & scenario modeling |
| **Shared Libraries** | `C:\Dev\Rally Forge\packages\shared-data` | Shared data models & utilities |
| **Search** | `C:\Dev\Rally Forge\packages\lighthouse` | Lighthouse search & indexing |
| **Knowledge Base** | `C:\Dev\Rally Forge\knowledge` | VA regulations & reference documents |

### Legacy (Not Wired)

The following directories exist but are **NOT** part of the active stack:

- `app\backend` (legacy duplicate)
- `app\frontend` (legacy duplicate)
- `STRS_SCANNER` (specialized scanner - features to be consolidated)
- `STATE BENEFITS` (legacy module)
- `frontend\scanner` (orphaned component)
- `backend\va_scanner` (archive placeholder)
- `new_scanner` (archive placeholder)

---

## Component Details

### 1. Backend (Express.js)

**Location:** `backend/`

**Core Files:**
- `server.js` - Express server entry point (port 4000)
- `app.js` - Express app configuration & middleware
- `package.json` - Dependencies & scripts

**Structure:**
```
backend/
├── api/              # Route handlers
├── services/         # Business logic
├── engine/           # Feature extraction & transformation
├── database/         # Database connections & queries
├── middleware/       # Express middleware
├── rules/            # Business rules (JSON)
├── shared/           # Shared utilities
├── utils/            # Helper functions
└── tests/            # Unit & integration tests
```

**Scripts:**
- `npm start` - Run production server
- `npm run dev` - Run development server

**API Routes:**
- `/api/health` - Health check endpoint
- `/api/scanner/*` - Scanner endpoints (mounted from VA SCANNER)
- `/api/compensation/*` - Compensation calculation endpoints
- `/api/financial/*` - Financial planning endpoints

---

### 2. Frontend (React + Vite)

**Location:** `app/frontend-modern/`

**Core Files:**
- `index.html` - HTML entry point
- `main.jsx` - React DOM render entry
- `App.jsx` - Main app component & routing
- `vite.config.js` - Vite configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS plugins

**Component Structure:**
```
src/
├── pages/
│  ├── Dashboard.jsx                    # Home/overview
│  ├── ScannerHub.jsx                   # Scanner interface
│  │  ├── VARatingDecision component
│  │  └── ServiceTreatmentRecords component
│  └── FinancialPlannerPage.jsx         # Financial planning
│
├── components/
│  ├── Card.jsx                         # Reusable card component
│  ├── ManualConditionEntry.jsx         # Manual data entry form
│  └── [other UI components]
│
├── layouts/
│  └── AppLayout.jsx                    # Main layout (sidebar + content)
│
├── theme/
│  └── colors.js                        # Color palette & design tokens
│
├── services/                           # API client functions
├── utils/                              # Utility functions
└── App.jsx                             # App routing & state
```

**Navigation:**
- Dashboard (`/`)
- VA Rating Decision Scanner (`/scanner`)
- Service Treatment Records (`/service-records`)
- Financial Planner (`/financial-planner`)
- Claims Intelligence (`/claims-intelligence`)
- Benefits Advisory (`/benefits-advisory`)
- Knowledge Center (`/knowledge-center`)
- AI Advisor (`/ai-advisor`)

**Scripts:**
- `npm run dev` - Start dev server (port 5173)
- `npm run build` - Build for production
- `npm run preview` - Preview production build

---

### 3. VA Scanner Core

**Location:** `backend/va_scanner/`

**Purpose:** Extract conditions, ratings, and effective dates from VA documents

**Runtime Structure:**
```
backend/va_scanner/
├── backend/shared/scanner/             # DD-214, STR, Current Treatment, Rating Decision scanners
├── engine/                             # Rating decision and PDF extraction helpers
├── frontend/utils/                     # Shared extraction helpers still imported by backend runtime
├── graph/                              # Evidence graph processing
└── queue/                              # PDF queue and worker
```

**API Endpoints:**
- `POST /api/scanner/scan-pdf` - Scan rating decision PDF
- `POST /api/scanner/scan-dd214` - Scan DD-214 PDF
- `POST /api/scanner/scan-str-text` - Scan STR text
- `POST /api/scanner/scan-current-treatment-text` - Scan current treatment text
- `POST /api/scanner/scan-current-treatment-pdf` - Scan current treatment PDF
- `POST /api/scanner/scan-va-decision` - Scan VA decision text
- `GET /api/scanner/diagnostics` - Scanner diagnostics

**Returns:**
```javascript
{
  serviceConnected: [
    { condition, percentage, effectiveDate },
    ...
  ],
  denied: [
    { condition, effectiveDate },
    ...
  ],
  ratingCalculation: {
    calculatedCombinedRating: "30%",
    hasBilateralPairs: false
  },
  metadata: {
    ratingDecisionDate: "2026-02-01",
    allEffectiveDates: ["2026-02-01", ...]
  },
  compensation: {
    baseMonthly: 684,
    baseYearly: 8208,
    totalMonthly: 784,
    totalYearly: 9408
  }
}
```

---

### 4. Compensation Engine

**Location:** `compensation-engine/`

**Purpose:** Calculate VA compensation based on ratings, dependents, and SMC codes

**Core Files:**
- `index.js` - Main export functions
- `year-selector.js` - Rate year management
- `validators.js` - Input validation

**Rates Directory:**
```
rates/
├── 2023.json
├── 2024.json
├── 2025.json
└── 2026.json
```

**Primary Functions:**

```javascript
// Get compensation by combined rating
getCompensationByRating(rating, year = 2026)
  → { baseMonthly, baseYearly }

// Get Special Monthly Compensation
getSMCAmount(smcCode, year = 2026)
  → number (monthly dollar amount)

// Get ancillary benefits
getAncillaryBenefits(benefits, year = 2026)
  → { total, breakdown }

// Complete calculation
calculateVeteranCompensation(rating, smcCode, dependents, ancillaryBenefits, year)
  → {
      rating,
      smcCode,
      dependents,
      baseMonthly,
      smcMonthly,
      ancillaryMonthly,
      totalMonthly,
      totalYearly
    }
```

---

### 5. Financial Planner

**Location:** `FINANCIAL PLANNER/`

**Purpose:** Model scenarios, project lifetime VA income, and plan retirement

**Core Files:**
- `financial-engine.js` - Financial calculations & projections
- `README.md` - Module documentation

**Integration:**
- Backend endpoints: `/api/financial/*`
- Frontend page: `FinancialPlannerPage.jsx`
- Compensation engine integration for rate lookups

**Features (Planned):**
- Scenario modeling (different ratings, dependents, SMC)
- Lifetime value calculations using VA life expectancy tables
- Comparison tools for multiple scenarios
- Retirement planning projections

---

### 6. Shared Libraries

#### `packages/shared-data`
Shared data models, constants, and utilities used across frontend and backend.

#### `packages/lighthouse`
Search and indexing library for VA regulations, conditions, and knowledge base.

---

### 7. Knowledge Base

**Location:** `knowledge/`

**Purpose:** Store and index VA regulations, presumptive conditions, and reference documents

**Contents:**
- CFR Part 3 & 4 (VA rating schedules)
- PACT Act documentation
- Presumptive conditions by exposure
- State benefit rules

---

## Development Workflow

### Setting Up Your Environment

```bash
# Clone & navigate
cd "C:\Dev\Rally Forge"

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ..\app\frontend-modern
npm install
cd ..\..

# Verify scanner, compensation, and financial planner dependencies
cd "VA SCANNER"
npm install
cd "..\compensation-engine"
npm install
cd "..\FINANCIAL PLANNER"
npm install
```

### Running the Application

#### Terminal 1: Backend
```bash
cd backend
npm start
# Listens on http://localhost:4000
```

#### Terminal 2: Frontend
```bash
cd app\frontend-modern
npm run dev
# Listens on http://localhost:5173 (or next available port)
```

#### Verify Health
```bash
curl http://localhost:4000/api/health
# Should return: { "status": "ok", "timestamp": "..." }
```

---

## API Contract

### Scanner Endpoints

**POST `/api/scanner/scan-text`**

Request:
```json
{
  "text": "VA Rating Decision document text...",
  "scanType": "ratingDecision" | "serviceRecords"
}
```

Response:
```json
{
  "serviceConnected": [...],
  "denied": [...],
  "ratingCalculation": {...},
  "metadata": {...},
  "compensation": {...}
}
```

**POST `/api/scanner/scan-pdf`**

Request: `FormData` with:
- `file`: PDF file
- `scanType`: "ratingDecision" | "serviceRecords"

Response: Same as `/scan-text`

### Compensation Endpoints (Planned)

**POST `/api/compensation/calculate`**

Request:
```json
{
  "rating": 30,
  "smcCode": "a1",
  "dependents": 0,
  "effectiveDate": "2026-02-01",
  "year": 2026
}
```

Response:
```json
{
  "rating": 30,
  "baseMonthly": 684,
  "smcMonthly": 150,
  "ancillaryMonthly": 0,
  "totalMonthly": 834,
  "totalYearly": 10008
}
```

---

## Import Patterns

### Backend Imports
```javascript
// From root canonical backend
import { app } from './backend/app.js';
import { calculateCompensation } from '../compensation-engine/index.js';
import { getVeteranBenefits } from './backend/services/benefits-service.js';
```

### Frontend Imports
```jsx
// From canonical components
import { Card } from './components/Card';
import { ManualConditionEntry } from './components/ManualConditionEntry';
import { VARatingDecision } from './pages/ScannerHub';
```

### Scanner Imports
```javascript
// From the canonical scanner runtime
import scannerRouter from '../backend/api/scanner.js';
import { extractDependents } from '../backend/va_scanner/frontend/utils/extractDependents.js';
```

---

## File Status Legend

From `_ScannerAudit/rf-architect-repair-report.txt`:

| Status | Meaning |
|--------|---------|
| ✓ OK | File exists and is wired into canonical stack |
| ✗ WARN | File missing (create stub or locate replacement) |
| → ACTION | File created or action taken |

---

## Diagnostic & Repair

### Running the Diagnostic
```bash
cd _ScannerAudit
powershell -ExecutionPolicy Bypass -File rf-architect-repair.ps1
# Generates: rf-architect-repair-report.txt
```

The diagnostic script:
- Verifies all canonical directories exist
- Checks for required core files
- Creates stubs for missing components
- Logs all actions with timestamps
- Is **idempotent** (safe to run multiple times)
- Never deletes existing files

---

## Next Steps

### Immediate (Session 1)
- [x] Identify canonical architecture
- [x] Run diagnostic & repair script
- [x] Create ARCHITECTURE.md
- [ ] Fix broken imports (from diagnostic-report.txt)
- [ ] Ensure backend & frontend start cleanly

### Short Term (Session 2-3)
- [ ] Wire scanner routes into backend (`/api/scanner/*`)
- [ ] Wire compensation endpoints (`/api/compensation/*`)
- [ ] Implement FinancialPlannerPage UI
- [ ] Test end-to-end scanner → compensation flow

### Medium Term (Session 4+)
- [ ] Consolidate positive features from STRS_SCANNER
- [ ] Enhance compensation engine with 2026 rates
- [ ] Build Financial Planner projection engine
- [ ] Implement knowledge base indexing
- [ ] Add unit & integration tests

### Cleanup (Final)
- [ ] Archive legacy directories
- [ ] Create LEGACY.md index
- [ ] Remove legacy imports
- [ ] Verify all paths resolve

---

## Key Contacts & References

- **Canonical Backend:** `backend/server.js` (entry point)
- **Canonical Frontend:** `app/frontend-modern/index.html` (entry point)
- **Canonical Scanner:** `VA SCANNER/backend/scannerRoute.js` (routes)
- **Compensation Engine:** `compensation-engine/index.js` (calculations)
- **Diagnostic Report:** `_ScannerAudit/rf-architect-repair-report.txt` (status)

---

## Appendix: Diagnostic Findings Summary

### Tested Components (9 Phases)
1. ✓ Canonical directory structure: **ALL PRESENT**
2. backend core files: **package.json MISSING** (create stub)
3. frontend-modern core files: **ALL PRESENT**
4. ✓ VA Scanner core files: **ALL PRESENT**
5. ✓ Compensation engine: **ALL PRESENT** (rates exist 2023-2026)
6. ✓ Financial Planner: **ALL PRESENT**
7. ✓ Shared packages: **ALL PRESENT**
8. ✓ Knowledge base: **PRESENT**
9. Backend node_modules: **MISSING** (run `npm install` in backend/)

### Critical Missing Files
- `backend/package.json` → Create stub with canonical dependencies

### Next Validation Run
```bash
cd _ScannerAudit
powershell -ExecutionPolicy Bypass -File rf-architect-repair.ps1
```

Expected output: All components green (✓ OK).

---

**Document Version:** 1.0  
**Last Generated:** 2026-02-27 22:54:57  
**Script Version:** rf-architect-repair.ps1 v1.0
