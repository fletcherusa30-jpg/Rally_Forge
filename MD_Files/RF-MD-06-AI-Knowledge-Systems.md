# Rally Forge — AI & Knowledge Systems
**AI Model:** Claude Sonnet 4 (Anthropic) | **Local AI:** Llama3/Mistral/Phi3

---

## 1. AI SYSTEM OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                    AI INTELLIGENCE LAYER                    │
│                                                             │
│  ┌─────────────────┐      ┌─────────────────────────────┐   │
│  │  Anthropic API  │      │    Local AI (Ollama)        │   │
│  │  Claude Sonnet  │      │    llama3 / mistral / phi3  │   │
│  │  (Cloud)        │      │    (air-gapped option)      │   │
│  └────────┬────────┘      └──────────────┬──────────────┘   │
│           │                             │                   │
│           └──────────┬──────────────────┘                   │
│                      │                                      │
│                      ▼                                      │
│           ┌─────────────────────┐                           │
│           │   ai/core/          │                           │
│           │   aiClient.js       │ ← Routing logic           │
│           │   aiService.js      │ ← Service wrapper         │
│           └──────────┬──────────┘                           │
│                      │                                      │
│         ┌────────────┼──────────────┐                       │
│         ▼            ▼              ▼                       │
│   STR Analysis  Claim Summary  Service Connection           │
│   Service       Generator      Pathway Analysis             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. AI CLIENT CONFIGURATION

**File:** `ai/config.json`
```json
{
  "defaultModel": "llama3",
  "models": ["llama3", "mistral", "phi3"]
}
```

**Cloud AI:** `ai/core/aiClient.js` — Anthropic SDK wrapper
**Service Wrapper:** `ai/core/aiService.js` — Business logic layer

### Anthropic Integration
```javascript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

// Model used for STRS analysis:
model: 'claude-sonnet-4-20250514'
max_tokens: 2000
temperature: 0  // Deterministic outputs for legal analysis
```

---

## 3. STRS AI ANALYZER SERVICE

**File:** `backend/services/strsAiAnalyzerService.js`

The primary AI feature — analyzes service treatment record extractions to determine service connection viability.

### analyzeServiceConnection(condition, fullText, metadata)

**Input:**
```javascript
{
  condition: {
    label: "Lumbar Strain",
    category: "musculoskeletal",
    occurrences: [
      {
        laterality: { side: "bilateral" },
        severity: { interpretation: "moderate", value: "3/10" },
        negation: { isNegated: false, type: null }
      }
    ],
    extractionType: "condition"
  },
  fullText: "...raw STR text...",
  metadata: { dates: [], pages: [], provider: "..." }
}
```

**Output:**
```javascript
{
  condition: "Lumbar Strain",
  canAnalyze: true,
  serviceConnectionViable: true,
  pathway: "direct",
  strength: "moderate",
  cfrBasis: ["38 CFR §4.71a DC 5237"],
  evidenceSummary: "Condition documented multiple times during active service...",
  nexusOpinion: "Nexus is well-documented through service records...",
  recommendedActions: [
    "Obtain current VA C&P exam",
    "Gather buddy statements",
    "Request private nexus opinion"
  ],
  aiModel: "claude-sonnet-4",
  canAnalyze: true
}
```

### Service Connection Pathways Analyzed
1. **Direct Service Connection** — Condition arose in or was caused by service
2. **Secondary Service Connection** — Caused by or aggravated by a SC condition
3. **Aggravation** — Pre-existing condition permanently worsened
4. **Presumptive** — Legally presumed without direct proof
5. **PACT Act** — Toxic exposure presumptives (burn pits, Agent Orange, etc.)

### Analysis Prompt Construction
The AI prompt includes:
- Condition label and category
- Laterality (bilateral, left, right)
- Severity interpretation
- Negation status and type
- Number of occurrences (first encounter + follow-ups)
- Service dates and context
- Full text excerpts

---

## 4. AI ANALYSIS ROUTER

**File:** `backend/api/aiAnalysisRouter.js`

```
POST /api/ai/analyze-service-connection
  Body: { condition, strText, metadata }
  Response: service connection analysis object

POST /api/ai/analyze-strs
  Body: { extractedConditions[], fullText, metadata }
  Response: batch analysis for all conditions

POST /api/ai/summarize-claim
  Body: { workspaceData }
  Response: AI narrative claim summary

GET /api/ai/status
  Response: { available: bool, model, apiKeyConfigured }
```

