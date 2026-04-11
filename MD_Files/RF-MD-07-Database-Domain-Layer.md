# Rally Forge — Database & Domain Layer
**Databases:** PostgreSQL (relational) + MongoDB (documents) | **Cache:** Redis

---

## 1. DATA LAYER TOPOLOGY

```
┌─────────────────────────────────────────────────────────────┐
│                     DATA LAYER TOPOLOGY                     │
│                                                             │
│  Application Code                                           │
│        │                                                    │
│        ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  DOMAIN LAYER                       │    │
│  │  backend/domain/                                    │    │
│  │  ├── index.js              ← Unified domain exports │    │
│  │  ├── engines/              ← Business logic         │    │
│  │  │   ├── CompensationEngine.js                      │    │
│  │  │   └── BenefitsEngine.js                          │    │
│  │  └── [repository files]   ← Data access layer       │    │
│  └─────────┬──────────────┬──────────────┬─────────────┘    │
│            │              │              │                  │
│            ▼              ▼              ▼                  │
│     ┌──────────┐   ┌──────────┐  ┌──────────┐             │
│     │PostgreSQL│   │ MongoDB  │  │  Redis   │             │
│     │cp schema │   │Documents │  │  Cache   │             │
│     │(claims)  │   │(records) │  │  Queue   │             │
│     └──────────┘   └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. POSTGRESQL — RELATIONAL CLAIMS DATABASE

**File:** `backend/database/cp_schema/01_cp_relational_schema.sql`
**Connection:** `backend/database/cp_schema/db.js`
**Schema:** `cp` (custom PostgreSQL schema)

### Data Types (Enums)

| Enum | Values |
|---|---|
| `cp.claim_program` | `compensation`, `pension`, `survivor`, `dependency` |
| `cp.claim_type` | `original`, `increase`, `supplemental`, `higher_level_review`, `board_appeal`, `legacy_appeal`, `dependency`, `fiduciary`, `other` |
| `cp.claim_status` | `draft`, `received`, `triage`, `evidence_gathering`, `exam_scheduling`, `rating`, `authorization`, `decided`, `closed`, `cancelled` |
| `cp.contention_type` | `service_connection`, `increase`, `secondary`, `aggravation`, `presumptive`, `special_monthly_compensation`, `tDIU`, `pension_issue`, `dependency_issue`, `other` |
| `cp.contention_disposition` | `granted`, `denied`, `deferred`, `remanded`, `withdrawn`, `dismissed` |
| `cp.evidence_type` | `service_treatment_record`, `private_medical_record`, `va_medical_record`, `lay_statement`, `dbq`, `c_and_p_exam`, `medical_opinion`, `form`, `financial_document`, `other` |
| `cp.exam_status` | `requested`, `scheduled`, `completed`, `cancelled`, `no_show`, `clarification_requested` |
| `cp.decision_type` | `rating_decision`, `hlr_decision`, `board_decision`, `supplemental_decision`, `administrative_decision` |
| `cp.payment_type` | `compensation`, `pension`, `retroactive`, `dependency_adjustment`, `special_monthly_compensation`, `withholding`, `recoupment`, `other` |
| `cp.appeal_lane` | `supplemental`, `higher_level_review`, `board_direct`, `board_evidence`, `board_hearing`, `legacy` |
| `cp.appeal_status` | `received`, `in_review`, `duty_to_assist_error`, `soc_issued`, `ssoc_issued`, `certified_to_board`, `board_pending`, `decided`, `closed` |
| `cp.hearing_type` | `informal_conference`, `dro_hearing`, `board_virtual`, `board_travel`, `board_video`, `none` |
| `cp.audit_actor_type` | `system`, `user`, `service`, `job` |
| `cp.document_source` | `upload`, `va_api`, `scanner`, `manual_entry`, `migration` |

### Database Tables

#### `cp.veterans` — Core Veteran Identity
```sql
veteran_id     UUID PRIMARY KEY    ← System-generated UUID
va_file_number VARCHAR(32) UNIQUE ← VA identifier
first_name     TEXT NOT NULL
middle_name    TEXT
last_name      TEXT NOT NULL
suffix         TEXT
date_of_birth  DATE
date_of_death  DATE
sex_at_birth   TEXT
created_at     TIMESTAMPTZ
updated_at     TIMESTAMPTZ
```

#### `cp.veteran_identifiers` — Multiple ID Types
```sql
identifier_id    UUID PRIMARY KEY
veteran_id       UUID → cp.veterans
identifier_type  TEXT      ← SSN, edipi, biometric, etc.
identifier_value TEXT
issuer           TEXT
effective_from   DATE
effective_to     DATE
is_primary       BOOLEAN
```

#### `cp.service_periods` — Military Service History
```sql
service_period_id UUID PRIMARY KEY
veteran_id        UUID → cp.veterans
branch            TEXT NOT NULL    ← Army, Navy, USMC, etc.
service_component TEXT             ← Active, Guard, Reserve
start_date        DATE NOT NULL
end_date          DATE
characterization  TEXT             ← Honorable, General, etc.
pay_grade         TEXT             ← E-1 through O-10
theater           TEXT             ← Combat theater
deployed          BOOLEAN
```

#### `cp.contacts` — Contact Information
```sql
contact_id   UUID PRIMARY KEY
veteran_id   UUID → cp.veterans
contact_type TEXT    ← phone, email, fax
value        TEXT
is_primary   BOOLEAN
verified_at  TIMESTAMPTZ
```

#### `cp.addresses` — Physical Addresses
```sql
address_id   UUID PRIMARY KEY
veteran_id   UUID → cp.veterans
address_type TEXT    ← home, mailing, legal
line1        TEXT NOT NULL
line2        TEXT
city         TEXT NOT NULL
[+ full address fields]
```

### Additional Tables (Inferred from Schema)
- `cp.claims` — Claim records (linked to veterans, typed by claim_type/status)
- `cp.contentions` — Individual claimed conditions per claim
- `cp.evidence` — Evidence items per claim (by evidence_type)
- `cp.decisions` — Rating decisions per claim
- `cp.payments` — Payment ledger (compensation disbursements)
- `cp.appeals` — Appeal records (by appeal_lane/status)
- `cp.hearings` — Scheduled hearings
- `cp.documents` — Document storage references
- `cp.audit_log` — Full audit trail (actor_type, action, before/after)

### Database Utilities
- **Migrations:** `backend/database/cp_schema/migrations/`
- **Seeds:** `backend/database/cp_schema/seeds/`
- **Routes:** `backend/database/cp_schema/routes/`

---

## 3. MONGODB — DOCUMENT DATABASE

**File:** `backend/database/mongo.js`

Used for flexible document storage:
- Veteran onboarding records (evolving schema)
- Benefits computation cache
- Claim workspace snapshots
- STR extraction results
- Scanner job outputs

### MongoDB Models

#### Veteran Model
**File:** `backend/database/models/veteran.js`
```javascript
// Veteran document schema
{
  _id: ObjectId,
  veteranId: String (UUID),
  profile: {
    firstName, lastName, dob, ssn (hashed),
    contactInfo, address
  },
  serviceHistory: [{
    branch, startDate, endDate, mosCode,
    characterization, deployed
  }],
  createdAt, updatedAt
}
```

#### Onboarding Model
**File:** `backend/database/models/onboarding.js`
```javascript
// Veteran onboarding intake record
{
  _id: ObjectId,
  veteranId: String,
  onboardingResult: {
    rating: Number,
    dependents: { spouse, children, parents },
    conditions: Array,
    exposures: Array,
    serviceConnections: Array
  },
  version: Number,
  completedAt: Date,
  createdAt, updatedAt
}
```

#### Benefits Cache Model
**File:** `backend/database/models/benefitsCache.js`
```javascript
// Cached benefits computation results
{
  _id: ObjectId,
  veteranId: String,
  benefitsResult: {
    compensation: { monthly, annual, breakdown },
    federal: { programs: Array },
    state: { programs: Array }
  },
  computedAt: Date,
  expiresAt: Date,
  version: Number
}
```

---

## 4. DOMAIN LAYER

**Location:** `backend/domain/`

The domain layer sits between services and database, implementing the Repository pattern:

### Domain Index (`backend/domain/index.js`)
Exports all domain objects:
```javascript
export { veteranRepo, benefitsRepo, benefitsEngine, compensationEngine }
```

### Repository Pattern
```
Service Layer          Domain Layer          Database
     │                     │                    │
     ├── getOrCompute ────► │                    │
     │   Benefits()        ├── requireById() ──► mongodb
     │                     ├── getLatest     ──► mongodb
     │                     │   Onboarding()      │
     │                     ├── evaluate()   [in-memory calc]
     │                     └── saveResult() ──► mongodb
     │◄── result ──────────┘
