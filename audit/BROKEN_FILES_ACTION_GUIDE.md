# Rally Forge Broken Files - Quick Action Guide

**Status:** 12 files flagged as POTENTIALLY_BROKEN  
**Priority:** HIGH - Review within 24 hours  
**Estimated Fix Time:** 30 minutes

---

## ⚠️ Critical Files Requiring Immediate Action

### 1. backend/server.js (194 bytes)
**Status:** ⚠️ CRITICAL - May be false positive  
**Issue:** Very small file tagged as potential stub  
**Action:** Verify this is actual entry point
```bash
cat backend/server.js
```
**Expected:** Should contain Express server initialization  
**Likelihood:** 80% valid, 20% stub  

---

### 2. backend/services/combatService.js (163 bytes)
**Status:** ❌ BROKEN - Stub/Not Implemented  
**Issue:** Incomplete service implementation  
**Reason:** Used by VA disability-related features (Combat-related conditions, Burn Pits, Gulf War Illness)  
**Options:**
1. **Implement:** Add actual combat condition evaluation logic
2. **Remove:** Delete and reference unimplemented features in roadmap
3. **Consolidate:** Merge with existing service if duplicate exists

**Decision:** **CHECK IF REFERENCED** - May be used by scanner or engine

---

### 3. backend/services/federalService.js (185 bytes)
**Status:** ❌ BROKEN - Stub/Not Implemented  
**Issue:** Incomplete federal benefits service  
**Reason:** Similar to statusService but for federal supplements (FEDVIP, CHAMPVA, etc.)  
**Decision:** Implement or mark as future feature

---

### 4. backend/services/stateService.js (177 bytes)
**Status:** ⚠️ BROKEN - Duplicate Detection Alert  
**Issue:** Two stateService.js files exist:
- `backend/services/stateService.js` (177 bytes) - STUB
- `knowledge/STATE_BENEFITS/stateService.js` (177 bytes) - Implementation
**Action:** DELETE `backend/services/stateService.js` AND UPDATE IMPORTS
```bash
# Find which files reference the backend version
grep -r "backend/services/stateService" . --include="*.js"
```
**Decision:** Keep only the STATE_BENEFITS version, consolidate references

---

### 5. backend/services/ - Pattern Issue ⚠️

All three service stubs have same issue - they're incomplete. Run this to check if MORE broke:

```bash
ls -la backend/services/*.js | awk '{if ($5 < 300) print "SMALL:", $9, "("$5" bytes)"}'
```

**Full inventory of small backend service files:**
- combatService.js: 163B - BROKEN
- federalService.js: 185B - BROKEN  
- stateService.js: 177B - BROKEN (also exists in STATE_BENEFITS/)

---

## Medium Priority - Legacy App Folder Files

### app/frontend-modern/ Configuration Stubs (3 files)

| File | Size | Status | Action |
|------|------|--------|--------|
| postcss.config.js | 72 B | Stub config | Complete or remove |
| colors.js | 131 B | Stub theme | Complete or remove |
| Likely more in this folder | - | - | Full audit needed |

**Decision:** Complete configuration or delete if unused

---

### app/frontend/ & app/backend/ (Legacy Architecture)

- These are from superseded codebase architecture
- **Keep?** Only if maintaining historical compatibility
- **Delete?** Safe if migration complete to `./backend` and `./src`
- **Archive?** Recommended: Move to `_legacy/moved-[date]/` for reference

---

## Low Priority - Test/Config Placeholders

These small files are mostly legitimate config or documentation:
- Small pytest/jest config files
- Documentation headers
- Utility constants

**Status:** Safe to ignore unless blocking builds

---

## Action Plan

### Step 1: Immediate Investigation (5 min)
```bash
# Verify backend/server.js content
cat backend/server.js

# Check if combatService, federalService are referenced
grep -r "combatService\|federalService" . --include="*.js" --exclude-dir=node_modules
```

### Step 2: Consolidation (10 min)
```bash
# Check stateService references
grep -r "stateService" . --include="*.js" --exclude-dir=node_modules

# Find which imports the backend version vs. STATE_BENEFITS version
grep -r "from.*stateService\|require.*stateService" . --include="*.js"
```

### Step 3: Decision Matrix

| File | Decision | Action | Time |
|------|----------|--------|------|
| backend/server.js | Verify first | Check content, keep if entry point | 2 min |
| combatService.js | Roadmap review | Keep if planned, archive if not | 3 min |
| federalService.js | Roadmap review | Keep if planned, archive if not | 3 min |
| stateService.js (backend/) | CONSOLIDATE | Delete & update imports | 5 min |
| postcss.config.js (modern) | COMPLETE | Finish config or delete | 3 min |
| colors.js (modern) | COMPLETE | Finish theme or delete | 2 min |

**Total Time: ~18 minutes**

---

## What NOT to Delete Without Confirmation

- ✅ **backend/server.js** - May be entry point
- ✅ **backend/services/** except the duplicates - May be referenced dynamically
- ✅ **app/frontend-modern/** - May be active development branch

---

## Success Criteria (When Done)

✅ All 12 broken files reviewed  
✅ Clear decision made: KEEP / IMPLEMENT / DELETE / ARCHIVE  
✅ Consolidation completed (stateService duplicate resolved)  
✅ No orphaned imports remaining  
✅ codebase broken-files count drops to <5  

---

**Next Report:** After fixes applied, re-run:
```bash
node scripts/generate-manifest.js
node scripts/analyze-manifest.js
```

Expected result: All files move to ACTIVE status.
