# Rally Forge System Audit Report
**Generated:** 2026-03-05  
**Status:** PARTIAL FAILURES IDENTIFIED - CRITICAL FIXES REQUIRED

---

## EXECUTIVE SUMMARY

Comprehensive scan identified **3 CRITICAL categories of issues**:
1. **Framework**: Corrupted `yargs-parser` in npm dependency tree blocks dev server
2. **Backend Logic**: 5 stub engine files blocking benefits services
3. **Code Quality**: Placeholder implementations in STRS Scanner modules

### System Status
- ✅ **Backend API**: Running (port 3000)
- ✅ **Build**: Succeeds (Vite production build works)
- ⚠️  **Dev Server**: Blocked (corrupted concurrently dependency)
- ❌ **Frontend**: Cannot start (missing Vite dependencies)
- ❌ **Benefits Engines**: Non-functional (empty stubs)

---

## CRITICAL ISSUES FOUND

### 1. FRAMEWORK - Dependency Tree Corruption

**Severity**: CRITICAL  
**Impact**: Dev server won't start

**Issue:**
- npm tree has corrupted `yargs-parser` and `rollup` tarballs
- `node_modules` partially installed with permission errors
- `concurrently` task orchestrator fails on startup

**Affected Files:**
- `node_modules/yargs-parser/build/index.cjs` - Missing
- `node_modules/rollup` - Corrupted tarball
- `package.json` - `dev` script depends on broken `concurrently`

**Solution:** 
- Replace `concurrently` orchestration with native Node runner
- Remove dependency on yargs/concurrently trio
- Created: `dev-server.js` - Clean alternative starter

---

### 2. BACKEND - Stub Engine Files (Critical Service Gap)

**Severity**: CRITICAL  
**Impact**: All benefits determination services return undefined/empty

**Empty Stub Files:**
```
❌ backend/engine/combatEngine.js
   - Import: combatService.js → combatEngine.js
   - Expected: export evaluateCombat(onboardingResult)
   - Current: export default {};

❌ backend/engine/exposureEngine.js
   - Import: exposureService.js → exposureEngine.js
   - Expected: export evaluateExposure(onboardingResult)
   - Current: export default {};

❌ backend/engine/federalBenefits.js
   - Imports: federalService.js, benefitsEngine.js
   - Expected: export evaluateFederalBenefits(onboardingResult)
   - Current: export default {};

❌ backend/engine/stateBenefits.js
   - Imports: stateService.js, benefitsEngine.js
   - Expected: export evaluateStateBenefits(onboardingResult)
   - Current: export default {};

❌ backend/engine/presumptiveEngine.js
   - Import: exposureService.js
   - Expected: export buildPresumptivePathways(exposures)
   - Current: export default {};
```

**Real Implementation Location:**
- ✅ `knowledge/STATE_BENEFITS/stateBenefits.js` - ACTUAL LOGIC EXISTS
  - Function: `evaluateStateBenefits(onboardingResult)`
  - Logic: State rule filtering, combat flag checks, rating evaluation
  - Status: Fully implemented

**Affected Services (Dead Code):**
```
backend/services/
  ├── combatService.js (unused)
  ├── exposureService.js (unused)
  ├── federalService.js (unused)
  └── stateService.js (PARTIALLY USED)
```

**API Endpoints Using Real Logic:**
- ✅ `/api/state-benefits/*` - Uses stateBenefitsService (working)
- ✅ `/api/scanner/*` - Uses compensation logic (working)
- ❌ `/api/benefits/*` - Attempts combatService/federalService (fails)

---

### 3. STRS SCANNER - Placeholder Logic

**Severity**: HIGH  
**Impact**: Placeholder responses instead of real medical extraction

**Placeholder Returns Found:**
```
File: Scanner/STRS_SCANNER/ai/orchestrate-ai.ps1
  - Line 104-117: Returns placeholder when VA_AI_API_KEY not set
  - Line 162-175: Returns placeholder when API fails
  - Line 207-219: Returns placeholder when parsing fails
  - Logic: Flags as "placeholder response" in meta.parse_warnings

File: Scanner/STRS_SCANNER/ai/Analyzer.AI.ps1
  - Line 47-50: Placeholder without API key
  - Line 76-79: Placeholder on API failure
  - Logic: Same pattern as orchestrate-ai.ps1

File: Scanner/STRS_SCANNER/modules/**
  - Parser.psm1: Returns { status, module, lineCount } - stub implementation
  - Extractor.psm1: Returns { status, module, conditions, medications, encounters } - stub
  - Analyzer.psm1: Returns { status, module, opportunities, chronicity, continuity } - stub
  - Output.psm1: Returns formatted output - somewhat implemented
```

**Impact on Veteran Data:**
- Scanner returns valid JSON but with NO ACTUAL MEDICAL DATA EXTRACTED
- "opportunities" field always empty array
- No service connection patterns detected
- Presumptive conditions not identified

