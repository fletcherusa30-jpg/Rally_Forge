# DD-214 Scanner — Design & Modernization Specification

**Location:** `backend/va_scanner/backend/shared/scanner/dd214Analysis/`

**Version:** 2.0  
**Last Updated:** March 17, 2026

---

## 1. Purpose

Extract authoritative service history and separation data from all DD-214 variants across eras and branches. Deterministically parse military service records regardless of era, format, or OCR quality.

---

## 2. Document Types Supported

- DD-214 Member 1 (Primary copy)
- DD-214 Member 4 (Service member copy)
- DD-214-1 Addendum
- Typed DD-214s
- Handwritten DD-214s
- Scanned/OCR'd DD-214s
- Digital PDFs
- Multi-page continuations

---

## 3. Required Extraction Fields

**Service History Block:**
- Veteran full name (Block 1a)
- Branch of service (Block 2a)
- Entry date (Block 18a)
- Separation date (Block 18b)
- Total active service duration
- Total inactive service (Reserve/Guard)

**Rank & Pay Block:**
- Rank at entry (Block 10)
- Rank at separation (Block 11)
- Pay grade at separation (Block 12)
- MOS/AFSC/Rating (Blocks 9a, 9b)

**Separation Block:**
- Separation code (SPD) (Block 17)
- Reenlistment code (RE) (Block 16)
- Character of service (Block 24)
- Narrative reason for separation (Block 28)

**Awards & Decorations:**
- Awards list (Block 13)
- Citations/Commendations
- Service medals
- Campaign medals

**Other:**
- Remarks (Block 18/continuation)
- Foreign service indicators
- Combat decorations

---

## 4. Optional Extraction Fields

- Deployment history (inferred from awards/medals)
- Combat indicators
- Special duty assignments
- Training completions
- Security clearance level
- Discharge authorization number
- Organization at discharge
- Home address at time of discharge
- Former service (prior enlistments)

---

## 5. Rules

### Block Detection Rules
1. Detect DD-214 era based on format:
   - Pre-1974 (Vietnam era)
   - 1974-1991 (inter-war)
   - 1991-2001 (Gulf War)
   - 2001-present (Modern/OEF/OIF)

2. Map block numbers to branch-specific layouts:
   - Navy/USCG (different field order)
   - Army/Army Reserve
   - Air Force/Space Force
   - Marines/Marine Reserve
   - National Guard (state variants)

3. Extract block content with continuation detection

### Date Format Rules
1. Normalize date formats:
   - YYYYMMDD → ISO 8601
   - MM/DD/YYYY → ISO 8601
   - Month Day, Year → ISO 8601
   - Written dates (e.g., "Twenty-three March")

2. Validate date ranges:
   - Entry before separation
   - Service within military history
   - Rank progression logic

### Name & Identity Rules
1. Extract full name from Block 1a:
   - Last name, First name Middle initial
   - Handle suffixes (Jr., II, III, etc.)
   - Handle non-ASCII characters

2. Normalize spacing and capitalization

### Code Extraction Rules
1. SPD (Separation code) extraction:
   - Alphanumeric, typically 3 chars
   - Extract from Block 17
   - Validate against SPD code list

2. RE (Reenlistment code) extraction:
   - Single or double character
   - Extract from Block 16
   - Validate against RE code list

3. MOS/AFSC/Rating extraction:
   - Military Occupational Specialty (Army)
   - Air Force Specialty Code (Air Force)
   - Rating (Navy/USCG)
   - Handle primary and secondary codes

### Awards Extraction Rules
1. Detect awards format:
   - Comma-separated single line
   - Bullet list format
   - Paragraph format
   - One per line

2. Extract individual awards:
   - Award name
   - Quantity (if applicable, e.g., "Oak Leaf Cluster")
   - Campaign medals with oak leaf clusters

3. Merge duplicates (same award listed twice)

### Continuation Page Rules
1. Detect continuation indicators (Block 28a/b)
2. Extract multi-line remarks across pages
3. Concatenate with proper spacing
4. Remove page headers/footers