**AI Test Router:** `/api/ai-test` — Integration testing endpoint for AI pipeline validation

---

## 5. KNOWLEDGE BASE SYSTEM

**Location:** `knowledge/`

### Knowledge Corpus Structure

```
knowledge/
├── 38_USC/                    ← Title 38 United States Code
│   └── [statutory text files]
│
├── CFR_REGULATIONS/           ← 38 Code of Federal Regulations
│   └── [regulation text files]
│
├── cfr/                       ← Indexed CFR references
│   └── [cross-referenced CFR lookup data]
│
├── FEDERAL_BENEFITS/          ← Federal benefit program data
│   └── [benefit program details]
│
├── MEDICAL_KNOWLEDGE/         ← Medical reference data
│   ├── [ICD-10 codes]
│   ├── [condition descriptions]
│   └── [treatment protocols]
│
├── State_Benefits/            ← State-specific benefit data
│   └── [per-state benefit rules]
│
├── VAknow/                    ← VA-specific knowledge
│   └── [VA policies, forms, procedures]
│
├── exposures/                 ← Toxic exposure data
│   ├── [Agent Orange locations]
│   ├── [burn pit registries]
│   └── [radiation exposure data]
│
├── mos/                       ← Military Occupational Specialties
│   └── [MOS/AFSC code database]
│
├── AI_Metadata/               ← AI training metadata
├── analyzer/                  ← Analyzer knowledge blocks
├── benefits/                  ← Benefits knowledge chunks
├── Web_Intel/                 ← Web-sourced intelligence
├── _quarantine/               ← Quarantined (to-be-verified) data
│
├── knowledge_crossref.json    ← Cross-reference index
└── spd-code-index.md          ← SPD code lookup index
```

---

## 6. KNOWLEDGE BASE SERVICE

**File:** `backend/services/knowledgeBaseService.js`

### Methods
```javascript
search(query, options)           // Full-text search across corpus
getCondition(conditionName)      // Condition + CFR reference lookup
getCFRSection(part, section)     // Specific CFR regulation text
getExposureData(type)            // Toxic exposure details
getMOSData(mosCode)              // MOS/AFSC occupation details
```

### Knowledge Library Service
**File:** `backend/services/knowledgeLibraryService.js`
- Library browsing/navigation
- Category-based retrieval
- Related-topic discovery

### Knowledge Manifest Service
**File:** `backend/services/knowledgeManifestService.js`
- Tracks available knowledge files
- Indexes new knowledge additions
- Reports knowledge coverage gaps

---

## 7. CFR INDEX SERVICE

**File:** `backend/services/cfrIndexService.js`

Provides indexed access to 38 CFR:
- **Part 3** — Adjudication (service connection rules)
- **Part 4** — Schedule for Rating Disabilities (diagnostic codes)
- **Part 17** — Medical care
- **Part 20** — Board of Veterans Appeals
- **Part 21** — Vocational rehabilitation

### CFR PDF Parser
**File:** `backend/services/cfrPdfParserService.js`
- Parses CFR PDF documents into searchable text
- Extracts diagnostic codes and rating criteria
- Builds indexed lookup tables

---

## 8. MOS (Military Occupational Specialty) SYSTEM

### MOS Ingestion Pipeline
**File:** `backend/services/mosIngestionPipeline.js`
- Ingests new MOS/AFSC data
- Normalizes across service branches
- Maps civilian equivalent occupations

### MOS Master Registry Service
**File:** `backend/services/mosMasterRegistryService.js`
- Lookup by MOS code, AFSC, NEC, Rate
- Occupational exposure mapping
- Physical demand categorization

### MOS Validation Engine
**File:** `backend/services/mosValidationEngine.js`
- Validates MOS codes against service branch requirements
- Checks date/era compatibility
- Detects potential data entry errors

### MOS Data Coverage
```
knowledge/mos/
  ├── Army MOS codes (1950s–present)
  ├── Navy NEC/Rate codes
  ├── Air Force/Space Force AFSC codes
  ├── Marine Corps MOS
  ├── Coast Guard ratings
  └── Space Force MOS (Space Force upgrade plan document present)
```

---

## 9. EXPOSURE SERVICE

**File:** `backend/services/exposureService.js`

Maps service history to toxic exposure risks:

