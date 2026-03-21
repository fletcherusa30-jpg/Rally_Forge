# DD-214 Scanner Few-Shot Examples

Purpose: gold-standard examples for external AI tools to learn the expected extraction behavior.

Each example includes:

- OCR-like input text
- normalized JSON output
- conservative null handling

## Example 1: Modern Army Deployment Record

### Input

```text
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
FLETCHER, DALE ARTHUR
2. DEPARTMENT, COMPONENT, AND BRANCH
ARMY / RA
11. PRIMARY SPECIALTY
13B3P CANNON CREWMEMBER // 1 YR 8 MOS
12a. DATE ENTERED AD THIS PERIOD
2009-04-28
12b. SEPARATION DATE THIS PERIOD
2017-11-26
12f. FOREIGN SERVICE
0001 00 10
13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED
ARMY ACHIEVEMENT MEDAL
ARMY COMMENDATION MEDAL (5TH AWARD)
AFGHANISTAN CAMPAIGN MEDAL WITH CAMPAIGN STAR
18. REMARKS
SERVICE IN AFGHANISTAN FROM 20110501-20120511 IN SUPPORT OF OPERATION ENDURING FREEDOM
IMMINENT DANGER PAY
IMMEDIATE REENLISTMENTS THIS PERIOD: 20111007-20171126
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
AR 635-40, CHAP 4
26. SEPARATION CODE
SFK
27. REENTRY CODE
4
28. NARRATIVE REASON FOR SEPARATION
DISABILITY, PERMANENT
```

### Output

