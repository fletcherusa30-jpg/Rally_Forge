# Rally Forge — Backend API Routes & Controllers
**Server:** Express v4 | **Runtime:** Node.js ESM | **Version:** Backend v2.0

---

## 1. SERVER STARTUP SEQUENCE

```
backend/server.js
  ├── validateConfig()             ← Checks all required env vars
  ├── createApp()                  ← Builds Express application
  │     ├── buildRouteManifest()   ← Registers all 24 route groups
  │     ├── Middleware stack        ← Logging, CORS, security, rate-limit
  │     └── Error handlers         ← 404 + global error handler
  ├── startWorker()               ← Launches Redis Bull PDF queue worker
  └── app.listen(port)            ← Starts HTTP server
```

**Startup Output:**
```
╔════════════════════════════════════════════════════════╗
║    🚀 Rally Forge Backend v2.0 Ready (Modernized)     ║
║            All Scanners Upgraded to v3+               ║
╠════════════════════════════════════════════════════════╣
║ Server:  http://localhost:3000
║ API:     http://localhost:3000/api
║ Health:  http://localhost:3000/api/health
║ Scanners: OCR v2, DD214 v3, STR v3, RatingDecision v4.2
║ Queue:   Redis Bull v2.0 (async processing)
║ Graph:   Veteran Evidence Graph v2.0
╚════════════════════════════════════════════════════════╝
```

---

## 2. MIDDLEWARE STACK (Applied in Order)

```
1. requestLogger         ← Logs every incoming request
2. consoleLogger         ← Console output (development only)
3. correlationId         ← Attaches X-Correlation-Id to every request
4. responseCompression   ← gzip compression on responses
5. securityHeaders       ← Anti-clickjacking, anti-sniffing headers
6. cors()                ← Origin whitelist enforcement
7. requestTimeout()      ← Timeout hanging requests
8. express.json()        ← JSON body parser (10MB limit)
9. express.urlencoded()  ← URL-encoded body parser (10MB limit)
10. generalRateLimiter   ← Rate limiting on all /api/ routes
11. [Route handlers]     ← Per-route logic
12. errorLogger          ← Logs errors with correlation IDs
13. notFoundHandler      ← 404 catch-all
14. errorHandler         ← Global error response formatter
```

**Auth Rate Limiter:** 5 failed attempts per hour (applied specifically to `/api/auth`)

---

## 3. COMPLETE ROUTE MANIFEST

### Public Routes
| Path | Router File | Category | Description |
|---|---|---|---|
| `/api/health` | `health.js` | public | System health check |
| `/api/audit` | `auditMetadata.js` | public | Audit metadata access |
| `/api/auth` | `auth.js` | public | Authentication (rate-limited) |

### Core Routes
| Path | Router File | Description |
|---|---|---|
| `/api/scanner` | `scanner.js` | PDF scanning & OCR |
| `/api/strs` | `strs.js` | Service Treatment Records |
| `/api/compensation` | `compensation.js` | Compensation calculation |
| `/api/financial` | `financial.js` | Financial planning |
| `/api/military` | `military.js` | Military service records |
| `/api/cases` | `cases.js` | Case management |
| `/api/benefits` | `benefits.js` | VA benefits lookup |
| `/api/onboarding` | `onboarding.js` | Veteran onboarding |
| `/api/state-benefits` | `stateBenefits.js` | State-level benefits |
| `/api/intelligence` | `intelligence.js` | Intelligence analysis |
| `/api/reviews` | `reviewQueue.js` | Review queue management |
| `/api/claim-workspace` | `claimWorkspace.js` | Workspace persistence |
| `/api/knowledge` | `knowledge.js` | Knowledge base search |
| `/api/cfr` | `cfr.js` | CFR regulation lookup |
| `/api/evidence-graph` | `evidenceGraph.js` | Evidence graph v2.0 |

