# Knowledge Base Integration Implementation Guide

## Quick Start

The Rally Forge knowledge base is now fully integrated with Cases. Access the full knowledge base at:

```
knowledge/
├── part3/               → VA Disability Compensation Rules (752 sections)
├── part4/               → VA Rating Schedule (256 diagnostic codes)  
├── Cases/               → CAVC Precedential Decisions (10 cases)
├── cases_index.json     → Complete case catalog
└── knowledge_base_schema.json → Integration architecture
```

## Loading the Knowledge Base

### 1. Load All Components

```javascript
// Load all knowledge base components
async function initializeKnowledgeBase() {
  const basePath = 'knowledge/';
  
  // Load case index
  const caseIndex = await loadJSON(`${basePath}cases_index.json`);
  
  // Load regulatory sections
  const part3 = await loadJSON(`${basePath}part3/sections.json`);
  const part4 = await loadJSON(`${basePath}part4/sections.json`);
  
  // Load schema
  const schema = await loadJSON(`${basePath}knowledge_base_schema.json`);
  
  return {
    cases: caseIndex,
    part3: part3.sections || part3,
    part4: part4.sections || part4,
    schema: schema
  };
}
```

### 2. Case Lookup Service

```javascript
// Service to look up cases by various criteria
class CaseLookupService {
  constructor(caseIndex) {
    this.cases = caseIndex;
  }
  
  // Get case by CAVC ID
  getCaseById(caseId) {
    return this.cases.find(c => c.caseId === caseId);
  }
  
  // Get all cases from a specific year
  getCasesByYear(year) {
    return this.cases.filter(c => c.year === String(year));
  }
  
  // Get case details with full path
  getCaseDetails(caseId) {
    const caseFile = this.getCaseById(caseId);
    return {
      ...caseFile,
      url: `/${caseFile.filePath}`,
      resourcePath: caseFile.filePath
    };
  }
  
  // List all available cases
  getAllCases() {
    return this.cases;
  }
}
```

### 3. Regulatory Rule + Case Cross-Reference Pattern

When creating rules that depend on cases, use this pattern:

```javascript
const spousalEligibilityRule = {
  id: 'dependent_spousal_eligibility',
  title: 'Spousal Dependency Eligibility',
  regulatoryBase: '38 CFR 3.502',
  description: 'Requirements for recognizing a spouse as a dependent',
  
  criteria: [
    'Legal marriage certificate required',
    'Marriage must be recognized in state of residence',
    'Active marriage status at time of rating decision',
    'No legal separation or divorce'
  ],
  
  // Link to supporting case law
  supportingCases: [
    {
      caseId: 'CAVC-14-3611',
      caseName: 'Sharp v. Shulkin',
      year: 2017,
      principle: 'Common-law marriages recognized in certain states if valid where contracted',
      relevance: 'Clarifies marriage recognition standards across jurisdictions'
    },
    {
      caseId: 'CAVC-15-2424',
      caseName: 'Bankhead v. Shulkin',
      year: 2017,
      principle: 'Timing of marriage relative to service connection affects eligibility',
      relevance: 'Establishes requirement for marriage before rating dates'
    }
  ],
  
  // Implementation function
  validate: (dependentData, effectiveDate) => {
    // Check marriage certificate exists
    if (!dependentData.marriageCertificate) return false;
    
    // Check marriage date is before rating effective date
    if (new Date(dependentData.marriageDate) > new Date(effectiveDate)) {
      return false;
    }
    
    return true;
  }
};
```

## Using Cases in Specific Contexts

### Dependent Extraction

When extracting and validating dependents, reference relevant cases:

