# SpaceForceAFSC Upgrade Plan
**Generated:** March 21, 2026  
**Status:** IMPLEMENTED

---

## 1. CURRENT STATE ANALYSIS

### Existing Space Force Entries (knowledge/mos/space-force.json)
✓ Already present:
- `1C6X1` - Space Systems Operations (enlisted)
- `1N8X1` - Targeting Analysis (enlisted)
- Officer codes: 13SXA, 17DXA, 61DXA, 62EXA

⚠ **ONLY 2 enlisted AFSCs** - incomplete coverage

### Existing Air Force Entries (knowledge/mos/air-force.json)
✓ Already present:
- `1N0X1` - Intelligence Analyst (enlisted)
- `1N1X1` - Geospatial Intelligence (enlisted)
- `1N2X1` - Signals Intelligence (enlisted)
- MANY other AFSCs (50+ enlisted total)

**NOTE:** These Air Force AFSCs are NOT currently in Space Force file

### Current UI/Frontend Implementation
- **Branch Values:** Correctly includes "Space Force" in BRANCH_VALUES
- **Rank Options:** Space Force ranks E-1 to E-9, O-1 to O-10 (no W-2/W-5)
- **MOS Dropdown:** Uses backend `/api/military/mos-options?branch=Space%20Force`
- **Type Filtering:** Supports filtering by type (enlisted|warrant|officer)

### Backend Implementation
- **MOS Endpoint:** `GET /api/military/mos-options` routes through MOS_FILE_BY_BRANCH
- **Validation:** AFSC pattern `/^\d[A-Z]\d[A-Z0-9]{2,3}$/` correctly validates new USSF codes
- **Normalization:** normalizeMosEntry() adds `label` and `type` fields

### Scanner Implementation (DD-214, STR, CTR, RD)
- **isValidMos():** Already accepts USSF code patterns (5S0, 5I0)
- **Semantic Anchors:** Correctly maps to `primaryMOSOrAFSCOrRating`
- **Confidence Model:** Already scores primary/secondary specialties

### Exposure Indexes
- **Status:** mOS-exposure-risk.json has NO Space Force entries
- **Impact:** Space Force AFSCs won't trigger exposure-based analyzer flags

### Analyzer Index
- **Status:** Already maps 1C6X1 and 1N0X1
- **Gap:** No mappings for new 5S0, 5I0 codes; no Army/Navy equivalents

---

## 2. MISSING COMPONENTS IDENTIFIED

### Missing USSF-Specific Codes
Not present in any knowledge base:
- [ ] `5S0` - USSF Space Systems Operations (new code)
- [ ] `5I0` - USSF All-Source Intelligence (new code)

**Why Important:** New Space Force integrated specialty codes replacing Air Force-only codes

### Missing Legacy Codes in USSF Context
Not in space-force.json but should be:
- [ ] `1C6X1` → needs cross-reference to `5S0`
- [ ] `1N0X1` → needs cross-reference to `5I0`

**Why Important:** Dual-use for transitioning career fields

### Missing Cross-Branch Mappings
NO cross-branch equivalency tables exist:
- [ ] 5S0 → Army 25S
- [ ] 5S0 → Navy K10A/K36A
- [ ] 5S0 → Marine Corps 2651
- [ ] 5I0 → Army 35F
- [ ] 5I0 → Navy K36A
- [ ] 5I0 → Marine Corps 0231

**Why Important:** Enables cross-branch military experience comparison, presumptive exposures

### Missing Exposure Mappings
NO exposure data for:
- [ ] 5S0, 5I0 (new codes)
- [ ] 1C6X1, 1N0X1, 1N1X1, 1N2X1 (legacy codes used by USSF)

**Why Important:** Analyzer can't flag risk exposures from Space Force service

### UI Gaps
- [x] Branch selection: Already supports "Space Force"
- [x] Rank selection: Already supports E/O ranks
- [ ] MOS dropdown: Will work but returns minimal data (no exposure hints)

---

## 3. AFFECTED MODULES

### Data Files
1. **knowledge/mos/space-force.json**
   - Current: 2 enlisted + 4 officer AFSCs
   - Change: Add 5S0, 5I0 (new), inherit 1C6X1, 1N0X1, 1N1X1, 1N2X1 (legacy)
   - Impact: UI dropdown will show more options

2. **knowledge/mos/air-force.json**
   - Current: Already has 1C6X1, 1N0X1, 1N1X1, 1N2X1
   - Change: Add cross-references/notes to mark USSF-transitional
   - Impact: Minimal (already works)