### Extended Routes
| Path | Router File | Description |
|---|---|---|
| `/api/authority` | `authority.js` | Legal authority lookups |
| `/api/pathways` | `pathways.js` | Service connection pathways |
| `/api/benefits` | `recalculate.js` | Benefits recalculation trigger |
| `/api/scanner` | `scannerDiagnostics.js` | Scanner diagnostics |
| `/api/ai` | `aiAnalysisRouter.js` | AI analysis endpoints |
| `/api/ai-test` | `aiTestRouter.js` | AI integration testing |

---

## 4. CONTROLLERS

### `authController.js`
- `login()` — JWT token generation
- `refresh()` — Token refresh
- `logout()` — Token revocation

### `benefitsController.js`
- `getBenefits(veteranId)` — Get or compute cached benefits
- `recomputeBenefits(veteranId)` — Force benefits recomputation

### `casesController.js`
- Case creation, lookup, status updates
- Claim lifecycle management

### `compensationController.js`
- `calculateCompensation()` — Run compensation calculation
- `getCompensationSummary()` — Dashboard data
- `calculateBackPay()` — Historical back-pay calculation

### `financialController.js`
- `analyzeBudget()` — Budget health scoring
- `projectRetirement()` — TSP/FERS projection
- `getFinancialPlan()` — Full financial plan

### `intelligenceController.js`
- Evidence intelligence analysis
- Service connection strength scoring
- PACT Act screening

### `knowledgeController.js`
- Knowledge base text search
- CFR cross-reference lookup
- Medical condition lookup

### `onboardingController.js`
- Veteran profile setup
- Service period recording
- Dependency registration

### `pathwaysController.js`
- Service connection pathway identification
- Direct / Secondary / Aggravation / Presumptive pathway analysis

### `recalculateController.js`
- On-demand benefits recalculation trigger
- Cache invalidation

### `reviewQueueController.js`
- Queue item submission
- Review status retrieval
- Priority management

### `stateBenefitsController.js`
- State-specific benefit lookup by state code
- Multi-state benefit comparison

### `strsController.js`
- STR document processing initiation
- Condition extraction retrieval
- AI analysis trigger for service connection

### `strsFeedbackController.js`
- User feedback on STR extractions
- Accuracy reporting

### `auditMetadataController.js`
- Audit trail retrieval
- System audit event recording

### `authorityController.js`
- Legal authority lookups (38 USC, 38 CFR)
- Statutory basis identification

---

## 5. API ENDPOINT DETAILS

### Compensation API (`/api/compensation`)
```
POST /api/compensation/calculate
  Body: { rating, dependents, smcCode, effectiveDate, yearOverride, ancillary }
  Returns: { monthly, smcAdjustment, dependentAdjustment, total, breakdown }

GET /api/compensation/summary
  Returns: { baseMonthly, smcMonthly, dependentMonthly, totalMonthly }

POST /api/compensation/back-pay
  Body: { rating, dependents, startDate, endDate, smcCode }
  Returns: { totalBackPay, breakdown, years[] }
```

### Scanner API (`/api/scanner`)
```
POST /api/scanner/upload
  Body: multipart/form-data (PDF file)
  Returns: { jobId, status: 'queued' }

GET /api/scanner/status/:jobId
  Returns: { status, progress, result? }

GET /api/scanner/diagnostics
  Returns: { scannerVersions, lastProcessed, errorRate }
```

### STRS API (`/api/strs`)
```
POST /api/strs/upload
  Body: multipart/form-data (PDF)
  Returns: { jobId, extractedFindings }

GET /api/strs/:id/analysis
  Returns: { conditions[], serviceConnectionAnalysis, confidence }

POST /api/strs/:id/feedback
  Body: { conditionId, feedback, accuracy }
```

### Benefits API (`/api/benefits`)
```
GET /api/benefits/:veteranId
  Returns: computed benefits eligibility + amounts

POST /api/benefits/:veteranId/recompute
  Returns: fresh computation result
```

### Financial API (`/api/financial`)
```
POST /api/financial/budget
  Body: { monthlyIncome, fixedExpenses, variableExpenses }
  Returns: { score, breakdown, recommendations }

POST /api/financial/retirement
  Body: { currentBalance, contributions, years, ... }
  Returns: { projectedBalance, monthlyIncome, scenarios }
```