---

## 6. Validators

### Block Validators
- Block 1a: Name format (Last, First Middle Suffix)
- Block 2a: Valid branch code
- Block 10: Valid rank code
- Block 11: Valid rank code
- Block 12: Valid pay grade
- Block 16: Valid RE code (1-4 chars)
- Block 17: Valid SPD code
- Block 24: Valid character of service values
- Block 28: Present; multi-line remarks valid

### Date Validators
- Entry date is before separation date
- Entry date is within military history (1917+)
- Separation date is before "today"
- Service dates align with modern eras

### Code Validators

**SPD Code Validation:**
```
Valid values: JBA, JBB, JBC, JBD, JBE, JBF, JBG, JCA, JCB, JCC, 
             JSA, JSB, JSC, KBA, KCA, REA, REB, RFA, RFB, etc.
```

**RE Code Validation:**
```
Valid values: 1, 2, 3, 4, 1A, 1Q, 2A, 2Q, 3A, 3Q, etc.
Character of Service: Honorable, General, Other Than Honorable, Bad Conduct, Dishonorable
```

### MOS/AFSC/Rating Validators
- Format: 6-digit code (MOS), 4-character code (AFSC), or 5-digit code (Rating)
- Primary and secondary codes exist in military occupational database

### Award Name Validators
- Recognized medal names (Medal of Honor, Purple Heart, etc.)
- Service medals (GWOT, Iraq Campaign Medal, etc.)
- Campaign medals with correct citations
- Non-recognized custom text flagged as "Other Citation"

---

## 7. Transforms

### Service History Transforms
1. **Duration Calculation:**
   - Years of active service: separation date - entry date
   - Years of inactive service: from Block 15

2. **SPD to VA Eligibility:**
   - Map SPD codes to presumptive eligibility
   - Flag discharges that may exclude benefits

3. **Character of Service to Benefits:**
   - Honorable → Full benefits
   - General → Reduced benefits (case-by-case)
   - Other Than Honorable → VA review required
   - Dishonorable/Bad Conduct → No VA benefits

### Rank Transforms
1. Map rank codes to standardized military ranks
2. Compute rank progression logic
3. Extract pay grade history

### MOS/AFSC Transforms
1. Map to standardized military occupational codes
2. Identify hazardous duty indicators (e.g., Demolitions, Aviation)
3. Link to presumptive condition mapping

### Awards Transforms
1. Map awards to combat service indicators:
   - Combat Infantryman Badge → Direct combat
   - Air Medal → Combat aviation
   - Bronze Star → Combat action

2. Map awards to presumptive conditions:
   - Agent Orange exposure (Vietnam service with specific units)
   - Burn Pit exposure (Iraq/Afghanistan)
   - Radiation exposure (nuclear weapons workers)

3. Extract deployment regions from campaign medals

---

## 8. Expected Folder Structure

```
backend/va_scanner/backend/shared/scanner/dd214Analysis/
├── index.js                          # Module exports
├── dd214Scanner.js                   # Main scanner entry
├── dd214BlockDetectionModel.js        # Block location detection
├── dd214VariantModel.js               # Era/format detection
├── dd214ConfidenceModel.js            # Extraction confidence scoring
├── dd214OcrCorrection.js              # OCR error correction
├── dd214ContinuationParser.js         # Multi-page continuation handling
├── dd214StepOneMapper.js              # Step 1: Raw block extraction
├── dd214TemplateLibrary.js            # Block templates by branch/era
├── mosCatalog.js                      # MOS/AFSC/Rating database
├── spdReCodes.js                      # SPD/RE code database
├── crossValidation.js                 # Cross-field validation
├── evidenceGraphMapping.js            # Service history graph construction
├── config.json                        # Scanner metadata & versioning
├── schema/
│   ├── dd214-block-map.schema.json    # Block structure schema
│   └── dd214-output.schema.json       # Expected output schema
├── rules/
│   ├── dd214_block_rules.json         # Block extraction rules
│   ├── dd214_date_rules.json          # Date normalization rules
│   └── dd214_award_rules.json         # Award extraction rules
└── validators/
    ├── dd214_validators.js            # Validation pipeline
    ├── spdValidator.js                # SPD code validation
    └── reValidator.js                 # RE code validation
```

