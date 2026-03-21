# DD-214 Military Service Scanner Portable Specification

Version: 1.0  
Date: 2026-03-18  
Purpose: portable scanner specification for use in external AI tools

## 1. Why This Exists

The current DD-214 scanner implementation extracts many useful fields, but the displayed output is still too noisy and inconsistent for your target workflow. A better approach for another AI tool is to give it a strict extraction contract instead of a loose "read the DD-214 and tell me what you find" instruction.

This document is that contract.

Use it to drive a spec-first DD-214 extractor that:

- extracts only military-service-relevant facts
- avoids UI noise and OCR garbage leakage
- marks uncertain fields instead of inventing values
- produces one stable JSON output shape every time

## 2. Scanner Goal

Given OCR text or raw text from a DD-214, extract a normalized military service record for benefits and service-history workflows.

The scanner must prioritize:

- correctness over completeness
- deterministic field mapping over freeform summarization
- null over hallucination
- explicit confidence over implied certainty

## 3. Required Processing Model

The scanner should run in these stages:

1. OCR cleanup and text normalization
2. DD-214 detection and variant detection
3. Block detection where possible
4. Field extraction using semantic anchors first, positional fallback second
5. Normalization into one canonical JSON schema
6. Confidence scoring at field level and overall level
7. Validation pass to suppress obvious garbage output

## 4. Supported Inputs

The scanner should handle:

- DD-214 Member 1
- DD-214 Member 4
- legacy DD-214 variants
- OCR-degraded scans
- text extracted from PDF
- multi-line block content
- continuation-style remarks text

The scanner should reject or downgrade confidence for:

- non-DD-214 military documents
- partial pages missing core identity or service dates
- text dominated by headers, audit stamps, or scan artifacts

## 5. Canonical Output Contract

The scanner must return a single object in this shape:

```json
{
  "documentType": "DD-214",
  "schemaVersion": "portable-1.0",
  "serviceIdentity": {
    "veteranName": null,
    "ssnOrServiceNumber": null,
    "branchOfService": null,
    "component": null
  },
  "servicePeriods": {
    "entryDate": null,
    "separationDate": null,
    "netActiveServiceThisPeriod": null,
    "totalPriorActiveService": null,
    "totalPriorInactiveService": null,
    "seaService": null,
    "initialEntryTraining": null
  },
  "characterAndSeparation": {
    "characterOfService": null,
    "separationAuthority": null,
    "separationCode": null,
    "reentryCode": null,
    "narrativeReasonForSeparation": null,
    "typeOfSeparation": null
  },
  "gradeSpecialty": {
    "gradeRateRank": null,
    "payGrade": null,
    "primaryMOSOrAFSCOrRating": null,
    "additionalMOSOrSpecialties": [],
    "mosDetails": []
  },
  "decorationsAndService": {
    "decorationsAndAwards": [],
    "foreignServiceTotal": null,
    "foreignServiceLocationsIfListed": [],
    "combatIndicatorsFromAwards": []
  },
  "specialProgramsRemarks": {
    "remarksBlock": null,
    "deploymentOrCampaignReferences": [],
    "reenlistments": []
  },
  "militaryEducation": [],
  "lastDutyAssignment": null,
  "transferCommand": null,
  "postServiceContact": {
    "mailingAddressAtSeparation": null,
    "nearestRelativeOrEmergencyContact": null
  },
  "intelligentExtraction": {
    "retirementStatus": null,
    "badgeIndicators": [],
    "hazardIndicators": [],
    "combatIndicators": []
  },
  "dd214Analysis": {
    "serviceDates": {},
    "separation": {},
    "rankAndSpecialty": {},
    "awards": [],
    "deployments": [],
    "militaryEducation": [],
    "lastDutyAssignment": null,
    "transferCommand": null,
    "reenlistments": [],
    "confidenceScores": {
      "overall": 0,
      "fields": {},
      "lowConfidenceFields": []
    },
    "validationSummary": {}
  },
  "extractionMeta": {
    "confidence": 0,
    "fieldConfidence": {},
    "optionalFieldConfidence": {},
    "schemaValid": true,
    "schemaErrors": []
  }
}
```

## 6. Core Required Fields

These fields determine whether the extraction is viable:

- `serviceIdentity.veteranName`
- `serviceIdentity.branchOfService`
- `servicePeriods.entryDate`
- `servicePeriods.separationDate`
- `gradeSpecialty.primaryMOSOrAFSCOrRating`
- `characterAndSeparation.characterOfService`
- `characterAndSeparation.separationCode`
- `characterAndSeparation.reentryCode`
- one of:
  - `decorationsAndService.decorationsAndAwards` non-empty
  - `specialProgramsRemarks.remarksBlock` non-empty