```javascript
function validateDependent(dependent, extractionContext) {
  const validation = {
    name: validateName(dependent.name),
    relationship: dependent.relationship,
    casesApplied: []
  };
  
  if (dependent.relationship === 'spouse') {
    // Apply spousal eligibility rule with case precedent
    const spouseRule = getRuleById('dependent_spousal_eligibility');
    
    // Reference supporting cases
    spouseRule.supportingCases.forEach(caseRef => {
      validation.casesApplied.push({
        caseId: caseRef.caseId,
        principle: caseRef.principle
      });
    });
    
    validation.isEligible = spouseRule.validate(dependent, extractionContext.effectiveDate);
  }
  
  if (dependent.relationship === 'child') {
    // Apply child eligibility rule
    const childRule = getRuleById('dependent_child_eligibility');
    
    // Check age based on case precedent
    childRule.supportingCases.forEach(caseRef => {
      validation.casesApplied.push(caseRef.caseId);
    });
    
    validation.isEligible = childRule.validate(dependent, extractionContext.effectiveDate);
  }
  
  return validation;
}
```

### Rating Assignment

When assigning disability ratings, cite supporting case law:

```javascript
function assignRatingWithCases(disability, part4Data, caseLookupService) {
  const diagnosticCode = disability.diagnosticCode;
  const ratingCriteria = part4Data[diagnosticCode];
  
  // Find cases that interpret this diagnostic code
  const applicableCases = findCasesForDiagnosticCode(diagnosticCode);
  
  return {
    diagnosticCode: diagnosticCode,
    percentageRating: calculatePercentage(disability, ratingCriteria),
    basis: ratingCriteria.criteria,
    
    // Include case precedent
    supportingCases: applicableCases.map(caseId => ({
      caseId: caseId,
      details: caseLookupService.getCaseDetails(caseId)
    })),
    
    explanation: generateRatingExplanation(ratingCriteria, applicableCases)
  };
}
```

### Combined Disability Rating

```javascript
function calculateCombinedRatingWithCases(ratings, caseLookupService) {
  // Apply CFR Part 4 combined rating formula
  const combinedRating = applyCombinedRatingFormula(ratings);
  
  // Find cases on combined rating methodology
  const combinedRatingCases = caseLookupService.getCasesByTopic('combined disability rating');
  
  return {
    individualRatings: ratings,
    combinedPercentage: combinedRating,
    methodology: '38 CFR Part 4 Combined Rating Schedule',
    
    supportingPrecedent: combinedRatingCases.map(c => ({
      caseId: c.caseId,
      year: c.year,
      principle: c.principle
    })),
    
    notes: 'Combined rating calculated per 38 CFR Part 4; see related cases for precedent'
  };
}
```

## Effective Date Calculations with Case Precedent

```javascript
function calculateEffectiveDate(ratingDecision, caseLookupService) {
  const effectiveDateRule = getRuleById('effective_date_calculation');
  
  // Find relevant case precedent
  const retroactiveCases = caseLookupService.getCasesByYear(2017).filter(c => 
    c.filePath.includes('retroactive') || c.filePath.includes('effective')
  );
  
  const effectiveDate = determineDate(ratingDecision);
  
  return {
    effectiveDate: effectiveDate,
    basis: effectiveDateRule.description,
    applicableCases: retroactiveCases,
    
    // Retroactive award rules
    retroactiveAllowed: checkRetroactiveRules(ratingDecision),
    retrospectiveStart: calculateRetrospectiveStart(ratingDecision),
    
    reasoning: `Effective date determined per ${effectiveDateRule.regulatoryBase}; ` +
               `see supporting cases for interpretation`
  };
}
```

## API Endpoints (Recommended Implementation)

```javascript
// GET /api/knowledge/cases
// Returns all cases
app.get('/api/knowledge/cases', (req, res) => {
  res.json(caseLookupService.getAllCases());
});

// GET /api/knowledge/cases/:caseId
// Returns specific case details
app.get('/api/knowledge/cases/:caseId', (req, res) => {
  const details = caseLookupService.getCaseDetails(req.params.caseId);
  res.json(details);
});

// GET /api/knowledge/cases/year/:year
// Returns cases from specific year
app.get('/api/knowledge/cases/year/:year', (req, res) => {
  res.json(caseLookupService.getCasesByYear(req.params.year));
});

// GET /api/knowledge/rules/:ruleId
// Returns rule with supporting cases
app.get('/api/knowledge/rules/:ruleId', (req, res) => {
  const rule = getRuleById(req.params.ruleId);
  res.json(rule);
});

// POST /api/knowledge/validate/dependent
// Validates dependent with case references
app.post('/api/knowledge/validate/dependent', (req, res) => {
  const validation = validateDependent(req.body.dependent, req.body.context);
  res.json(validation);
});
```