```json
{
  "documentType": "DD-214",
  "schemaVersion": "portable-1.0",
  "serviceIdentity": {
    "veteranName": "FLETCHER, DALE ARTHUR",
    "ssnOrServiceNumber": null,
    "branchOfService": "Army",
    "component": "RA"
  },
  "servicePeriods": {
    "entryDate": "2009-04-28",
    "separationDate": "2017-11-26",
    "netActiveServiceThisPeriod": null,
    "totalPriorActiveService": null,
    "totalPriorInactiveService": null,
    "seaService": null,
    "initialEntryTraining": null
  },
  "characterAndSeparation": {
    "characterOfService": "Honorable",
    "separationAuthority": "AR 635-40, CHAP 4",
    "separationCode": "SFK",
    "reentryCode": "4",
    "narrativeReasonForSeparation": "DISABILITY, PERMANENT",
    "typeOfSeparation": "Discharge"
  },
  "gradeSpecialty": {
    "gradeRateRank": null,
    "payGrade": null,
    "primaryMOSOrAFSCOrRating": "13B3P",
    "additionalMOSOrSpecialties": [],
    "mosDetails": [
      {
        "code": "13B3P",
        "title": "CANNON CREWMEMBER",
        "yearsOfService": 1,
        "monthsOfService": 8
      }
    ]
  },
  "decorationsAndService": {
    "decorationsAndAwards": [
      "ARMY ACHIEVEMENT MEDAL",
      "ARMY COMMENDATION MEDAL (5TH AWARD)",
      "AFGHANISTAN CAMPAIGN MEDAL WITH CAMPAIGN STAR"
    ],
    "foreignServiceTotal": {
      "years": 1,
      "months": 0,
      "days": 10
    },
    "foreignServiceLocationsIfListed": [
      "Afghanistan"
    ],
    "combatIndicatorsFromAwards": [
      "AFGHANISTAN CAMPAIGN MEDAL"
    ]
  },
  "specialProgramsRemarks": {
    "remarksBlock": "SERVICE IN AFGHANISTAN FROM 20110501-20120511 IN SUPPORT OF OPERATION ENDURING FREEDOM IMMINENT DANGER PAY IMMEDIATE REENLISTMENTS THIS PERIOD: 20111007-20171126",
    "deploymentOrCampaignReferences": [
      "SERVICE IN AFGHANISTAN FROM 20110501-20120511 IN SUPPORT OF OPERATION ENDURING FREEDOM"
    ],
    "reenlistments": [
      {
        "start": "2011-10-07",
        "end": "2017-11-26"
      }
    ]
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
    "hazardIndicators": [
      "IMMINENT DANGER PAY",
      "AFGHANISTAN"
    ],
    "combatIndicators": [
      "AFGHANISTAN CAMPAIGN MEDAL"
    ]
  },
  "dd214Analysis": {
    "serviceDates": {
      "dateEnteredActiveDuty": "2009-04-28",
      "separationDate": "2017-11-26",
      "foreignService": {
        "years": 1,
        "months": 0,
        "days": 10
      }
    },
    "separation": {
      "characterOfService": "Honorable",
      "separationAuthority": "AR 635-40, CHAP 4",
      "separationCode": "SFK",
      "reentryCode": "4",
      "narrativeReasonForSeparation": "DISABILITY, PERMANENT",
      "typeOfSeparation": "Discharge"
    },
    "rankAndSpecialty": {
      "primarySpecialty": "13B3P",
      "mosDetails": [
        {
          "code": "13B3P",
          "title": "CANNON CREWMEMBER",
          "yearsOfService": 1,
          "monthsOfService": 8
        }
      ]
    },
    "awards": [
      {
        "name": "ARMY ACHIEVEMENT MEDAL",
        "count": 1
      },
      {
        "name": "ARMY COMMENDATION MEDAL",
        "count": 5
      },
      {
        "name": "AFGHANISTAN CAMPAIGN MEDAL WITH CAMPAIGN STAR",
        "count": 1
      }
    ],
    "deployments": [
      {
        "location": "Afghanistan",
        "dateRange": {
          "start": "2011-05-01",
          "end": "2012-05-11"
        },
        "campaign": null,
        "operation": "Operation Enduring Freedom",
        "combatIndicator": true,
        "hazardousDutyIndicator": true,
        "confidence": 0.92,
        "source": "SERVICE IN AFGHANISTAN FROM 20110501-20120511 IN SUPPORT OF OPERATION ENDURING FREEDOM",
        "sourceAttribution": [
          {
            "sourceType": "remarks-reference",
            "excerpt": "SERVICE IN AFGHANISTAN FROM 20110501-20120511 IN SUPPORT OF OPERATION ENDURING FREEDOM"
          }
        ]
      }
    ],
    "militaryEducation": [],
    "lastDutyAssignment": null,
    "transferCommand": null,
    "reenlistments": [
      {
        "start": "2011-10-07",
        "end": "2017-11-26"
      }
    ],
    "confidenceScores": {
      "overall": 0.91,
      "fields": {
        "veteranName": 1,
        "branchOfService": 1,
        "entryDate": 1,
        "separationDate": 1,
        "primarySpecialty": 1,
        "characterOfService": 1,
        "separationCode": 1,
        "reentryCode": 1,
        "awardsOrRemarks": 1
      },
      "lowConfidenceFields": []
    },
    "validationSummary": {
      "allChecksPassed": true
    }
  },
  "extractionMeta": {
    "confidence": 0.91,
    "fieldConfidence": {
      "veteranName": 1,
      "branchOfService": 1,
      "entryDate": 1,
      "separationDate": 1,
      "primarySpecialty": 1,
      "characterOfService": 1,
      "separationCode": 1,
      "reentryCode": 1,
      "awardsOrRemarks": 1
    },
    "optionalFieldConfidence": {
      "seaService": 0,
      "initialEntryTraining": 0,
      "typeOfSeparation": 1,
      "mosDetails": 1,
      "militaryEducation": 0,
      "lastDutyAssignment": 0,
      "transferCommand": 0,
      "reenlistments": 1
    },
    "schemaValid": true,
    "schemaErrors": []
  }
}
```

## Example 2: Legacy DD-214 With Minimal Enrichment

### Input

