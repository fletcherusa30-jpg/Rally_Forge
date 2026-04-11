# Rally Forge — App Overview & Topographic Map
**Version:** 0.2.0 | **Date:** April 5, 2026 | **Environment:** Node.js + React (Full-Stack)

---

## 1. MISSION STATEMENT

Rally Forge is a full-stack Veterans Affairs benefits intelligence platform. It assists U.S. military veterans in building, analyzing, and maximizing VA disability claims by:

- Parsing and analyzing PDF documents (DD-214, Service Treatment Records, VA Rating Decisions)
- Computing accurate disability compensation using official 38 CFR rules
- Identifying service connection pathways and legal basis for each claimed condition
- Generating AI-assisted claim summaries and evidence packages
- Providing federal and state benefits intelligence tailored to each veteran's profile

---

## 2. HIGH-LEVEL SYSTEM TOPOLOGY

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          RALLY FORGE SYSTEM                             │
│                                                                         │
│  ┌────────────────────────────┐    ┌────────────────────────────────┐   │
│  │     REACT FRONTEND         │    │      EXPRESS BACKEND v2.0      │   │
│  │  (Vite + React 18 + SPA)   │◄──►│  (Node.js ESM + REST API)      │   │
│  │  Port: 5173 / 5174         │    │  Port: 3000                    │   │
│  └────────────────────────────┘    └──────────┬─────────────────────┘   │
│                                               │                         │
│                          ┌────────────────────┼──────────────────┐      │
│                          ▼                    ▼                  ▼      │
│                ┌──────────────┐    ┌──────────────┐   ┌──────────────┐  │
│                │  PostgreSQL  │    │    Redis     │   │  AI Engine   │  │
│                │  (cp schema) │    │  Bull Queue  │   │  (Claude AI/ │  │
│                │  Veterans DB │    │  PDF Worker  │   │   Anthropic) │  │
│                └──────────────┘    └──────────────┘   └──────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. TOPOGRAPHIC LAYER MAP

```
LAYER 0 — ENTRY POINTS
├── Frontend Entry:    app/frontend-modern/src/main.jsx
├── Backend Entry:     backend/server.js  →  backend/app.js
├── Root manifest:     package.json (monorepo workspaces)
└── Dev runner:        tooling/scripts/dev-runner.mjs

LAYER 1 — FRONTEND SHELL (React SPA)
├── Router:            BrowserRouter (React Router v6)
├── Layout:            AppLayout.jsx (nav sidebar + page shell)
├── State:             ClaimWorkspaceContext (global claim state)
└── Routes (17 pages)  [see RF-MD-02]

LAYER 2 — BACKEND API (Express REST)
├── App factory:       backend/app.js
├── Route manifest:    backend/api/routeManifest.js  (24 route groups)
├── Middleware:        CORS, rate-limit, auth JWT, logging, compression
└── Controllers (16):  [see RF-MD-03]

LAYER 3 — DOMAIN ENGINE LAYER
├── Compensation:      backend/domain/engines/CompensationEngine.js
├── Benefits:          backend/domain/engines/BenefitsEngine.js
├── VA Scanner:        backend/va_scanner/engine/vaSuperScanner.js
├── STRS Engine:       backend/engine/strs/strs-engine.js
└── Rules Engine:      backend/services/rulesEngine.js

LAYER 4 — AI & INTELLIGENCE
├── AI Client:         ai/core/aiClient.js  (Anthropic Claude SDK)
├── STRS AI Analyzer:  backend/services/strsAiAnalyzerService.js
├── Evidence Graph:    backend/va_scanner/graph/  (v2.0)
└── Knowledge Base:    knowledge/  (legal + medical corpus)

LAYER 5 — DATA PERSISTENCE
├── MongoDB:           backend/database/mongo.js  (primary documents)
├── PostgreSQL:        backend/database/cp_schema/  (relational claims)
├── Redis:             Queue + caching (Bull v2.0)
└── Knowledge Files:   JSON/PDF corpora (38 CFR, regulations, rates)

LAYER 6 — RATE DATABASE
├── VA Rates 1950–2026: backend/va_scanner/rates/YEARS/
├── SMC Rates 1950–2026: backend/va_scanner/rates/SMC/
├── Ancillary Benefits: backend/va_scanner/rates/ANCILLARY/
└── SMC Dependent Rates: backend/va_scanner/rates/SMC_DEPENDENTS/
```

---

## 4. TECHNOLOGY STACK

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI component framework |
| Vite | latest | Build tool & dev server |
| React Router | v6 | SPA navigation |
| TailwindCSS | 3.x | Utility-first CSS |
| PostCSS | | CSS processing |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | ESM | Runtime (ES modules) |
| Express | 4.x | HTTP framework |
| Anthropic Claude SDK | | AI analysis (claude-sonnet-4) |
| Bull | queue | Redis-backed job queue |
| MongoDB (Mongoose) | | Document storage |
| PostgreSQL | | Relational claims data |
| JWT | | Authentication tokens |
| dotenv | | Environment configuration |
| express-rate-limit | | API rate limiting |