```

### veteranRepo
- `requireById(veteranId)` — Assert veteran exists, throw if not
- `getLatestOnboarding(veteranId)` — Most recent onboarding record
- `save(veteranData)` — Create/update veteran
- `findByVAFileNumber(fileNumber)` — Lookup by VA file number

### benefitsRepo
- `getLatestResult(veteranId)` — Fetch cached benefits
- `saveResult(veteranId, result)` — Cache computation result
- `invalidate(veteranId)` — Bust cache

---

## 5. TYPESCRIPT MODELS

**Location:** `backend/models/` (TypeScript)

```
CfrModel.ts        ← CFR regulation data shapes
DbqModel.ts        ← DBQ form data structures
ExposureModel.ts   ← Toxic exposure record shapes
MosModel.ts        ← MOS/AFSC data structures
ServiceRecordModel.ts ← Military service record shapes
```

These provide type safety for the data pipeline.

---

## 6. REDIS — QUEUE & CACHING

**Purpose:** Two primary uses:
1. **Bull Queue** — Async PDF processing jobs
2. **Application Cache** — Benefits computation caching

### Bull Queue Architecture
**Files:**
- `backend/va_scanner/queue/pdfQueue.js` — Queue definition
- `backend/va_scanner/queue/pdfWorker.js` — Worker process

```
PDF Upload ──► Bull Queue (Redis) ──► pdfWorker polls
                    │                      │
                    │                      ▼
                    │               Process PDF job
                    │               (OCR/extraction)
                    │                      │
                    │◄─── Job Complete ────┘
                    │
                    ▼
            Job Status API
            GET /api/scanner/status/:jobId