```text
DD FORM 214 NOV 1977
CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
1. NAME
DOE, ROBERT L
2. DEPARTMENT, COMPONENT AND BRANCH
ARMY / RA
11. PRIMARY SPECIALTY
11B INFANTRYMAN
12a. DATE ENTERED ACTIVE DUTY THIS PERIOD 1974-05-01
12b. SEPARATION DATE THIS PERIOD 1977-09-30
12c. NET ACTIVE SERVICE THIS PERIOD 0003 04 29
13. DECORATIONS MEDALS BADGES
NATIONAL DEFENSE SERVICE MEDAL
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
AR 635-200
26. SEPARATION CODE
LBK
27. REENTRY CODE
1
28. NARRATIVE REASON FOR SEPARATION
EXPIRATION TERM OF SERVICE
```

### Output

```json
{
  "documentType": "DD-214",
  "schemaVersion": "portable-1.0",
  "serviceIdentity": {
    "veteranName": "DOE, ROBERT L",
    "ssnOrServiceNumber": null,
    "branchOfService": "Army",
    "component": "RA"
  },
  "servicePeriods": {
    "entryDate": "1974-05-01",
    "separationDate": "1977-09-30",
    "netActiveServiceThisPeriod": {
      "years": 3,
      "months": 4,
      "days": 29
    },
    "totalPriorActiveService": null,
    "totalPriorInactiveService": null,
    "seaService": null,
    "initialEntryTraining": null
  },
  "characterAndSeparation": {
    "characterOfService": "Honorable",
    "separationAuthority": "AR 635-200",
    "separationCode": "LBK",
    "reentryCode": "1",
    "narrativeReasonForSeparation": "EXPIRATION TERM OF SERVICE",
    "typeOfSeparation": null
  },
  "gradeSpecialty": {
    "gradeRateRank": null,
    "payGrade": null,
    "primaryMOSOrAFSCOrRating": "11B",
    "additionalMOSOrSpecialties": [],
    "mosDetails": [
      {
        "code": "11B",
        "title": "INFANTRYMAN",
        "yearsOfService": null,
        "monthsOfService": null
      }
    ]
  },
  "decorationsAndService": {
    "decorationsAndAwards": [
      "NATIONAL DEFENSE SERVICE MEDAL"
    ],
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
    "serviceDates": {
      "dateEnteredActiveDuty": "1974-05-01",
      "separationDate": "1977-09-30",
      "netActiveService": {
        "years": 3,
        "months": 4,
        "days": 29
      }
    },
    "separation": {
      "characterOfService": "Honorable",
      "separationAuthority": "AR 635-200",
      "separationCode": "LBK",
      "reentryCode": "1",
      "narrativeReasonForSeparation": "EXPIRATION TERM OF SERVICE",
      "typeOfSeparation": null
    },
    "rankAndSpecialty": {
      "primarySpecialty": "11B",
      "mosDetails": [
        {
          "code": "11B",
          "title": "INFANTRYMAN",
          "yearsOfService": null,
          "monthsOfService": null
        }
      ]
    },
    "awards": [
      {
        "name": "NATIONAL DEFENSE SERVICE MEDAL",
        "count": 1
      }
    ],
    "deployments": [],
    "militaryEducation": [],
    "lastDutyAssignment": null,
    "transferCommand": null,
    "reenlistments": [],
    "confidenceScores": {
      "overall": 0.84,
      "fields": {
        "veteranName": 1,
        "branchOfService": 1,
        "entryDate": 1,
        "separationDate": 1,
        "primarySpecialty": 1,
        "characterOfService": 1,
        "separationCode": 1,
        "reentryCode": 1,
        "awardsOrRemarks": 1
      },
      "lowConfidenceFields": []
    },
    "validationSummary": {
      "allChecksPassed": true
    }
  },
  "extractionMeta": {
    "confidence": 0.84,
    "fieldConfidence": {
      "veteranName": 1,
      "branchOfService": 1,
      "entryDate": 1,
      "separationDate": 1,
      "primarySpecialty": 1,
      "characterOfService": 1,
      "separationCode": 1,
      "reentryCode": 1,
      "awardsOrRemarks": 1
    },
    "optionalFieldConfidence": {
      "seaService": 0,
      "initialEntryTraining": 0,
      "typeOfSeparation": 0,
      "mosDetails": 1,
      "militaryEducation": 0,
      "lastDutyAssignment": 0,
      "transferCommand": 0,
      "reenlistments": 0
    },
    "schemaValid": true,
    "schemaErrors": []
  }
}
```