## File Organization for Implementation

Create a knowledge base utilities module:

```
src/
├── services/
│   ├── knowledgeBase/
│   │   ├── index.js                    # Main service
│   │   ├── caseLookupService.js        # Case searching
│   │   ├── ruleEvaluationEngine.js     # Rule validation
│   │   ├── dependentValidator.js       # Dependent-specific rules
│   │   ├── ratingAssignment.js         # Rating logic with cases
│   │   └── effectiveDateCalculator.js  # Date calculation
│   └── ...
└── utils/
    ├── loadKnowledgeBase.js            # KB initialization
    └── caseReference.js                # Case utilities
```

## Data Flow Example: Complete Dependent Extraction

```
1. Extract dependent from PDF
   ↓
2. Load knowledge base (part3 rules, cases)
   ↓
3. Apply spousal eligibility rule
   │  ├─ Check marriage certificate
   │  ├─ Validate marriage date vs. rating date
   │  └─ Reference supporting cases (Sharp v. Shulkin, Bankhead v. Shulkin)
   ↓
4. Apply child eligibility rule
   │  ├─ Check name and date of birth
   │  ├─ Verify age at rating effective date
   │  └─ Reference child eligibility cases
   ↓
5. Return validated dependent + case citations
   ├─ Name: Jessica Irene Fletcher
   ├─ Type: Spouse
   ├─ Status: Eligible
   ├─ Effective Date: 2017-11-27
   ├─ Supporting Cases:
   │  ├─ CAVC-14-3611 (marriage requirement)
   │  └─ CAVC-15-2424 (marriage timing)
   └─ Next: Add to payment table
```

## Testing with Integrated Knowledge Base

```javascript
describe('Knowledge Base Integration', () => {
  let knowledgeBase, caseLookupService;
  
  beforeEach(async () => {
    knowledgeBase = await initializeKnowledgeBase();
    caseLookupService = new CaseLookupService(knowledgeBase.cases);
  });
  
  test('Should find case by ID', () => {
    const caseDetails = caseLookupService.getCaseById('CAVC-14-3611');
    expect(caseDetails).toBeDefined();
    expect(caseDetails.year).toBe('2017');
  });
  
  test('Should validate dependent with case precedent', () => {
    const dependent = {
      name: 'Jessica Irene Fletcher',
      relationship: 'spouse',
      marriageCertificate: true,
      marriageDate: '2010-06-15'
    };
    
    const validation = validateDependent(dependent, {
      effectiveDate: '2017-11-27'
    });
    
    expect(validation.isEligible).toBe(true);
    expect(validation.casesApplied.length).toBeGreaterThan(0);
  });
  
  test('Should include supporting cases in rating explanation', () => {
    const rating = assignRatingWithCases(
      { diagnosticCode: '5002' },
      knowledgeBase.part4,
      caseLookupService
    );
    
    expect(rating.supportingCases).toBeDefined();
    expect(rating.supporting Cases.length).toBeGreaterThan(0);
  });
});
```

## Status

✅ **Knowledge Base Integration Complete**

- Cases moved to knowledge/Cases/
- Case index generated (cases_index.json)
- Integration guide created (CASES_INTEGRATION.md)
- Schema documented (knowledge_base_schema.json)
- Ready for implementation in rule engine and extraction services

**Next Steps:**
1. Implement case lookup service in your codebase
2. Add case citations to dependent validation rules
3. Add case precedent to rating assignment rules
4. Create API endpoints for case queries
5. Display case citations in UI explanations

---

**Reference**: [CASES_INTEGRATION.md](CASES_INTEGRATION.md) | [knowledge_base_schema.json](knowledge_base_schema.json) | [cases_index.json](cases_index.json)