```

**Worker Behavior:**
- `startWorker()` called at server startup
- Polls Redis when available; no-op if Redis unavailable
- Graceful degradation (app works without Redis, just synchronously)

### Redis Configuration
```
Host: REDIS_HOST (default: localhost)
Port: REDIS_PORT (default: 6379)
Password: REDIS_PASSWORD (optional)
```

---

## 7. CLIENT-SIDE PERSISTENCE

**Storage:** `localStorage` key: `rf_claim_workspace`

The entire claim workspace is persisted client-side:
```javascript
// Auto-saved on every workspace update
localStorage.setItem('rf_claim_workspace', JSON.stringify(workspace));

// Cross-tab sync
window.dispatchEvent(new Event('rf-claim-workspace-updated'));
```

**Version Control:**
- `WORKSPACE_VERSION = 1` for migration compatibility
- `PROFILE_SCHEMA_VERSION` for profile schema migrations

---

## 8. AUDIT SYSTEM

**File:** `backend/services/auditMetadataService.js`
**Engine:** `backend/engine/auditMetadataEngine.js`

Tracks every significant system event:
```javascript
{
  correlationId: UUID,        ← Ties to HTTP request
  actor: { type, id },        ← Who/what performed the action
  action: String,             ← What was done
  resource: { type, id },     ← What was affected
  before: Object,             ← State before change
  after: Object,              ← State after change
  timestamp: ISO date,
  metadata: Object            ← Additional context
}
```

**Audit Resolution Service:**
`backend/services/auditResolutionService.js` — Resolves audit entries for review

---

## 9. GATEWAY LAYER

**File:** `backend/gateway/gateway.ts`

TypeScript gateway providing:
- Unified access point for external integrations
- VA API connectivity wrapper
- External service abstraction

---

## 10. QUEUE SYSTEM DETAILS

### Job Lifecycle
```
1. Job Created    → status: 'waiting'
2. Worker picks   → status: 'active'
3. Processing     → progress: 0-100%
4. Complete       → status: 'completed', result stored
5. Failed         → status: 'failed', error logged
6. Retry (if cfg) → back to 'waiting'
```

### Job Data Shape
```javascript
{
  jobId: UUID,
  documentType: 'str' | 'dd214' | 'ratingDecision' | 'general',
  filePath: String,
  veteranId: String,
  uploadedAt: ISO date,
  options: {
    ocrFallback: Boolean,
    enhancedMode: Boolean
  }
}
```

---

## 11. DATA FLOW — END TO END

```
UPLOAD FLOW:
Client                Backend              Database/Queue
  │                     │                      │
  ├── POST /scanner/upload ──►│                │
  │   (PDF file)            │── store temp file│
  │                         │── add to queue──►│ Redis Bull
  │◄── { jobId }            │                  │
  │                         │                  │ Worker polls
  │                         │◄─── job start ───┤
  │                         │                  │
  │                         │── extract text   │
  │                         │── parse conditions│
  │                         │── score confidence│
  │                         │── store results──►│ MongoDB
  │                         │── update status──►│ Redis
  │                         │                  │
  ├── GET /scanner/status/:id──►│               │
  │◄── { status: 'completed', result }          │
```

---

## 12. DATA VALIDATION

### Schema Validation
**File:** `backend/validation/` and `app/frontend-modern/src/schemas/`

- JSON Schema validation on API inputs
- Zod-style validation on critical paths
- Type checking via TypeScript (`backend/tsconfig.json`)

### CI Schema Validation
```bash
npm run ci:validate:schema    # Run schema validators
npm run ci:typecheck          # TypeScript type checking
```

---

## 13. SHARED UTILITIES

**Location:** `backend/shared/`

Shared utilities across the backend:
- Error normalizers
- Type coercions (`toInteger()`, `toBoolean()`)
- Date utilities
- String sanitizers