If too many of these are missing, the extractor should still return the schema but lower confidence sharply.

## 7. Optional Enrichment Fields

These fields are valuable but must never be forced:

- `servicePeriods.seaService`
- `servicePeriods.initialEntryTraining`
- `characterAndSeparation.typeOfSeparation`
- `gradeSpecialty.mosDetails`
- `militaryEducation`
- `lastDutyAssignment`
- `transferCommand`
- `specialProgramsRemarks.reenlistments`

If not clearly present, return `null` or `[]`.

## 8. Field Definitions

### 8.1 Identity

`veteranName`

- extract from the formal name field
- preserve full printable name
- remove obvious header noise
- do not invent missing middle initials

`branchOfService`

Allowed normalized values:

- `Army`
- `Navy`
- `Air Force`
- `Marine Corps`
- `Coast Guard`
- `Space Force`

`component`

Examples:

- `RA`
- `USAR`
- `ARNG`
- `USN`
- `USMC`

### 8.2 Service Periods

`entryDate` and `separationDate`

- normalize to `YYYY-MM-DD`
- accept compact `YYYYMMDD`
- accept delimited `YYYY-MM-DD`, `YYYY/MM/DD`, `MM/DD/YYYY`
- prefer anchored field matches over stray dates elsewhere in the document

`netActiveServiceThisPeriod`, `totalPriorActiveService`, `totalPriorInactiveService`, `seaService`

- preserve as structured durations when possible:

```json
{ "years": 8, "months": 6, "days": 29 }
```

- if the source is too degraded to structure safely, return `null`

`initialEntryTraining`

Expected shape:

```json
{
  "completed": true,
  "sourceText": "INITIAL ENTRY TRAINING COMPLETED SUCCESSFULLY"
}
```

Only populate when training completion language is explicit.

### 8.3 Separation

`characterOfService`

Allowed normalized values:

- `Honorable`
- `General`
- `Other Than Honorable`
- `Bad Conduct`
- `Dishonorable`

`typeOfSeparation`

Allowed examples:

- `Retirement`
- `Release from Active Duty`
- `Discharge`

This should be inferred only from explicit separation language.

### 8.4 Grade and Specialty

`payGrade`

- normalize to forms like `E-7`, `O-3`, `W-2`

`primaryMOSOrAFSCOrRating`

- extract the primary code only
- examples: `11B2O`, `13B3P`, `92A`, `0311`

`mosDetails`

Expected shape:

```json
[
  {
    "code": "13B3P",
    "title": "CANNON CREWMEMBER",
    "yearsOfService": 1,
    "monthsOfService": 8
  }
]
```

Rules:

- do not convert garbage lines into MOS entries
- ignore fragments that are clearly headers or broken OCR spillover
- only populate entries with a plausible code or title anchor

### 8.5 Awards and Decorations

`decorationsAndAwards`

- return raw normalized award strings
- split on newline, comma, semicolon, or multi-delimiter lists
- preserve real awards even if they contain words like `CROSS`, `CITATION`, or `VALOR`

Examples that must not be discarded:

- `NAVY CROSS`
- `PRESIDENTIAL UNIT CITATION`
- `DISTINGUISHED FLYING CROSS`
- `PURPLE HEART`

`dd214Analysis.awards`

Return normalized counted awards:

```json
[
  { "name": "ARMY ACHIEVEMENT MEDAL", "count": 2 }
]
```

Count normalization rules:

- `2ND AWARD` -> count `2`
- `WITH 1 OAK LEAF CLUSTER` -> count `2`
- `WITH 2 BRONZE STARS` -> count `3`

### 8.6 Deployments

Deployment extraction must be conservative.

Do extract deployments from:

- `SERVICE IN IRAQ FROM ...`
- `IN SUPPORT OF OPERATION ...`
- explicit hostile fire or imminent danger language
- foreign service locations when supported by deployment context

Do not create deployments from:

- training-only references
- school/course references
- garrison or installation mentions alone
- location names without service/deployment context

Expected deployment shape:

```json
[
  {
    "location": "Iraq",
    "dateRange": {
      "start": "2019-05-01",
      "end": "2020-01-10"
    },
    "campaign": null,
    "operation": "Operation Iraqi Freedom",
    "combatIndicator": true,
    "hazardousDutyIndicator": true,
    "confidence": 0.92,
    "source": "SERVICE IN IRAQ FROM 20190501-20200110 IN SUPPORT OF OPERATION IRAQI FREEDOM",
    "sourceAttribution": [
      {
        "sourceType": "remarks-reference",
        "excerpt": "SERVICE IN IRAQ FROM 20190501-20200110 IN SUPPORT OF OPERATION IRAQI FREEDOM"
      }
    ]
  }
]
```