---

## 9. Required Files

**Currently Exist:**
- `index.js`
- `dd214Scanner.js`
- `dd214BlockDetectionModel.js`
- `dd214ConfidenceModel.js`
- `dd214OcrCorrection.js`
- `dd214ContinuationParser.js`
- `dd214StepOneMapper.js`
- `dd214TemplateLibrary.js`
- `mosCatalog.js`
- `spdReCodes.js`
- `crossValidation.js`
- `evidenceGraphMapping.js`

**Must Exist:**
- `config.json` (scanner metadata)
- `schema/dd214-block-map.schema.json`
- `schema/dd214-output.schema.json`
- `rules/dd214_block_rules.json`
- `rules/dd214_date_rules.json`
- `rules/dd214_award_rules.json`
- `validators/dd214_validators.js`
- `validators/spdValidator.js`
- `validators/reValidator.js`

---

## 10. Modernization Requirements

### Code Quality
1. Add JSDoc comments to all functions
2. Add strict mode (`'use strict';` or ES module equivalent)
3. Add structured logging (using shared logger)
4. Add error handling with typed errors
5. Add input validation at pipeline entry

### Configuration
1. `config.json` must contain:
   ```json
   {
     "name": "DD-214 Scanner",
     "version": "2.0.0",
     "description": "Extracts service history from Department of Defense DD-214 discharge papers",
     "lastUpdated": "2026-03-17T00:00:00Z",
     "maintainer": "Rally Forge Team",
     "status": "production",
     "extractionPipeline": [
       "OCR correction",
       "Block detection",
       "Content extraction",
       "Date normalization",
       "Award parsing",
       "Code validation",
       "Cross-validation",
       "Output normalization"
     ],
     "supportedBranches": ["Army", "Navy", "Air Force", "Marines", "Coast Guard"],
     "supportedEras": ["Vietnam", "Gulf War", "OEF/OIF", "Modern"],
     "requiredFields": [...],
     "optionalFields": [...]
   }
   ```

2. Version matrix for field requirements by era/branch

### Versioning
1. Semantic versioning (MAJOR.MINOR.PATCH)
2. CHANGELOG.md tracking all updates
3. Migration guide for schema changes

### Metadata Injection
1. Add `_metadata` object to output:
   ```json
   {
     "_metadata": {
       "scannerId": "dd214-analysis-v2.0.0",
       "scanDate": "2026-03-17T14:30:00Z",
       "documentFormat": "dd214-member-1",
       "era": "oef-oif",
       "branch": "army",
       "confidence": { "overall": 0.95, "byField": {...} },
       "warnings": [],
       "validationStatus": "passed"
     }
   }
   ```

---

## 11. Error Handling Requirements

### Graceful Degradation
1. Missing blocks → flag as "not found" but continue scanning
2. Handwritten text → use OCR correction, flag confidence lower
3. Low-quality scans → apply contrast enhancement, flag additional warnings
4. Multi-page DD-214 → concatenate continuation pages

### Error Categories

**Critical Errors (stop processing):**
- Invalid PDF structure
- No recognizable DD-214 format
- Unreadable due to corruption

**Warnings (flag but continue):**
- Missing optional field
- Poor OCR confidence
- Ambiguous character of service value
- Unrecognized award name

**Info (log for audit):**
- Successfully detected branch
- Successfully parsed continuation
- Confidence score > 90%

### Error Output Format
```json
{
  "success": false,
  "error": "message",
  "errorCode": "DD214_INVALID_FORMAT",
  "warnings": ["warning1", "warning2"],
  "partialResults": { ... }
}
```