## Example 3: OCR-Degraded Retirement Record With Transfer Command

### Input

```text
DD F0RM 214 MEMBER-4
1. NAME (Last, First, Middle)
RETIRE, JANE Q
2. DEPARTMENT, C0MPONENT, AND BRANCH
ARMY / RA
9. COMMAND TO WHICH TRANSFERRED
USAR CON GP (RET)
11. PRIMARY SPECIALTY
42A HUMAN RESOURCES SPECIALIST // 6 YRS
12a. DATE ENTERED AD THlS PERlOD
2011-01-01
12b. SEPARATI0N DATE THlS PERlOD
2017-01-01
14. MILITARY EDUCATION
ADVANCED LEADER COURSE 6 WKS 2015
18. REMARKS
INITIAL ENTRY TRAINING COMPLETED SUCCESSFULLY
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
AR 635-200
26. SEPARATION CODE
RBD
27. REENTRY CODE
4
28. NARRATIVE REASON FOR SEPARATION
SUFFICIENT SERVICE FOR RETIREMENT
```

### Output

```json
{
  "documentType": "DD-214",
  "schemaVersion": "portable-1.0",
  "serviceIdentity": {
    "veteranName": "RETIRE, JANE Q",
    "ssnOrServiceNumber": null,
    "branchOfService": "Army",
    "component": "RA"
  },
  "servicePeriods": {
    "entryDate": "2011-01-01",
    "separationDate": "2017-01-01",
    "netActiveServiceThisPeriod": null,
    "totalPriorActiveService": null,
    "totalPriorInactiveService": null,
    "seaService": null,
    "initialEntryTraining": {
      "completed": true,
      "sourceText": "INITIAL ENTRY TRAINING COMPLETED SUCCESSFULLY"
    }
  },
  "characterAndSeparation": {
    "characterOfService": "Honorable",
    "separationAuthority": "AR 635-200",
    "separationCode": "RBD",
    "reentryCode": "4",
    "narrativeReasonForSeparation": "SUFFICIENT SERVICE FOR RETIREMENT",
    "typeOfSeparation": "Retirement"
  },
  "gradeSpecialty": {
    "gradeRateRank": null,
    "payGrade": null,
    "primaryMOSOrAFSCOrRating": "42A",
    "additionalMOSOrSpecialties": [],
    "mosDetails": [
      {
        "code": "42A",
        "title": "HUMAN RESOURCES SPECIALIST",
        "yearsOfService": 6,
        "monthsOfService": 0
      }
    ]
  },
  "decorationsAndService": {
    "decorationsAndAwards": [],
    "foreignServiceTotal": null,
    "foreignServiceLocationsIfListed": [],
    "combatIndicatorsFromAwards": []
  },
  "specialProgramsRemarks": {
    "remarksBlock": "INITIAL ENTRY TRAINING COMPLETED SUCCESSFULLY",
    "deploymentOrCampaignReferences": [],
    "reenlistments": []
  },
  "militaryEducation": [
    {
      "courseName": "ADVANCED LEADER COURSE",
      "duration": "6 WKS",
      "yearCompleted": 2015
    }
  ],
  "lastDutyAssignment": null,
  "transferCommand": {
    "postServiceComponent": "USAR CON GP (RET)",
    "sourceText": "USAR CON GP (RET)"
  },
  "postServiceContact": {
    "mailingAddressAtSeparation": null,
    "nearestRelativeOrEmergencyContact": null
  },
  "intelligentExtraction": {
    "retirementStatus": "RETIRED",
    "badgeIndicators": [],
    "hazardIndicators": [],
    "combatIndicators": []
  },
  "dd214Analysis": {
    "serviceDates": {
      "dateEnteredActiveDuty": "2011-01-01",
      "separationDate": "2017-01-01",
      "initialEntryTraining": {
        "completed": true,
        "sourceText": "INITIAL ENTRY TRAINING COMPLETED SUCCESSFULLY"
      }
    },
    "separation": {
      "characterOfService": "Honorable",
      "separationAuthority": "AR 635-200",
      "separationCode": "RBD",
      "reentryCode": "4",
      "narrativeReasonForSeparation": "SUFFICIENT SERVICE FOR RETIREMENT",
      "typeOfSeparation": "Retirement"
    },
    "rankAndSpecialty": {
      "primarySpecialty": "42A",
      "mosDetails": [
        {
          "code": "42A",
          "title": "HUMAN RESOURCES SPECIALIST",
          "yearsOfService": 6,
          "monthsOfService": 0
        }
      ]
    },
    "awards": [],
    "deployments": [],
    "militaryEducation": [
      {
        "courseName": "ADVANCED LEADER COURSE",
        "duration": "6 WKS",
        "yearCompleted": 2015
      }
    ],
    "lastDutyAssignment": null,
    "transferCommand": {
      "postServiceComponent": "USAR CON GP (RET)",
      "sourceText": "USAR CON GP (RET)"
    },
    "reenlistments": [],
    "confidenceScores": {
      "overall": 0.88,
      "fields": {
        "veteranName": 1,
        "branchOfService": 1,
        "entryDate": 1,
        "separationDate": 1,
        "primarySpecialty": 1,
        "characterOfService": 1,
        "separationCode": 1,
        "reentryCode": 1,
        "awardsOrRemarks": 1
      },
      "lowConfidenceFields": []
    },
    "validationSummary": {
      "allChecksPassed": true
    }
  },
  "extractionMeta": {
    "confidence": 0.88,
    "fieldConfidence": {
      "veteranName": 1,
      "branchOfService": 1,
      "entryDate": 1,
      "separationDate": 1,
      "primarySpecialty": 1,
      "characterOfService": 1,
      "separationCode": 1,
      "reentryCode": 1,
      "awardsOrRemarks": 1
    },
    "optionalFieldConfidence": {
      "seaService": 0,
      "initialEntryTraining": 1,
      "typeOfSeparation": 1,
      "mosDetails": 1,
      "militaryEducation": 1,
      "lastDutyAssignment": 0,
      "transferCommand": 1,
      "reenlistments": 0
    },
    "schemaValid": true,
    "schemaErrors": []
  }
}
```