Deployment dedupe rule:

- dedupe by `location + campaign + operation`
- preserve the richer record if multiple mentions exist

### 8.7 Reenlistments

Capture only explicit reenlistment ranges.

Pattern example:

- `IMMEDIATE REENLISTMENTS THIS PERIOD: 20090101-20130101`

Expected shape:

```json
[
  { "start": "2009-01-01", "end": "2013-01-01" }
]
```

### 8.8 Military Education

Expected shape:

```json
[
  {
    "courseName": "PRIMARY LEADERSHIP DEVELOPMENT COURSE",
    "duration": "4 WKS",
    "yearCompleted": 2009
  }
]
```

Only extract formal course entries. Do not treat remarks or random capitalized phrases as education records.

### 8.9 Last Duty Assignment and Transfer Command

`lastDutyAssignment`

Expected shape:

```json
{
  "lastDutyAssignmentTitle": "1ST CAV DIV",
  "majorCommand": null
}
```

`transferCommand`

Expected shape:

```json
{
  "postServiceComponent": "USAR CON GP (REINF)",
  "sourceText": "USAR CON GP (REINF)"
}
```

These fields should be extracted only from transfer/assignment blocks, not from general remarks overflow.

## 9. OCR Cleanup Rules

The scanner should repair common OCR substitutions before extraction.

Examples:

- `F0RM` -> `FORM`
- `THlS` -> `THIS`
- `SEPARATI0N` -> `SEPARATION`
- `lRAQ` -> `IRAQ`
- `OPERATI0N` -> `OPERATION`
- `SERVlCE` -> `SERVICE`

Do not perform aggressive cleanup that changes legitimate values.

## 10. Noise Suppression Rules

Suppress or ignore text that matches document chrome rather than service facts.

Examples of noise:

- `DD FORM 214`
- `CERTIFICATE OF RELEASE OR DISCHARGE`
- `IMPORTANT RECORD`
- `ALTERATIONS IN SHADED AREAS`
- `DEPARTMENT, COMPONENT AND BRANCH`
- signature boilerplate
- mailing instructions
- copy routing instructions

Critical rule:

- if a candidate value looks like a whole block header instead of a field value, discard it

## 11. Confidence Model

Use a strict confidence model.

Overall confidence should be based on:

- required field coverage
- date validity
- schema validity
- validation checks
- contradiction count

Recommended interpretation:

- `0.90 - 1.00`: highly reliable
- `0.70 - 0.89`: usable with review
- `0.50 - 0.69`: partial extraction
- `< 0.50`: unreliable, review raw text before applying

Field confidence should be binary or near-binary for deterministic extraction:

- `1` when clearly extracted from an anchored source
- `0` when missing or unreliable

Optional enrichment fields should be tracked separately and must not inflate overall confidence.

## 12. Validation Rules

The extractor should flag or downgrade output when:

- entry date is after separation date
- service dates are implausible
- branch is missing but branch-specific codes are claimed with certainty
- separation codes or reentry codes are absent but output implies certainty
- MOS details are full of header fragments or OCR debris
- deployment location is inferred from training text only

## 13. Non-Negotiable Behavior

The scanner must:

- return `null` instead of guessed values
- keep raw remarks text when structured extraction is incomplete
- preserve source excerpts for deployments
- preserve stable keys even when values are empty
- avoid narrative prose in the JSON

The scanner must not:

- invent awards
- infer combat service from a location alone
- treat every foreign location as a deployment
- copy whole header blocks into structured fields
- merge unrelated lines into MOS titles or assignment fields

## 14. Recommended External AI Prompt

If you are uploading this into another AI tool, use this instruction with it:

```text
You are building a DD-214 military service scanner. Follow the attached specification exactly.

Your job is to read OCR text from a DD-214 and return only the canonical JSON schema defined in the specification.

Rules:
- Be conservative.
- Use null when uncertain.
- Do not summarize.
- Do not explain.
- Do not invent missing values.
- Do not return markdown.
- Return valid JSON only.
- Preserve deployment source excerpts and confidence.
- Reject training-only location references as deployments.
- Extract MOS details only when a plausible specialty code and title are present.
```

## 15. Recommended Next Step

If you want the cleanest external handoff, pair this file with one additional artifact:

- a JSON schema file for machine validation

That would let another AI tool produce output that can be validated automatically instead of judged by eye.