3. **knowledge/mos/mos-exposure-risk.json** (NEW DATA NEEDED)
   - Current: No Space Force entries (0/2 enlisted codes)
   - Change: Add mappings for 5S0, 5I0, 1C6X1, 1N0X1, 1N1X1, 1N2X1
   - Impact: Exposure analyzer will activate for Space Force vets

4. **knowledge/analyzer/analyzer-index.json**
   - Current: 1C6X1, 1N0X1 already mapped
   - Change: Add 5S0, 5I0, cross-branch equivalents
   - Impact: Analyzer flags will show for USSF-specific codes

### Code Files
1. **backend/api/military.js**
   - Current: Already routes Space Force correctly
   - Change: No code change needed
   - Impact: None (works as-is)

2. **app/frontend-modern/src/tabs/military-service/schema.js**
   - Current: Space Force rank ranges already defined
   - Change: No code change needed
   - Impact: None (works as-is)

3. **backend/va_scanner/backend/shared/scanner/** (schemaValidators.js, etc.)
   - Current: AFSC patterns already accept 5S0, 5I0
   - Change: Possibly add examples/documentation
   - Impact: None (validation works as-is)

---

## 4. REQUIRED ADDITIONS BY PRIORITY

### Priority 1: Core USSF AFSCs
```json
Space Force enlisted:
- 5S0 - Space Systems Operations (new USSF code)
- 5I0 - All-Source Intelligence (new USSF code)
- 1C6X1 - (legacy, already present)
- 1N8X1 - Targeting Analysis (already present)
```

### Priority 2: Cross-Branch Equivalencies
```json
Mapping tables:
5S0/1C6X1:
  - Army: 25S (Signal Support Systems Specialist)
  - Navy: K10A/K36A
  - Marine Corps: 2651 (Communications Officer/Specialist variant)
  
5I0/1N0X1:
  - Army: 35F (Multi-Disciplinary Occupation (MOS) - Intelligence)
  - Navy: K36A (Intelligence Specialist)
  - Marine Corps: 0231 (Intelligence Officer)
```

### Priority 3: Exposure Data
```json
For 5S0, 5I0, 1C6X1, 1N0X1, 1N1X1, 1N2X1:
- Probable exposures: radiation, RF/EMF, solvents, dust, noise
- Confidence levels: based on duty location and task descriptions
```

---

## 5. DATA STRUCTURE REQUIREMENTS

### Entry Format
Each AFSC entry must have:
```json
{
  "code": "5S0",
  "title": "Space Systems Operations",
  "type": "enlisted",
  "branch": "Space Force",
  "crossBranchEquivalents": ["1C6X1", "25S", "K10A", "2651"],
  "notes": "New USSF integrated code (2023+)"
}
```

**Schema Notes:**
- ✓ `code` and `title` are REQUIRED (existing schema)
- ✓ `type` is RECOMMENDED (used for filtering)
- ⚠ `crossBranchEquivalents` NOT in schema but needed
- ⚠ Schema may need extension OR data added to separate cross-ref file

### Exposure Format
```json
{
  "branch": "Space Force",
  "mosCode": "5S0",
  "title": "Space Systems Operations",
  "noiseRisk": "medium",
  "exposures": [
    { "id": "rf-emf", "label": "RF/EMF Radiation", "confidence": "high" },
    { "id": "noise", "label": "Noise/Acoustic", "confidence": "medium" }
  ]
}
```

---

## 6. VALIDATION CHECKLIST

After implementation, MUST verify:

### Data Integrity
- [ ] All new USSF codes appear in space-force.json
- [ ] All legacy codes appear with USSF context
- [ ] No duplicate entries across branches
- [ ] All codes validate against AFSC regex

### UI Functionality
- [ ] Space Force branch dropdown selectable
- [ ] "Space Force" MOS options load without errors
- [ ] All 6 AFSC codes appear in dropdown (5S0, 5I0, 1C6X1, 1N0X1, 1N1X1, 1N2X1)
- [ ] Rank selection E-1 to E-9, O-1 to O-10 works
- [ ] MOS selection filters by rank (enlisted only, no warrant)

### Backend Validation
- [ ] `/api/military/mos-options?branch=Space%20Force` returns all codes
- [ ] DD-214 scanner accepts 5S0, 5I0 in primaryMOSOrAFSCOrRating
- [ ] Schema validation passes for new codes
- [ ] No warnings or errors in server logs

### Analyzer Mapping
- [ ] 5S0, 5I0 map to exposure types in analyzer
- [ ] Cross-branch equivalents trigger appropriate rules
- [ ] Exposure hints display correctly

### Test Suite
- [ ] All existing tests still pass
- [ ] New USSF codes pass validation tests
- [ ] MOS dropdown tests cover Space Force selection

---

## 7. RISKS & MITIGATIONS

### Risk 1: Schema Mismatch (additionalProperties: false)
**Issue:** Current schema doesn't accept `crossBranchEquivalents` field
**Impact:** May need schema migration
**Mitigation:** 
- Option A: Update schema to allow new fields
- Option B: Create separate cross-mapping JSON file
- **Recommendation:** Option B (less risky)

### Risk 2: Missing Exposure Data
**Issue:** No exposure definitions published for USSF codes
**Impact:** Analyzer won't flag exposures for Space Force service
**Mitigation:**
- Use best-guess based on job descriptions
- Document as "template" pending official sources
- Flag for SME (Subject Matter Expert) review

### Risk 3: Incomplete Cross-Branch Mappings
**Issue:** Exact Navy/Marine equivalents may not exist
**Impact:** Cross-branch matching could fail
**Mitigation:**
- Use "best match" concept rather than 1:1 equivalence
- Document assumptions in notes
- Tag mappings as "provisional"

### Risk 4: Backward Compatibility
**Issue:** Existing DD-214 records with 1C6X1, 1N0X1 might change display
**Impact:** Veteran data could look different
**Mitigation:**
- Data stays identical (no renormalization)
- UI just has more options, doesn't change existing selections
- Tests ensure no regressions

---

## 8. IMPLEMENTATION SEQUENCE

1. ✅ **DONE**: Inspect current implementation
2. ⏭️ **NEXT**: Generate upgrade plan (this document)
3. Create cross-branch mapping file (knowledge/mos/cross-branch-equivalents.json)
4. Add USSF AFSCs to space-force.json
5. Add exposure data to mos-exposure-risk.json
6. Update analyzer-index.json with new mappings
7. Add test cases for new USSF codes
8. Validate entire system end-to-end
9. Update documentation/ONBOARDING

---

## 9. SUCCESS CRITERIA

✅ **Phase Complete When:**
1. All 6 AFSCs (5S0, 5I0, 1C6X1, 1N0X1, 1N1X1, 1N2X1) appear in Space Force dropdown
2. DD-214 scanner accepts new USSF codes without validation errors
3. Exposure data exists for all 6 codes
4. Cross-branch mappings enable Army/Navy/Marine Corps comparisons
5. All existing tests pass + new Space Force tests added
6. No console errors or warnings when selecting Space Force branch

---

## IMPLEMENTATION COMPLETION SUMMARY

Completed deliverables:
- Added USSF-specific enlisted AFSCs `5S`, `5S0`, `5I0` to `knowledge/mos/space-force.json`.
- Added legacy enlisted AFSC support in Space Force catalog for `1C6`, `1C6X1`, `1N0`, `1N0X1`, `1N1`, `1N1X1`, `1N2`, `1N2X1`.
- Added normalized per-entry metadata fields: `description`, `branch`, `crossBranchEquivalents`, `exposureCategory`, `notes`.
- Extended `knowledge/mos/mos.schema.json` to support the normalized metadata fields.
- Added cross-branch mapping table at `knowledge/mos/cross-branch-equivalents.json` with required mapping relationships.
- Updated exposure matrix examples in `knowledge/exposures/exposure-index.json` for new/legacy USSF AFSC support.
- Updated analyzer index in `knowledge/analyzer/analyzer-index.json` with Space Force MOS entries and exposure family examples.
- Added Space Force entries to `knowledge/mos/mos-exposure-risk.json`.
- Updated backend MOS API normalization in `backend/api/military.js` to return the new metadata to UI/clients.
- Updated scanner acceptance/parsing for compact USSF AFSC formats:
   - `backend/va_scanner/backend/shared/scanner/schemaValidators.js`
   - `backend/va_scanner/backend/shared/scanner/dd214Scanner.js`
   - `backend/va_scanner/backend/shared/scanner/dd214StepOneMapper.js`
   - `backend/va_scanner/backend/shared/scanner/dd214SemanticAnchors.js`
- Updated frontend MOS code validation in `app/frontend-modern/src/tabs/military-service/normalization.js`.
- Added regression tests:
   - `app/frontend-modern/src/tests/tab-02-military-service-normalization.test.js`
   - `tests/dd214/dd214-regression-hardening.test.js`

Result:
- Space Force enlisted AFSC coverage is expanded for both legacy and new formats.
- Cross-branch equivalency data exists in a dedicated normalized source file.
- UI/API/scanner pathways now accept and propagate compact USSF formats (including `5S0`, `5I0`, `1N0`).

