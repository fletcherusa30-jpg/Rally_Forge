# SPD Code Index (VA-Relevant Codes Only)
Rally Forge — DD-214 Separation Program Designator Reference

## 1. Disability Retirement & Disability Separation Codes

| SPD | Meaning | Notes |
|-----|---------|-------|
| SEJ | Disability, Permanent | Medical retirement (enhanced) |
| SFJ | Disability, Temporary | TDRL placement |
| SFK | Disability, Temporary (Non-Duty) | TDRL, non-duty related |
| SFX | Disability, Permanent (Non-Duty) | PDRL, non-duty related |
| JEA | Disability, Severance Pay | Non-combat |
| JEB | Disability, Severance Pay (Combat-Related) | CRSC-relevant |
| JEC | Disability, Severance Pay (Non-Combat) | Non-CRSC |
| JED | Disability, Severance Pay (Combat-Related, Enhanced) | CRSC-eligible |
| JEF | Disability, Existed Prior to Service (EPTS) | Non-compensable |
| JEN | Disability, Not in Line of Duty | Non-compensable |

## 2. Medical Separation (Non-Retirement)

| SPD | Meaning |
|-----|---------|
| JFV | Physical Standards |
| JFW | Medical Board (Non-Duty) |
| JFX | Medical Board (Duty-Related) |
| JFL | Physical Disability (Non-Duty) |
| JFM | Physical Disability (Duty-Related) |

## 3. Administrative Separation Codes

| SPD | Meaning |
|-----|---------|
| JFF | Secretarial Authority |
| JND | Miscellaneous/General Reasons |
| JNC | Reduction in Force |
| JNF | Early Release to Attend School |
| JNE | Early Release to Accept Civilian Job |
| JNP | Early Release – Seasonal Employment |
| JNR | Early Release – Insufficient Retainability |
| JNS | Early Release – Pregnancy |
| JNT | Early Release – Hardship |
| JNU | Early Release – Dependency |
| JNY | Early Release – Parenthood |
| LBK | Expiration Term of Service |

## 4. Misconduct-Related Separation Codes

| SPD | Meaning |
|-----|---------|
| JKQ | Misconduct (Serious Offense) |
| JKA | Misconduct (Pattern) |
| JKB | Misconduct (Drug Abuse) |
| JKC | Misconduct (Commission of a Serious Offense) |
| JKE | Misconduct (Civil Conviction) |
| JKN | Misconduct (Minor Infractions) |
| JNC | Misconduct (General) |

## 5. Performance / Failure Codes

| SPD | Meaning |
|-----|---------|
| JHJ | Unsatisfactory Performance |
| JHF | Failure to Meet Minimum Standards |
| JHK | Failure to Maintain Weight Standards |
| JCR | Failure to Complete Course of Instruction |
| JDA | Failure to Adapt |

## 6. Entry-Level & Training Codes

| SPD | Meaning |
|-----|---------|
| JGA | Entry-Level Performance & Conduct |
| JGB | Entry-Level Medical Condition |
| JFC | Entry-Level Physical Standards |
| JFT | Failure to Complete Training |

## 7. Retirement Codes (Non-Medical)

| SPD | Meaning |
|-----|---------|
| RBD | Sufficient Service for Retirement |
| RBE | Early Retirement |
| RBF | Temporary Early Retirement Authority (TERA) |
| RCC | Mandatory Retirement – Age |
| RCD | Mandatory Retirement – Service Limits |

## 8. Other High-Value Codes for VA Claims

| SPD | Meaning |
|-----|---------|
| JCC | Conscientious Objector |
| JDG | Alcohol Rehabilitation Failure |
| JDP | Drug Rehabilitation Failure |
| JDT | Security Reasons |
| JEX | Failure to Meet Commissioning Standards |
| JGH | Pregnancy-Related Separation |
| JHJ | Unsatisfactory Performance |

## 9. Special Handling in Rally Forge

CRSC-Relevant:
- JEB
- JED
- SEJ (if combat-related)
- SFX (if combat-related)

Non-Compensable:
- JEF
- JEN

Misconduct (Eligibility Impact):
- JKA
- JKB
- JKC
- JKQ

## 10. Recommended JSON Mapping

{
  "spdCode": "SEJ",
  "category": "Disability Retirement",
  "subCategory": "Permanent – Enhanced",
  "vaImpact": "Eligible for VA disability compensation",
  "crscEligible": true,
  "notes": "Matches AR 635-40 medical retirement criteria"
}