### Exposure Categories
```
AGENT ORANGE
  Locations: Vietnam (1962-1975), Korean DMZ (1968-1971),
             Thailand, Guam, Johnston Atoll, other
  Presumptive Diseases: listed per 38 CFR §3.309(e)

BURN PITS (PACT Act)
  Locations: Iraq, Afghanistan, Syria, Djibouti, Somalia,
             Jordan, Egypt, Kuwait, Saudi Arabia, Bahrain, Qatar,
             UAE, Uzbekistan
  Dates: After 08/02/1990

GULF WAR SYNDROME
  Presumptive: Medically unexplained chronic multi-symptom illness
  Locations: Southwest Asia, Afghanistan, Israel, Egypt, Turkey

CAMP LEJEUNE WATER CONTAMINATION
  Location: Marine Corps Base Camp Lejeune, NC
  Dates: 08/01/1953 – 12/31/1987
  Chemicals: TCE, PCE, benzene, vinyl chloride

RADIATION
  ├── Atmospheric Nuclear Tests
  ├── Occupation of Japan (post-WWII)
  ├── Project SHAD/112
  └── Other classified exposures

ASBESTOS
  ├── Shipbuilding
  ├── Insulation work
  └── Specific MOS/ships
```

---

## 10. PRESUMPTIVE ENGINE

**File:** `backend/engine/presumptiveEngine.js`

Determines which conditions qualify as presumptive service-connected:

```javascript
// Input
presumptiveEngine.check({
  conditions: ["ischaemic heart disease", "hypertension"],
  exposures: ["agent_orange"],
  serviceDates: { start: "1968-01-01", end: "1970-12-31" }
})

// Output
{
  presumptive: [
    {
      condition: "ischaemic heart disease",
      basis: "38 CFR §3.309(e) - Agent Orange",
      confidence: "high",
      requiresNexus: false
    }
  ],
  nonPresumptive: ["hypertension"]
}
```

### Presumptive Categories
- Agent Orange diseases (§3.309(e))
- Gulf War illnesses (§3.317)
- PACT Act (2022) — expanded toxic exposure list
- Radiation-associated diseases (§3.311)
- Prisoner of War conditions (§3.309(c))
- Radiogenic diseases (§3.311(b))

---

## 11. INTELLIGENCE SERVICE

**File:** `backend/services/identityService` + `backend/api/intelligence.js`

### Evidence Intelligence Analysis
- Cross-references extracted conditions against regulatory standards
- Identifies strongest service connection pathways
- Scores claim readiness (0–100)
- Gaps analysis — what evidence is missing
- Recommends specific VA forms (21-526EZ, 21-686c, etc.)

---

## 12. AUTHORITY SERVICE

**File:** `backend/services/authorityService.js`

Maps claim elements to authoritative legal citations:
```
Condition → Diagnostic Code (38 CFR §4.71a)
Pathway  → Service Connection Regulation (38 CFR §3.xxx)
SMC      → Statutory Authority (38 USC §1114)
TDIU     → Regulatory Basis (38 CFR §4.16)
```

---

## 13. KNOWLEDGE WIDGET (Frontend)

**File:** `src/components/KnowledgeWidget.jsx`

Inline UI component that:
- Shows contextual CFR references on relevant pages
- Provides condition-specific knowledge snippets
- Links to full knowledge base entries
- Displays legal authority for claim recommendations

---

## 14. RAG SYSTEM

**Location:** `rag/`

Retrieval-Augmented Generation infrastructure:
- Knowledge chunk storage for AI context injection
- Semantic search over knowledge corpus
- AI prompt augmentation with relevant regulatory text
- Ensures AI responses are grounded in actual CFR/law

**AI Chunks:** `ai/chunks/` — Pre-chunked knowledge for context windows

---

## 15. DBQ INDEX SERVICE

**File:** `backend/services/dbqIndexService.js`

**DBQ** = Disability Benefits Questionnaire (VA examination forms)

- Index of all DBQ forms by condition/diagnostic code
- Maps conditions to appropriate examination forms
- Used to recommend which C&P exam to request
- Coverage: 70+ condition-specific DBQ forms

---

## 16. CP EXAM PARSER

**File:** `backend/services/cpExamParser.js`

Parses C&P (Compensation & Pension) exam results:
- Extracts examiner findings
- Identifies nexus opinions (positive/negative/unclear)
- Extracts functional limitation assessments
- Maps findings to diagnostic codes
- Confidence scores per extracted field
