# Cases Integration into Rally Forge Knowledge Base

## Overview

The **Cases** folder (now integrated into `knowledge/Cases/`) contains precedential CAVC (Court of Appeals for Veterans Claims) decisions that serve as supplementary legal authority for VA benefit determinations. These cases provide interpretive guidance for applying 38 CFR Part 3 and Part 4 regulations.

## Knowledge Base Structure

```
knowledge/
├── part3/               (752 sections - VA Regulations for Disability Compensation)
├── part4/               (256 diagnostic code sections - VA Rating Schedule)
├── Cases/               (10 precedential CAVC decisions organized by year)
│   ├── 1990/
│   ├── 1995/
│   ├── 2010/
│   ├── 2017/
│   ├── 2018/
│   ├── 2019/
│   └── 2025/
├── _raw_extraction/     (Raw extracted materials)
├── parsing_summary.json (Knowledge base statistics)
├── cases_index.json     (Case catalog and metadata)
└── CASES_INTEGRATION.md (This file)
```

## Case Types and Organization

### By Year (Temporal Precedent)
- **1990s**: Foundational CAVC decisions establishing disability compensation principles
- **2010-2019**: Mid-period decisions clarifying regulatory interpretations
- **2025**: Recent precedent reflecting current VA policy

### Case Citation Format
```
CAVC-YY-NNNN - Appellant v. Secretary/Respondent
Example: CAVC-14-3611 - Sharp v. Shulkin (decided 2017)
```

### Case Organization
Each case file contains:
- **CaseId**: Official CAVC case number (CAVC-YY-NNNN)
- **Year**: Decision year
- **Court**: CAVC (Court of Appeals for Veterans Claims)
- **SourceUrl**: Link to full PDF decision from uscourts.cavc.gov

## Integration Points with Regulatory Knowledge Base

### 1. Part 3 (Disability Compensation) + Cases
Cases clarify regulatory interpretation for:
- Effective dates and retroactive awards
- Service connection nexus standards
- Presumptive conditions and causation
- Dependent and family member eligibility
- Compensation adjustment rules

**Example Integration Pattern:**
```
Part 3 Rule → Cite relevant case that interprets or applies the rule
```

### 2. Part 4 (Rating Schedule) + Cases
Cases provide guidance on:
- Diagnostic code application
- Percentage rating criteria interpretation
- Combined disability rating methodology
- Serial examinations and rating changes
- Objective evidence standards

**Example Integration Pattern:**
```
Diagnostic Code Rule → Cite case applying rating criteria to specific disability
```

### 3. Dependent Extraction Context
Cases inform:
- Dependent verification standards
- Spousal eligibility criteria
- Child age and dependent status rules
- Removal of dependent events

## Case Citation in Rally Forge Engine

### Usage Pattern in Rules
When a rule references or depends on case law, structure as:

```json
{
  "rule": "dependent_spousal_eligibility",
  "text": "Spouse must be legally married at time of rating decision...",
  "regulatoryBasis": "38 CFR 3.502",
  "casesCiting": [
    {
      "caseId": "CAVC-14-3611",
      "name": "Sharp v. Shulkin",
      "year": 2017,
      "principle": "Legal marriage required; common-law marriages recognized in certain states",
      "filePath": "Cases/2017/CAVC-14-3611 - Sharp v_ Shulkin.md"
    }
  ]
}
```

### Case Reference Index
To reference a case from the knowledge base:

```javascript
// In code or rules:
const caseRef = getCaseById('CAVC-14-3611');
const caseDetails = {
  id: caseRef.caseId,
  name: caseRef.name,
  year: caseRef.year,
  urlPath: caseRef.filePath
};
```

## Searching Cases

### Case Index Format
File: `knowledge/cases_index.json`

```json
[
  {
    "caseId": "CAVC-14-3611",
    "year": "2017",
    "fileName": "CAVC-14-3611 - Sharp v_ Shulkin.md",
    "filePath": "Cases/2017/CAVC-14-3611 - Sharp v_ Shulkin.md"
  },
  ...
]
```

### Search Queries
- **By Case ID**: `"CAVC-14-3611"`
- **By Year**: `cases_index.json → filter(year="2017")`
- **By Appellant**: Search case file name pattern

## Implementation Recommendations

### For Rule Engine
1. Load `cases_index.json` on initialization
2. Create case lookup service: `getCaseById(caseId) → case details`
3. Link case references in regulatory rules
4. Display case citations in decision explanations

### For Dependent Extraction
- Reference dependent-related cases when validating dependent data
- Include case-based precedent in validation warnings

### For Rating Decisions
- Cross-reference diagnostic code cases when assigning percentages
- Cite relevant case law in rating explanations

### For User Interface
- Create "Related Cases" section in regulatory rule views
- Link case IDs to knowledge base references
- Show case precedent timeline (1990 → 2025)

## Case Study: Dependent Verification

**Scenario**: New spouse added to rating; need to verify eligibility

**Regulatory Basis**: 38 CFR 3.502 (spousal eligibility)

**Supporting Cases**:
- CAVC cases (2017-2019) that clarify marriage requirements
- Precedent for documentation standards
- Edge cases (marriage timing, divorce, remarriage)

**Integration Flow**:
```
User Input: New spouse data
  ↓
Rate Validation Rule (Part 3.502)
  ↓
Check Case Precedent (related CAVC decisions)
  ↓
Display Result + Case Citations
```

## Adding New Cases

When new CAVC decisions are published:

1. Create file in appropriate year folder: `Cases/YYYY/CAVC-YY-NNNN - Appellant v_ Respondent.md`
2. Include metadata:
   ```markdown
   # Appellant v. Respondent

   **CaseId:** CAVC-YY-NNNN
   **Year:** YYYY
   **Court:** CAVC
   **SourceUrl:** https://www.uscourts.cavc.gov/documents/[CaseName].pdf

   _[Case description and significance]_
   ```
3. Regenerate `cases_index.json`
4. Update relevant regulatory rules with case citation if applicable

## Statistics

- **Total Cases**: 10
- **Date Range**: 1990 - 2025
- **Part 3 Sections**: 752
- **Part 4 Sections**: 256
- **Combined Knowledge Base**: 1,018+ regulatory sections + 10 case precedents

## Related Files

- `knowledge/cases_index.json` - Complete case catalog
- `knowledge/part3/sections.json` - Regulatory rules (Part 3)
- `knowledge/part4/sections.json` - Rating schedule (Part 4)
- `knowledge/parsing_summary.json` - Knowledge base statistics

## Technical Notes

- Case metadata uses standardized CAVC citation format
- Source URLs point to official uscourts.cavc.gov documents
- Case files are stored as markdown with embedded metadata
- Cases are organized primarily by year (temporal precedence)
- Integration allows cross-referencing between regulatory rules and cases

---

**Last Updated**: 2026-03-02  
**Knowledge Base Integration**: Complete  
**Cases Integrated**: 10  
**Status**: Active