---

## 12. Test Cases

### Core Extraction
1. **Member 1 vs Member 4:** Extract from both, compare output
2. **Branch Variants:** Army, Navy, Air Force, Marines formats
3. **Era Variants:** Vietnam, Gulf War, OEF/OIF, Modern
4. **Multi-Page Continuation:** Remarks spanning 2+ pages
5. **Missing Awards:** DD-214 with no Block 13 content
6. **Missing RE Code:** Block 16 empty or illegible
7. **Multiple MOS Entries:** Primary + secondary codes
8. **Character of Service:** All valid values (Honorable, General, OTH, Bad Conduct, Dishonorable)

### Normalization
9. **Date Formats:** YYYYMMDD, MM/DD/YYYY, Month Day Year
10. **Name Suffixes:** Jr., II, III, Sr.
11. **Rank Codes:** All active-duty ranks across branches
12. **Pay Grades:** E1-E9, O1-O10, W1-W5

### Validation
13. **Valid SPD Codes:** Standard separation codes
14. **Valid RE Codes:** All reenlistment eligibility codes
15. **Date Range Validation:** Entry before separation
16. **Military History Dates:** 1945-present only

### Edge Cases
17. **Handwritten Corrections:** OCR + handwriting hybrid
18. **Poor Quality Scans:** Low contrast, smudged text
19. **Ceremonial Discharge:** Special/religious discharge types
20. **Reserve/Guard:** Active + Inactive service time

---

## 13. Sample Input

### Input: Scanned DD-214 PDF
- Format: Multi-page scanned image (600 DPI)
- Size: 2-3 MB (typical for 4-page document)
- OCR Status: Raw OCR output required (pdfjs or similar engine)

**Expected Content:**
```
[Page 1: DD-214 Member 1 form]
Block 1a: SMITH, JOHN MICHAEL JR
Block 2a: 75 (Army)
Block 10: SGT
Block 11: SGT
Block 12: E5
Block 16: 1
Block 17: JBA
Block 18a: 920115  [Jan 15, 1992]
Block 18b: 031210  [Dec 10, 2003]
Block 24: Honorable
Block 28: [Multi-line remarks about service...]
Block 13: Medal of Honor, Distinguished Service Cross, Purple Heart (2 OLC), 
          GWOT Medal, Iraq Campaign Medal, ...

[Page 2-4: Continuation pages if present]
```

---

## 14. Sample Output

### Output: Structured JSON

```json
{
  "success": true,
  "data": {
    "serviceHistory": {
      "fullName": "Smith, John Michael Jr.",
      "branch": "Army",
      "rank": {
        "atEntry": "PVT",
        "atSeparation": "SGT",
        "payGrade": "E5"
      },
      "serviceDate": {
        "entry": "1992-01-15",
        "separation": "2003-12-10",
        "totalDaysActive": 4316,
        "totalYearsActive": 11.81,
        "totalDaysInactive": 0,
        "totalYearsInactive": 0
      }
    },
    "occupationalHistory": {
      "primary": {
        "code": "11B40",
        "name": "Infantry Rifleman, Sergeant",
        "hazardDuty": true
      },
      "secondary": null
    },
    "separationData": {
      "spdCode": "JBA",
      "reCode": "1",
      "characterOfService": "Honorable",
      "narrativeReason": "Completed term of service",
      "eligibilityFlags": ["fullBenefits"]
    },
    "awardsAndDecorations": {
      "combat": [
        "Medal of Honor",
        "Distinguished Service Cross",
        "Purple Heart (2 OLC)"
      ],
      "service": [
        "GWOT Medal",
        "Iraq Campaign Medal",
        "Army Good Conduct Medal"
      ],
      "total": 9,
      "combatIndicators": ["directCombat"]
    },
    "foreignService": {
      "countries": ["Iraq", "Kuwait"],
      "startDate": "2001-03-15",
      "endDate": "2003-11-20"
    },
    "_metadata": {
      "scannerId": "dd214-analysis-v2.0.0",
      "scanDate": "2026-03-17T14:30:00Z",
      "documentFormat": "dd214-member-1",
      "era": "oef-oif",
      "branch": "army",
      "confidence": {
        "overall": 0.98,
        "byField": {
          "name": 0.99,
          "serviceDate": 0.99,
          "rank": 0.95,
          "awards": 0.92
        }
      },
      "warnings": [],
      "validationStatus": "passed"
    }
  }
}
```

