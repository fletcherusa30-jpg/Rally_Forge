# Labels & Placeholders Inventory

Generated: 2026-03-22

Scope:
- Explicit `placeholder` values on inputs and textareas
- User-facing placeholder option text in selects where it is used as the empty/default choice
- Technical placeholder configuration values in design-mode code
- Excludes tests, comments, and CSS `::placeholder` styling rules

## app/frontend-modern/src/components/ai/PromptInput.jsx

| Label / Field | Placeholder |
| --- | --- |
| Prompt textarea | `Enter your prompt` |

## app/frontend-modern/src/components/conditions/ManualConditionEntry.jsx

| Label / Field | Placeholder |
| --- | --- |
| Rating Decision Date (optional) | `When was the decision made?` |
| Rating % (optional) | `Select %` |
| Disability * | `e.g., Tinnitus, PTSD, Lower back pain` |

## app/frontend-modern/src/components/financial/BudgetPlanner.jsx

| Label / Field | Placeholder |
| --- | --- |
| Numeric amount entry | `Enter amount (e.g. 125000)` |
| Manual slider entry | `0` |

## app/frontend-modern/src/components/financial/RetirementPlanner.jsx

| Label / Field | Placeholder |
| --- | --- |
| Manual slider entry | `0` |

## app/frontend-modern/src/components/STRManualEntry.jsx

| Label / Field | Placeholder |
| --- | --- |
| Condition Name * | `e.g., Knee injury, Dermatitis, Respiratory symptoms` |
| Location (optional) | `e.g., Camp Lejeune, Kuwait` |
| Provider Name (optional) | `e.g., Dr. Smith, VA Hospital` |
| Description of Event/Treatment * | `Detailed description of what happened, symptoms, or treatment provided` |
| Chronicity Evidence (optional) | `Evidence of continuous or recurrent symptoms, hospitalizations, or ongoing treatment` |
| Continuity Notes * | `How symptoms have persisted or evolved over time` |
| Nexus Indicators (optional) | `Evidence establishing nexus between service and current condition` |

## app/frontend-modern/src/components/treatment/CurrentTreatmentManualEntry.jsx

| Label / Field | Placeholder |
| --- | --- |
| Medications | `Comma-separated` |

## app/frontend-modern/src/components/va/VARatingDecisionManualEntry.jsx

| Label / Field | Placeholder |
| --- | --- |
| Condition Name * | `e.g., Tinnitus, PTSD, Left knee` |
| Page Number (optional) | `e.g., 12` |
| Rating % * | `Select...` |
| Denial Reason * | `Explain why this condition was denied` |
| Primary Condition * | `e.g., Agent Orange exposure` |
| Aggravation % * | `Select...` |
| Extremity * | `Select...` |
| Evidence Notes (optional) | `Cite specific evidence, test results, or medical findings` |
| Rationale Summary (optional) | `Explain the adjudicative rationale` |
| SC Evidence Details (optional) | `Evidence supporting service-connection` |

## app/frontend-modern/src/components/profile/ProfilePage.jsx

| Label / Field | Placeholder |
| --- | --- |
| First Name | `John` |
| Middle Name | `M.` |
| Last Name | `Doe` |
| Last 4 of SSN | `XXXX` |
| Email | `you@example.com` |
| Phone | `(555) 000-0000` |
| City | `City` |
| State | `Select state...` |
| Preferred Contact Method | `Select contact method...` |

## app/frontend-modern/src/pages/KnowledgeBasePage.jsx

| Label / Field | Placeholder |
| --- | --- |
| Research Context (optional) | `Add internal context to the simulated request` |
| Knowledge base search | `Search regulations, conditions, or cases...` |
| Case filter | `Filter cases…` |

## app/frontend-modern/src/tabs/military-service/MilitaryServiceTab.jsx

| Label / Field | Placeholder |
| --- | --- |
| Additional MOS tenure years | `Years (optional)` |
| Additional MOS tenure months | `Months (optional)` |
| Deployment location draft | `deploymentLocations[] entry` |
| Hazard pay indicator draft | `Add hazard pay indicator` |

## app/frontend-modern/src/tabs/current-treatment/CurrentTreatmentTab.jsx

| Label / Field | Placeholder |
| --- | --- |
| Medication Name * | `e.g., Sertraline` |
| Dosage * | `e.g., 50mg daily` |
| Side Effects | `Optional` |
| Condition Name * | `e.g., PTSD, Lumbar strain, Tinnitus` |
| Symptom Summary * | `Describe current symptoms and functional impact` |
| Provider Name | `e.g., Dr. Smith` |
| Provider Type | `e.g., Psychiatrist` |
| Treatment Details | `Describe current treatment plan, therapies, procedures` |

## app/frontend-modern/src/tabs/claim-generator-summary/ExposureScenarioWizard.jsx

| Label / Field | Placeholder |
| --- | --- |
| Additional details | `Add details (optional)…` |

## app/frontend-modern/src/services/professionalSearch/claudeDesignMode.js

| Key | Placeholder Value |
| --- | --- |
| `placeholderApiUrl` | `https://api.anthropic.example/v1/messages` |
| `placeholderApiKey` | `ANTHROPIC_API_KEY_PLACEHOLDER` |

## Quick Totals

| Category | Count |
| --- | --- |
| UI placeholder strings | 50 |
| Technical placeholder config values | 2 |
| Total inventoried placeholders | 52 |