---

## CODE QUALITY ISSUES

### Mock/Test Data in Production

**Files Using Mock Data:**
```
packages/lighthouse/src/mock_*.js:
  - buildMockAuthorizeUrl() - Development OAuth flow
  - exchangeMockToken() - Fake token generation
  - validateMockToken() - Validation stub
  - mockEndpoints, mockResponses - Hardcoded fixtures

app/frontend-modern/src/pages/ScannerHub.jsx:
  - Line 452: "No results yet. Run scanner to load mock data."
  - Suggests incomplete scanner integration

app/frontend-modern/src/pages/benefits/VARatingDecisionPage.jsx:
  - Multiple conditional null renders (lines 79, 112, 189)
  - Incomplete data flow handling
```

### Conditional Null Returns (Frontend)

```javascript
// ScannerHub.jsx (lines 39, 73)
return null;  // When data missing

// VARatingDecisionPage.jsx (lines 79, 112, 189)
return null;  // When dependencies missing
```

**Issue:** User sees blank page instead of helpful message or loading state

---

## INTEGRATION GAPS

### 1. Services Not Wired to API
```
Dead Code Services:
  ✗ combatService() → no API route
  ✗ exposureService() → no API route
  ✗ federalService() → no API route
  
Active Services:
  ✓ stateBenefitsService() → /api/state-benefits/*
  ✓ compensationService() → /api/scanner/* (partial)
```

### 2. Benefits Flow Incomplete
```
File: backend/engine/benefitsFlow.js (439 lines)
  - PACT Act conditions listed ✓
  - Traditional presumptives listed ✓
  - BUT: Never called by any API endpoint
  - Status: Dead code (documentation-only)
```

### 3. Payment/Financial Data Disconnects
```
❌ compensationService.js calculates $amounts
❌ BUT: No integration with actual VA rate database
❌ frontend/module uses hardcoded rates
❌ No dependent calculation in most endpoints
```

---

## SEVERITY RANKING

| Priority | Issue | Files | Impact |
|----------|-------|-------|--------|
| 🔴 CRITICAL | Stub engines (5 files) | `backend/engine/*.js` | Benefits services broken |
| 🔴 CRITICAL | npm dependency corruption | `node_modules/yargs*` | Dev server won't start |
| 🟠 HIGH | STRS placeholder logic | `Scanner/STRS_SCANNER/**` | No medical extraction |
| 🟠 HIGH | Mock OAuth in production | `packages/lighthouse/**` | Lacks real auth |
| 🟡 MEDIUM | Null returns (frontend) | `app/**/pages/*.jsx` | Poor UX |
| 🟡 MEDIUM | Dead service code | `backend/services/*` | Code clutter |
| 🟡 MEDIUM | UnintegrationUnused benefits flow | `benefitsFlow.js` | Dead code |

---

## VETERAN DATA ACCURACY IMPACT

### Current Issues Blocking Accuracy:
1. **Services Return Undefined** - Combat, exposure, federal benefits cannot be evaluated
2. **No Military History Processing** - Combat status not extracted
3. **No Environmental Exposure Matching** - Agent Orange, burn pits not linked
4. **No Presumptive Condition Determination** - Medical conditions not auto-mapped
5. **Scanner Returns Empty Arrays** - No service connection opportunities identified
6. **Rate Calculations Missing Dependents** - Some endpoints show base-only, not dependent-inclusive

---

## DEFINITIONS

### Stub File
Empty export with TODO comment. Blocks services but has zero functionality.

### Placeholder Response
JSON with valid schema but no real data. e.g., `opportunities: []`

### Dead Code
Service imported nowhere, never called, doesn't affect runtime.

### Integration Gap
Component expects function that doesn't exist or returns wrong type.

---

## NEXT STEPS (PRIORITY ORDER)

1. **[CRITICAL]** Replace stub engine files with real implementations
2. **[CRITICAL]** Fix npm dependency tree (clear install)
3. **[HIGH]** Implement STRS medical extraction logic
4. **[HIGH]** Implement real Lighthouse OAuth (remove mock)
5. **[MEDIUM]** Integrate benefits determination to API
6. **[MEDIUM]** Add error boundaries to frontend pages
7. **[LOW]** Remove dead service code

---

## Validation Commands

```bash
# Health check
curl http://localhost:3000/api/health

# Scanner test  
curl -X POST http://localhost:3000/api/scanner/scan-pdf -F "file=@test.pdf"

# State benefits
curl http://localhost:3000/api/state-benefits/states

# Compensation quote
curl -X POST http://localhost:3000/api/compensation/quote \
  -H "Content-Type: application/json" \
  -d '{"rating":50, "dependents":2}'
```

---

**Report Status**: AUDIT COMPLETE - Ready for remediation