## Usage Note

If the external AI starts producing values outside these patterns, prefer tightening the prompt and schema before adding more heuristic examples.

## Example 4: Navy Record With Sea Service

### Input

```text
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
SAILOR, PETER N
2. DEPARTMENT, COMPONENT, AND BRANCH
NAVY / USN
11. PRIMARY SPECIALTY
BM BOATSWAIN'S MATE // 6 YRS
12a. DATE ENTERED AD THIS PERIOD
2010-01-01
12b. SEPARATION DATE THIS PERIOD
2016-01-01
12g. TOTAL SEA SERVICE
0005 00 00
13. DECORATIONS, MEDALS, BADGES
NAVY AND MARINE CORPS ACHIEVEMENT MEDAL
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
MILPERSMAN 1910-102
26. SEPARATION CODE
JBK
27. REENTRY CODE
1
28. NARRATIVE REASON FOR SEPARATION
COMPLETION OF REQUIRED ACTIVE SERVICE
```

### Output Notes

- `branchOfService` should be `Navy`
- `component` should be `USN`
- `seaService` should be `{ "years": 5, "months": 0, "days": 0 }`
- no deployment should be inferred
- no foreign service location should be invented

## Example 5: Marine Corps Award Preservation

### Input

```text
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
VALOR, GRACE T
2. DEPARTMENT, COMPONENT, AND BRANCH
MARINE CORPS / USMC
11. PRIMARY SPECIALTY
0311 RIFLEMAN // 4 YRS
12a. DATE ENTERED AD THIS PERIOD
2003-06-01
12b. SEPARATION DATE THIS PERIOD
2007-06-01
13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED
NAVY CROSS
PRESIDENTIAL UNIT CITATION
DISTINGUISHED FLYING CROSS
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
MCO P1900.16
26. SEPARATION CODE
JBK
27. REENTRY CODE
1
28. NARRATIVE REASON FOR SEPARATION
COMPLETION OF REQUIRED ACTIVE SERVICE
```

