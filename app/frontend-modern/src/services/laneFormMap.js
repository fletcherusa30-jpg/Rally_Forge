// VA filing lane → form numbers and action tips.
// Extracted from CaseSummaryPage so both the Case Summary
// and Analyzer tabs can use the same authoritative mapping.

export const LANE_FORM_MAP = {
  'Direct service connection': {
    forms: ['VA Form 21-526EZ (Disability Compensation)'],
    tip: 'Check "New claim" on 21-526EZ. Attach STR entries and a current diagnosis. A nexus letter from a licensed provider strengthens the link.',
  },
  'Supplemental claim': {
    forms: ['VA Form 20-0995 (Supplemental Claim)'],
    tip: 'Attach new and relevant evidence not submitted in the prior decision. Buddy statements, private medical opinions, or newly received STR pages qualify.',
  },
  'Increase or secondary review': {
    forms: ['VA Form 21-526EZ (check "Increased evaluation" box)', 'VA Form 21-0781 if PTSD-related'],
    tip: 'Document worsening symptoms, more frequent treatment, or functional impairment. For secondary conditions, establish the link to the already-rated condition.',
  },
  'Secondary service connection': {
    forms: ['VA Form 21-526EZ (identify as secondary condition)', 'VA Form 21-4138 statement in support (optional)'],
    tip: 'Identify the primary service-connected condition and include medical evidence stating the secondary condition is caused or aggravated by that primary condition.',
  },
  'Presumptive pathway review': {
    forms: ['VA Form 21-526EZ (PACT Act / toxic exposure section)'],
    tip: 'Document all deployment locations and dates. The PACT Act expanded presumptive eligibility for burn pit, Agent Orange, and radiation exposures.',
  },
  'Current diagnosis, linkage needed': {
    forms: ['VA Form 21-526EZ', '(nexus letter required from treating provider)'],
    tip: 'The current diagnosis is present but a medical nexus to service is missing. Obtain a DBQ or nexus letter from a licensed provider who can state the opinion to the required legal standard.',
  },
  'In-service evidence, current diagnosis needed': {
    forms: ['VA Form 21-526EZ', '(current medical evidence required)'],
    tip: 'Service records show an in-service event or injury, but current disability has not been documented. Schedule a private evaluation or obtain recent treatment notes.',
  },
  'Develop evidence': {
    forms: ['VA Form 21-526EZ (when ready)'],
    tip: 'Additional evidence development is required before filing. Gather current treatment records, STR entries, and consider a nexus opinion before submission.',
  },
};

export function getLaneRecommendation(lane) {
  return LANE_FORM_MAP[lane] || LANE_FORM_MAP['Develop evidence'];
}