---

## 15. Known Edge Cases

### Multi-Page Edge Cases
1. **Remarks Spanning Pages:** Block 28 content split across page boundary
   - **Mitigation:** Continuation parser with page offset tracking

2. **Block Overflow:** Content continues on next/previous page
   - **Mitigation:** Cross-page block detection

3. **Duplicated Pages:** Same page scanned twice
   - **Mitigation:** Hash-based duplicate detection

### Format Edge Cases
4. **Handwritten DD-214:** Entire form handwritten
   - **Mitigation:** OCR + handwriting model, lower confidence threshold

5. **Typed Corrections:** Block 28 has correction tape/pen marks
   - **Mitigation:** OCR error correction with handwriting overlay detection

6. **Faded Text:** Original document faded/aged
   - **Mitigation:** Contrast enhancement, confidence flags

7. **Non-English Text:** Name in non-ASCII characters
   - **Mitigation:** Unicode normalization, script detection

### Content Edge Cases
8. **Multiple Awards Same Line:** "Medal 1, Medal 2, Medal 3" without spacing
   - **Mitigation:** Award splitting regex with known-medal dictionary

9. **Shortened Award Names:** "MOH" instead of "Medal of Honor"
   - **Mitigation:** Award name aliases mapping

10. **Unrecognized SPD/RE:** Old or branch-specific codes not in database
    - **Mitigation:** Fuzzy matching + manual review flag

11. **Ceremonial Discharge:** Special discharge types (Religious, Conscientious Objector)
    - **Mitigation:** Extended character-of-service value set

12. **No RE Code:** Block 16 blank (medical/honorable discharge)
    - **Mitigation:** Treat as missing optional field, infer from SPD

13. **Partial Service:** Entry date blank (prior service DD-214)
    - **Mitigation:** Flag as "prior service record"

14. **Future Dates:** Separation date in future
    - **Mitigation:** Flag validation error, likely OCR error

---

## 16. Future Enhancements

### Phase 2 (Priority)
1. **Presumptive Condition Mapping:**
   - Auto-detect Agent Orange exposure based on branch + unit + dates
   - Auto-detect Burn Pit exposure based on location + dates
   - Auto-detect Radiation exposure based on MOS codes

2. **Combat Service Auto-Detection:**
   - Map deployment decorations to geographic conflict zones
   - Flag for presumptive condition research
   - Link to exposure databases

3. **Service Connection Opportunity Assessment:**
   - Pre-populate "likely service-connected" fields based on MOS + injuries + dates
   - Flag conditions that match common disability patterns

### Phase 3 (Enhancement)
4. **Multi-Language Support:**
   - OCR for forms filled in Spanish, French, etc.
   - Maintain English output normalization

5. **Biometric Integration:**
   - Extract service photo for verification
   - Compare against VA records

6. **Timeline Visualization:**
   - Generate graphical service history timeline
   - Show deployment periods, rank progression, awards

### Phase 4 (Future)
7. **Comparative Analysis:**
   - Compare DD-214 against STR records
   - Flag discrepancies (service dates, rank, assignments)

8. **Predictive Analytics:**
   - Identify high-risk medical conditions based on MOS
   - Suggest preemptive screening

---

## Implementation Notes

- Scanner must validate against schema validators before output
- All dates must be ISO 8601 format in output
- Confidence scores based on OCR quality + field presence + validation pass rate
- Partial results acceptable only for optional fields
- All extracted data must be auditable (traceable to source text)