### Output Notes

- preserve all three awards exactly as real awards
- do not discard them because they contain `CROSS` or `CITATION`
- no deployment should be inferred from awards alone

## Example 6: National Guard Record With Sparse Data

### Input

```text
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
GUARD, EMILY R
2. DEPARTMENT, COMPONENT, AND BRANCH
ARMY NATIONAL GUARD / ARNG
11. PRIMARY SPECIALTY
92A AUTOMATED LOGISTICAL SPECIALIST // 2 YRS
12a. DATE ENTERED AD THIS PERIOD
2018-01-01
12b. SEPARATION DATE THIS PERIOD
2020-01-01
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
NGR 600-200
26. SEPARATION CODE
MBK
27. REENTRY CODE
1
28. NARRATIVE REASON FOR SEPARATION
COMPLETION OF REQUIRED ACTIVE SERVICE
```

### Output Notes

- `component` should be `ARNG`
- preserve sparse output
- no decorations, deployments, transfer command, or education should be invented

## Example 7: Severe OCR With Iraq Deployment

### Input

```text
DD F0RM 214 MEMBER-4
SMlTH, ANDREA K
ARMY / RA
11B2O INFANTRYMAN // 3 YRS 2 MOS
2018-01-05
2022-01-04
lRAQ CAMPAIGN MEDAL
SERVlCE lN lRAQ FR0M 20190501-20200110 lN SUPP0RT 0F OPERATI0N lRAQl FREEDOM
HONORABLE
JBK
1
```

### Output Notes

- OCR normalization should recover `IRAQ`, `SERVICE`, and `OPERATION`
- a deployment record should be created for Iraq
- deployment confidence should remain conservative, not perfect

## Example 8: Transfer Command Without Last Duty Assignment

### Input

```text
DD FORM 214 MEMBER-4
1. NAME (Last, First, Middle)
TRANSFER, BLAKE Q
2. DEPARTMENT, COMPONENT, AND BRANCH
ARMY / RA
9. COMMAND TO WHICH TRANSFERRED
USAR CON GP (REINF)
11. PRIMARY SPECIALTY
42A HUMAN RESOURCES SPECIALIST // 6 YRS
12a. DATE ENTERED AD THIS PERIOD
2011-01-01
12b. SEPARATION DATE THIS PERIOD
2017-01-01
24. CHARACTER OF SERVICE
HONORABLE
25. SEPARATION AUTHORITY
AR 635-200
26. SEPARATION CODE
JBK
27. REENTRY CODE
1
28. NARRATIVE REASON FOR SEPARATION
COMPLETION OF REQUIRED ACTIVE SERVICE
```

### Output Notes

- extract `transferCommand`
- keep `lastDutyAssignment` null
- do not merge transfer text into the wrong field

## Example 9: Invalid Deployment Candidate From Training Text

### Input

```text
DD FORM 214 MEMBER-4
NOISE, JAMIE T
ARMY / RA
42A HUMAN RESOURCES SPECIALIST // 4 YRS
2016-01-01
2020-01-01
COMPLETED KOREA LANGUAGE TRAINING COURSE AT FORT BRAGG
HONORABLE
JBK
1
```

### Output Notes

- deployments must be `[]`
- `hazardIndicators` must be `[]`
- `foreignServiceLocationsIfListed` should remain empty unless supported elsewhere