### State Benefits API (`/api/state-benefits`)
```
GET /api/state-benefits/:stateCode
  Returns: { propertyTax, education, employment, motorVehicle, ... }

GET /api/state-benefits
  Returns: all states summary
```

### Knowledge API (`/api/knowledge`)
```
GET /api/knowledge/search?q={query}
  Returns: matching knowledge base entries

GET /api/knowledge/cfr/:part/:section
  Returns: specific CFR regulation text

GET /api/knowledge/condition/:name
  Returns: condition info, CFR references, typical ratings
```

### Health API (`/api/health`)
```
GET /api/health
  Returns: {
    status: 'ok'|'degraded',
    database: 'connected'|'error',
    redis: 'connected'|'error',
    scanners: { ocr, dd214, str, ratingDecision },
    version: '2.0.0',
    uptime: seconds
  }
```

### Military API (`/api/military`)
```
POST /api/military/mts    ← Military service records
GET  /api/military/mos/:code  ← MOS/AFSC lookup
```

### Evidence Graph API (`/api/evidence-graph`)
```
GET  /api/evidence-graph/:veteranId  ← Full evidence graph
POST /api/evidence-graph/analyze     ← Re-analyze evidence connections
```

### AI Endpoints (`/api/ai`)
```
POST /api/ai/analyze-service-connection
  Body: { condition, strText, metadata }
  Returns: AI service connection analysis with CFR citations

POST /api/ai/summarize
  Body: { workspaceData }
  Returns: AI claim narrative summary
```

---

## 6. AUTHENTICATION FLOW

```
Client                     Backend
  │                            │
  ├── POST /api/auth/login ────►│
  │   { username, password }   │── bcrypt verify
  │◄─── { accessToken, refresh }│── JWT sign (access: 24h, refresh: 7d)
  │                            │
  ├── GET /api/protected ──────►│
  │   Authorization: Bearer {token}│── JWT verify middleware
  │◄─── { data }               │
  │                            │
  ├── POST /api/auth/refresh───►│
  │   { refreshToken }         │── Verify + reissue
  │◄─── { newAccessToken }     │
```

---

## 7. ERROR HANDLING

All error responses follow this shape:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Veteran not found",
    "correlationId": "uuid-here"
  }
}
```

Error classes (from `backend/core/errors/`):
- `AppError` — Base error class
- `NotFoundError` — 404
- `BadRequestError` — 400
- `AuthError` — 401/403
- `ValidationError` — 422

---

## 8. CONFIGURATION (`backend/config.js`)

| Config Key | Env Variable | Default |
|---|---|---|
| `port` | `PORT` | 3000 |
| `nodeEnv` | `NODE_ENV` | `development` |
| `database.url` | `DATABASE_URL` | required |
| `redis.host` | `REDIS_HOST` | `localhost` |
| `redis.port` | `REDIS_PORT` | `6379` |
| `jwt.secret` | `JWT_SECRET` | required |
| `jwt.expiresIn` | `JWT_EXPIRES_IN` | `24h` |
| `apiKeys.anthropic` | `ANTHROPIC_API_KEY` | optional |
| `cors.origins` | `CORS_ORIGINS` | auto |
| `upload.maxFileSizeMB` | `MAX_FILE_SIZE_MB` | `50` |
| `logging.level` | `LOG_LEVEL` | `info` |
| `logging.dir` | `LOG_DIR` | `./logs` |

---

## 9. REQUEST LIFECYCLE

```
Incoming HTTP Request
        │
        ▼
[1] requestLogger      → write request log entry
[2] correlationId      → attach X-Correlation-Id
[3] compression        → gzip response body
[4] securityHeaders    → set security headers
[5] CORS               → validate origin
[6] timeout            → set request timeout
[7] bodyParser         → parse JSON/form body
[8] rateLimiter        → check rate limit
[9] authMiddleware     → validate JWT (protected routes)
[10] routeHandler      → controller logic
[11] response          → send JSON response
        │
        ▼ (on error)
[12] errorLogger       → log error + correlationId
[13] errorHandler      → format + send error response
```