### Infrastructure
| Component | Technology |
|---|---|
| Containerization | Docker (Dockerfile present) |
| Queue | Redis + Bull v2.0 |
| PDF Processing | pdfjs-dist / Tesseract OCR |
| CI/CD | GitHub Actions (.github/) |
| Logging | Structured logging (winston-style) |

---

## 5. MONOREPO STRUCTURE

```
Rally_Forge/                          ← Root workspace
├── package.json                      ← Root scripts + workspace config
├── vite.config.js                    ← Vite build config
├── tailwind.config.js                ← TailwindCSS config
├── eslint.config.js                  ← Linting config
├── Dockerfile                        ← Container definition
│
├── app/                              ← Frontend workspace
│   └── frontend-modern/              ← React SPA (primary frontend)
│       ├── src/                      ← Source code
│       ├── index.html
│       └── package.json
│
├── backend/                          ← Backend API server
│   ├── server.js                     ← Entry point
│   ├── app.js                        ← Express app factory
│   ├── config.js                     ← Config management
│   └── [module directories]
│
├── compensation-engine/              ← Standalone compensation module
│   ├── index.js
│   ├── validators.js
│   ├── year-selector.js
│   └── rates/                        ← Historical rate data
│
├── ai/                               ← Local AI configuration
│   ├── config.json
│   ├── core/                         ← AI client wrappers
│   ├── models/                       ← Model configs
│   └── chunks/                       ← Knowledge chunks
│
├── knowledge/                        ← Legal & medical knowledge corpus
│   ├── 38_USC/                       ← Federal law (Title 38)
│   ├── CFR_REGULATIONS/              ← 38 CFR regulations
│   ├── FEDERAL_BENEFITS/             ← Federal benefits data
│   ├── MEDICAL_KNOWLEDGE/            ← Medical reference
│   ├── State_Benefits/               ← State-specific benefits
│   ├── VAknow/                       ← VA-specific knowledge
│   ├── exposures/                    ← Toxic exposure data
│   ├── mos/                          ← Military Occupational Specialty data
│   └── cfr/                          ← CFR indexed references
│
├── config/                           ← URL manifests
├── data/                             ← Import data
├── docs/                             ← Architecture & planning docs
├── rules/                            ← Business rules definitions
├── scripts/                          ← Utility scripts
├── tests/                            ← Integration tests
└── tooling/                          ← Dev tooling scripts
```

---

## 6. PRIMARY USER WORKFLOWS

```
USER JOURNEY FLOW:
                                                          
  [1. Profile]  →  [2. Military Service]  →  [3. STR Upload]
       |                                           |
       ▼                                           ▼
  Enter personal              Upload DD-214    Upload service
  & contact info              & service        treatment records
                              records          (PDF parsing)
                                           
        [4. Current Treatment] → [5. VA Decision] → [6. Claim Generator]
               |                       |                    |
               ▼                       ▼                    ▼
          Upload/enter           Upload existing        AI-generated
          current medical        VA rating decision     claim summary
          treatment records      (auto-extracts rating) + export packet
```

---

## 7. SECURITY ARCHITECTURE

| Layer | Controls |
|---|---|
| Authentication | JWT tokens (access + refresh), rate-limited auth endpoints (5 attempts/hour) |
| Authorization | Middleware-based auth validation on protected routes |
| Rate Limiting | General API rate limiter on all /api/ routes |
| Input Validation | JSON schema validation, body parsing limits (10MB max) |
| CORS | Strict origin whitelist in production |
| Request Hardening | Security headers (anti-clickjacking, anti-sniffing), response compression |
| Timeouts | Request timeout middleware to prevent hanging connections |
| Correlation IDs | X-Correlation-Id header on every request for audit tracing |
| OWASP Controls | XSS protection, CSRF resistance, injection prevention |

---

## 8. DEPLOYMENT MODES

| Mode | Command | Description |
|---|---|---|
| Development | `npm run dev` | Vite HMR frontend + Node backend |
| Full Stack Dev | `npm run dev:full` | With static file serving |
| Production | `npm run start:prod` | Vite preview mode |
| API Only | `npm run dev:api` | Backend only |
| Docker | `docker build` + run | Containerized deployment |

---

## See Also
- RF-MD-02 — Frontend Pages & Routes (detailed UI map)
- RF-MD-03 — Backend API Routes & Controllers
- RF-MD-04 — VA Scanner Engine (PDF parsing, CFR math)
- RF-MD-05 — Compensation & Benefits Engine
- RF-MD-06 — AI & Knowledge Systems
- RF-MD-07 — Database & Domain Layer
- RF-MD-08 — Features & Workflows Guide
