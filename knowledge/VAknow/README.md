# VAknow - VA Knowledge Crawler and Benefits Index

Comprehensive index of VA benefits crawled from VA.gov and related official sources.

## Components

### 1. **vaknow_benefits_index.csv** (50 Benefits Indexed)
Structured index of major VA benefits with:
- Benefit ID and official URL
- Category (Compensation, Healthcare, Education, Housing, etc.)
- Keywords for search
- Description and eligibility
- File references for detailed information

**Categories Covered:**
- Compensation (6 benefits)
- Healthcare (7 benefits)
- Education (4 benefits)
- Housing (3 benefits)
- Employment (4 benefits)
- Claims (6 benefits)
- Dependents (2 benefits)
- Presumptive Conditions (4 benefits)
- Mental Health (2 benefits)
- And more...

### 2. **vaknow_checkpoint.json**
Crawler state and progress tracking:
- Last crawl date and status
- Total pages indexed (50)
- Completion progress
- Next scheduled crawl date
- Category breakdown
- Crawl settings and configuration

### 3. **vaknow_crawl.log**
Audit log of crawling activities:
- Start/end timestamps
- Crawl progress events
- Pages visited count
- Errors and issues encountered

### 4. **Benefits-Force/** (Subdirectory)
Specialized benefits force data (implementation area)

## Benefits Indexed

### Top 10 High-Priority Benefits

1. **Disability Compensation** (https://www.va.gov/disability/)
   - Tax-free monthly payment for service-connected disabilities
   - Eligibility: Veterans with 10%+ disability rating

2. **VA Health Care** (https://www.va.gov/health-care/)
   - Comprehensive healthcare through VA medical centers
   - 8 priority groups determine eligibility

3. **GI Bill Education** (https://www.va.gov/education/)
   - Post-9/11 GI Bill covers full tuition plus living stipends
   - Eligibility: 90+ days active duty post-9/10/2001

4. **VA Home Loan** (https://www.va.gov/housing-assistance/)
   - Zero down payment home loans with competitive rates
   - Eligibility: Honorable discharge or better

5. **Veterans Pension** (https://www.va.gov/pension/)
   - Monthly benefit for low-income wartime veterans
   - Eligibility: Age 65+ or permanently/totally disabled

6. **VR&E (Chapter 31)** (https://www.va.gov/careers-employment/)
   - Job training for veterans with 10%+ disability rating
   - Helps identify and prepare for suitable employment

7. **Burial Benefits** (https://www.va.gov/burials-memorials/)
   - Burial in national cemetery, headstones, flags
   - Available to all eligible veterans

8. **Survivors/DIC** (https://www.va.gov/family-member-benefits/)
   - Benefits for survivors of deceased service members
   - Monthly payments to spouses, children, parents

9. **PTSD Benefits** (https://www.va.gov/health-care/mental-health/)
   - Mental health treatment and disability claims
   - Free mental health screening available

10. **Presumptive Conditions**
    - Agent Orange (Vietnam)
    - Gulf War Illness
    - Camp Lejeune water contamination
    - PACT Act (burn pit) exposures

## Search Features

Benefits are indexed by:
- **Category**: Compensation, Healthcare, Education, Housing, etc.
- **Keywords**: Searchable terms within each benefit
- **Eligibility**: Who qualifies for each benefit
- **URL**: Direct links to official VA pages

## Data Structure

Each entry contains:
```json
{
  "id": 1,
  "url": "https://www.va.gov/disability/",
  "title": "Disability Compensation",
  "category": "Compensation",
  "keywords": "disability,compensation,service-connected,rating",
  "description": "Tax-free monthly payment...",
  "eligibility": "Veterans with service-connected disabilities...",
  "filePath": "knowledge/VAknow/pages/disability-compensation.md",
  "timestamp": "2026-03-02T12:00:00Z"
}
```

## Crawler Information

- **Last Full Crawl**: March 2, 2026
- **Pages Indexed**: 50 major benefits
- **Update Frequency**: Weekly scheduled crawls
- **Coverage**: VA.gov benefits and services

## Integration with Rally Forge

The VAknow index integrates with the broader knowledge base to provide:
- Searchable benefits database
- Cross-references to related knowledge components
- Eligibility determination support
- Claim preparation guidance

## Files Referenced

- Individual benefit detail files in `/knowledge/VAknow/pages/` directory
- Structured data for frontend benefit finder tools
- Integration points with knowledge base API

## Resources

- Official VA Benefits: https://www.va.gov/
- VA.gov Search: https://www.va.gov/search/
- Benefits.gov (federal benefits): https://www.benefits.gov/
- MilitaryOneSource: https://www.militaryonesource.mil/

## Next Steps

- Expand to additional specialized benefits pages
- Add detailed eligibility flowcharts
- Create comparison matrices for similar benefits
- Implement real-time updates from VA.gov
