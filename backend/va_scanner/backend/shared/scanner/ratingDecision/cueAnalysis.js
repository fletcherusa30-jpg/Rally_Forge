/**
 * cueAnalysis.js — Rally Forge Rating Decision Scanner v4.2
 *
 * CUE Indicators and Quality-of-Decision analysis module.
 *
 * IMPORTANT LEGAL NOTICE:
 *   This module NEVER declares that a CUE exists.
 *   This module NEVER provides legal advice.
 *   This module NEVER recommends filing a CUE claim or any appeal.
 *   It ONLY identifies textual patterns, inconsistencies, and regulatory
 *   mismatches FOR HUMAN REVIEW.
 *
 * Output is advisory only. All findings require qualified human review.
 */

// ── 1. Textual CUE-Related Phrases ───────────────────────────────────────────

const CUE_TEXTUAL_PHRASES = [
  'clear and unmistakable error',
  'cue',
  'revision based on error',
  'previous decision contained error',
  'error in prior evaluation',
  'incorrect effective date',
  'incorrect diagnostic code',
  'incorrect evaluation',
  'failure to consider evidence',
  'failure to apply regulation',
  'failure to apply presumption',
  'failure to infer claim',
  'failure to address favorable findings',
  'failure to address service connection theory',
  'failure to apply benefit of the doubt',
];

// ── 2. Duty-to-Assist Phrase Indicators ──────────────────────────────────────

const DUTY_TO_ASSIST_PHRASES = [
  'va did not obtain',
  'no exam was provided',
  'no examination was provided',
  'insufficient evidence',
  'records unavailable',
  'records were unavailable',
  'no attempt was made to',
  'no medical opinion was obtained',
  'no nexus opinion was obtained',
  'no independent medical opinion',
];

// ── 3. SMC Indicator Phrases ──────────────────────────────────────────────────

const SMC_INDICATOR_PHRASES = [
  'loss of use',
  'aid and attendance',
  'housebound',
  'bedridden',
  'requires assistance with activities of daily living',
  'paired extremity',
  'requires regular aid',
  'unable to care for',
];

// ── 4. Secondary / Aggravation Phrases ───────────────────────────────────────

const SECONDARY_PHRASES = [
  { pattern: /\bdue to\b/i, label: 'due to' },
  { pattern: /\bcaused by\b/i, label: 'caused by' },
  { pattern: /\bsecondary to\b/i, label: 'secondary to' },
  { pattern: /\bresult of\b/i, label: 'result of' },
  { pattern: /\baggravated by\b/i, label: 'aggravated by' },
  { pattern: /\bproximately due to\b/i, label: 'proximately due to' },
];

// ── 5. Inferred Issue Indicators ──────────────────────────────────────────────

const INFERRED_ISSUE_PHRASES = {
  TDIU: [
    /\bunable to work\b/i,
    /\bunemployability\b/i,
    /\btdiu\b/i,
    /\btotal disability.*unemployability\b/i,
    /\bindividual unemployability\b/i,
  ],
  SMC: [
    /\baid and attendance\b/i,
    /\bhousebound\b/i,
    /\bloss of use\b/i,
    /\bspecial monthly compensation\b/i,
    /\bsmc\b/i,
  ],
  secondary: [
    /\bsecondary to\b/i,
    /\bcausally related\b/i,
    /\bproximate cause\b/i,
  ],
  aggravation: [
    /\baggravated by\b/i,
    /\baggravation of\b/i,
    /\bpermanently aggravated\b/i,
  ],
  chronicity: [
    /\bchronic since\b/i,
    /\bcontinuous since\b/i,
    /\brecurrent\b/i,
    /\bpersistent\b/i,
  ],
};

// ── 6. Favorable Finding Phrases ─────────────────────────────────────────────

const FAVORABLE_FINDING_PHRASES = [
  /\bdiagnosed with\b/i,
  /\bin-service (event|injury|occurrence|onset)\b/i,
  /\bpositive nexus\b/i,
  /\bnexus opinion\b/i,
  /\bfavorable (opinion|finding|evidence|exam)\b/i,
  /\bservice connection is (warranted|established|supported)\b/i,
  /\bthe examiner (opined|stated|found|concluded)\b/i,
  /\bservice (records|treatment records) (confirm|show|document|reflect)\b/i,
];

// ── 7. Benefit-of-Doubt Language ──────────────────────────────────────────────

const BENEFIT_OF_DOUBT_PHRASES = [
  /\bbenefit of the doubt\b/i,
  /\bequipoise\b/i,
  /\breasonable doubt\b/i,
  /\bapproximately equal\b/i,
];

// ── 8. Medical Opinion Inadequacy Phrases ────────────────────────────────────

const MEDICAL_OPINION_ADEQUACY_PHRASES = [
  'speculative',
  'unable to determine',
  'insufficient evidence',
  'no rationale provided',
  'did not review records',
  'without reviewing',
  'cannot be determined',
  'is speculative',
  'inadequate rationale',
];

// ── 9. Section Headers for Structural Parsing ─────────────────────────────────

const SECTION_HEADERS = [
  { key: 'decision', patterns: [/^\s*decision\s*$/im, /\bdecision\b/i] },
  { key: 'reasons', patterns: [/^\s*reasons\s+for\s+decision\s*$/im, /reasons and bases/i, /\breasons\b/i] },
  { key: 'evidence', patterns: [/^\s*evidence\s*$/im, /evidence and findings/i, /evidence considered/i] },
  { key: 'findings', patterns: [/^\s*findings\b/im] },
  { key: 'introduction', patterns: [/^\s*introduction\s*$/im] },
  { key: 'analysis', patterns: [/^\s*analysis\s*$/im] },
];

// ── Helper: extract context snippet around match ──────────────────────────────

function getContextSnippet(text, matchIndex, radius = 120) {
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(text.length, matchIndex + radius);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

// ── Helper: identify which section a text offset belongs to ──────────────────

function identifySection(text, offset) {
  const upper = text.toUpperCase();
  let bestSection = 'unknown';
  let bestIndex = -1;
  for (const sec of SECTION_HEADERS) {
    for (const pat of sec.patterns) {
      const match = pat.exec(text);
      if (match && match.index < offset && match.index > bestIndex) {
        bestIndex = match.index;
        bestSection = sec.key;
      }
    }
  }
  return bestSection;
}

// ── Helper: split text into paragraphs ───────────────────────────────────────

function toParagraphs(text) {
  return String(text || '').split(/\n{2,}/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// ── 1. CUE Textual Flags ──────────────────────────────────────────────────────

export function detectCueTextualFlags(text) {
  const normalized = String(text || '').toLowerCase();
  const flags = [];

  for (const phrase of CUE_TEXTUAL_PHRASES) {
    let searchFrom = 0;
    while (true) {
      const idx = normalized.indexOf(phrase, searchFrom);
      if (idx === -1) break;
      flags.push({
        type: 'cueTextualFlag',
        phrase,
        context: getContextSnippet(text, idx),
        section: identifySection(text, idx),
        confidence: 'low',
        note: 'Textual indicator only. No legal conclusion.',
      });
      searchFrom = idx + phrase.length;
    }
  }

  return flags;
}

// ── 2. Duty-to-Assist Indicators ──────────────────────────────────────────────

export function detectDutyToAssistIndicators(text) {
  const normalized = String(text || '').toLowerCase();
  const flags = [];

  for (const phrase of DUTY_TO_ASSIST_PHRASES) {
    let searchFrom = 0;
    while (true) {
      const idx = normalized.indexOf(phrase, searchFrom);
      if (idx === -1) break;
      flags.push({
        type: 'dutyToAssistIndicator',
        phrase,
        context: getContextSnippet(text, idx),
        section: identifySection(text, idx),
        note: 'Possible duty-to-assist indicator for human review.',
      });
      searchFrom = idx + phrase.length;
    }
  }

  return flags;
}

// ── 3. Evidence Reference Gaps ────────────────────────────────────────────────

const EVIDENCE_REFERENCE_PATTERNS = [
  { pattern: /private\s+medical\s+records?/gi, evidenceType: 'private medical records' },
  { pattern: /c&?p\s+exam\b/gi, evidenceType: 'C&P exam' },
  { pattern: /service\s+treatment\s+records?\b/gi, evidenceType: 'service treatment records' },
  { pattern: /buddy\s+statement\b/gi, evidenceType: 'buddy statement' },
  { pattern: /lay\s+(statement|evidence)\b/gi, evidenceType: 'lay statement' },
  { pattern: /nexus\s+(letter|opinion)\b/gi, evidenceType: 'nexus letter' },
  { pattern: /independent\s+medical\s+(opinion|exam)\b/gi, evidenceType: 'independent medical opinion' },
  { pattern: /va\s+(treatment\s+records?|medical\s+records?)\b/gi, evidenceType: 'VA medical records' },
];

export function detectEvidenceReferenceGaps(text) {
  const paragraphs = toParagraphs(text);
  const gaps = [];

  for (const { pattern, evidenceType } of EVIDENCE_REFERENCE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Check whether the surrounding paragraph discusses the evidence in detail
      const surrounding = getContextSnippet(text, match.index, 300);
      const hasDiscussion = /discussed|summarized|reviewed|dated|showed|revealed|indicated|reported|states|noted/i.test(surrounding);
      if (!hasDiscussion) {
        gaps.push({
          type: 'evidenceReferenceGap',
          evidenceType,
          referenceLocation: identifySection(text, match.index),
          context: getContextSnippet(text, match.index),
          missingDiscussion: true,
          note: 'Evidence referenced but no detailed discussion detected. Human review required.',
        });
      }
    }
  }

  return gaps;
}

// ── 4. SMC Indicators ─────────────────────────────────────────────────────────

export function detectSmcIndicators(text) {
  const normalized = String(text || '').toLowerCase();
  const flags = [];

  // Check whether SMC is discussed in the decision
  const smcDiscussed = /special\s+monthly\s+compensation|38\s+c\.?f\.?r\.?\s+[§§]?\s*3\.350|38\s+c\.?f\.?r\.?\s+[§§]?\s*3\.352/i.test(text);

  for (const phrase of SMC_INDICATOR_PHRASES) {
    let searchFrom = 0;
    while (true) {
      const idx = normalized.indexOf(phrase, searchFrom);
      if (idx === -1) break;
      flags.push({
        type: 'smcIndicator',
        indicatorPhrase: phrase,
        context: getContextSnippet(text, idx),
        section: identifySection(text, idx),
        smcAddressedInDecision: smcDiscussed,
        note: smcDiscussed
          ? 'SMC language present and SMC is discussed in the decision.'
          : 'SMC language present but SMC may not be fully addressed. Human review required.',
      });
      searchFrom = idx + phrase.length;
    }
  }

  return flags;
}

// ── 5. Secondary / Aggravation Indicators ─────────────────────────────────────

export function detectSecondaryOrAggravationIndicators(text) {
  const flags = [];

  for (const { pattern, label } of SECONDARY_PHRASES) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const context = getContextSnippet(text, match.index);
      // Heuristically find condition names around the phrase
      const before = text.slice(Math.max(0, match.index - 80), match.index).trim();
      const after = text.slice(match.index + match[0].length, match.index + match[0].length + 80).trim();
      flags.push({
        type: 'secondaryOrAggravationIndicator',
        phrase: label,
        primaryConditionContext: before,
        secondaryConditionContext: after,
        context,
        section: identifySection(text, match.index),
        note: 'Secondary or aggravation theory language detected. Verify this theory is addressed in Reasons and Bases.',
      });
    }
  }

  return flags;
}

// ── 6. Favorable Finding Gaps ─────────────────────────────────────────────────

export function detectFavorableFindingGaps(text) {
  const gaps = [];
  const reasonsSection = extractSection(text, 'reasons');

  for (const pattern of FAVORABLE_FINDING_PHRASES) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const context = getContextSnippet(text, match.index);
      const findingText = match[0];
      // Check if this finding appears in the Reasons and Bases section
      const inReasons = reasonsSection && reasonsSection.toLowerCase().includes(findingText.toLowerCase().slice(0, 20));
      gaps.push({
        type: 'favorableFindingGap',
        findingSummary: findingText,
        evidenceLocation: identifySection(text, match.index),
        context,
        addressedInReasonsAndBases: !!inReasons,
        note: inReasons
          ? 'Favorable finding appears addressed in Reasons and Bases.'
          : 'Favorable finding detected. Verify it is addressed in Reasons and Bases section.',
      });
    }
  }

  return gaps;
}

// ── 7. Service Connection Theory Gaps ────────────────────────────────────────

export function detectServiceConnectionTheoryGaps(text) {
  const gaps = [];
  const evidencePhrases = {
    direct: /direct service connection|in-service (event|injury|occurrence)/i,
    secondary: /secondary (service connection|to)\b/i,
    presumptive: /presumptive service connection|38 cfr §?\s*3\.30[0-9]/i,
    aggravation: /aggravation of a pre-?existing|aggravated beyond the natural progression/i,
    chronicity: /chronic since|continuous since|chronicity/i,
  };
  const reasonsSection = extractSection(text, 'reasons') || '';

  const theoriesPresentInEvidence = [];
  const theoriesAddressedInDecision = [];

  for (const [theory, pattern] of Object.entries(evidencePhrases)) {
    if (pattern.test(text)) {
      theoriesPresentInEvidence.push(theory);
    }
    if (pattern.test(reasonsSection)) {
      theoriesAddressedInDecision.push(theory);
    }
  }

  const unaddressed = theoriesPresentInEvidence.filter(t => !theoriesAddressedInDecision.includes(t));

  if (unaddressed.length > 0) {
    gaps.push({
      type: 'serviceConnectionTheoryGap',
      theoriesPresentInEvidence,
      theoriesAddressedInDecision,
      unaddressedTheories: unaddressed,
      note: 'One or more service connection theories detected in evidence but not addressed in decision rationale. Human review required.',
    });
  }

  return gaps;
}

// ── 8. Evidence-to-Conclusion Conflicts ──────────────────────────────────────

export function detectEvidenceConclusionConflicts(text) {
  const conflicts = [];

  // Detect positive opinion in evidence section paired with denial outcome
  const positiveOpinionPattern = /positive nexus|nexus is established|adequate nexus|examiner opined.*service connected|opinion supports.*service connection/gi;
  const denialPattern = /service connection for[^.]+is denied|we denied service connection/gi;

  const positiveOpinions = [];
  const denials = [];

  let m;
  positiveOpinionPattern.lastIndex = 0;
  while ((m = positiveOpinionPattern.exec(text)) !== null) {
    positiveOpinions.push({ text: m[0], index: m.index });
  }
  denialPattern.lastIndex = 0;
  while ((m = denialPattern.exec(text)) !== null) {
    denials.push({ text: m[0], index: m.index });
  }

  // Flag any case where a positive opinion exists alongside a denial (rough heuristic)
  if (positiveOpinions.length > 0 && denials.length > 0) {
    conflicts.push({
      type: 'evidenceConclusionConflict',
      evidenceSummarySnippet: positiveOpinions.map(p => getContextSnippet(text, p.index, 80)).join(' | '),
      conclusionSnippet: denials.map(d => getContextSnippet(text, d.index, 80)).join(' | '),
      note: 'Positive nexus or service connection opinion detected alongside a denial. Verify the Reasons and Bases explain this outcome. Human review required.',
    });
  }

  // Detect "no evidence" denial language when evidence is referenced
  const noEvidencePattern = /no evidence of record|no competent evidence|lack of (competent )?evidence/gi;
  const evidenceReferencedPattern = /service treatment records|va treatment records|private medical records|c&p exam|nexus opinion/gi;

  const noEvidenceMatches = [];
  noEvidencePattern.lastIndex = 0;
  while ((m = noEvidencePattern.exec(text)) !== null) {
    noEvidenceMatches.push({ text: m[0], index: m.index });
  }

  if (noEvidenceMatches.length > 0 && evidenceReferencedPattern.test(text)) {
    conflicts.push({
      type: 'evidenceConclusionConflict',
      evidenceSummarySnippet: '"No evidence" language used while evidence references are present.',
      conclusionSnippet: noEvidenceMatches.map(n => getContextSnippet(text, n.index, 80)).join(' | '),
      note: '"No evidence" language detected but evidence references are present in the decision. Human review required.',
    });
  }

  return conflicts;
}

// ── 9. Benefit-of-Doubt Omissions ────────────────────────────────────────────

export function detectBenefitOfDoubtOmissions(text) {
  const omissions = [];
  const hasBodLanguage = BENEFIT_OF_DOUBT_PHRASES.some(p => p.test(text));

  // Check if the decision appears closely contested (competing evidence on both sides)
  const conflictingEvidencePattern = /positive.*negative|negative.*positive|favorable.*unfavorable|unfavorable.*favorable|one examiner.*another examiner|competing opinions/i;
  const hasConflictingEvidence = conflictingEvidencePattern.test(text);

  if (hasConflictingEvidence && !hasBodLanguage) {
    omissions.push({
      type: 'benefitOfDoubtOmission',
      context: 'Conflicting or competing evidence appears present in the decision.',
      bodLanguagePresent: false,
      note: 'Decision appears to involve competing evidence but no benefit-of-the-doubt language was detected. Human review required.',
    });
  }

  return omissions;
}

// ── 10. Reasons and Bases Deficiencies ───────────────────────────────────────

export function detectReasonsAndBasesDeficiencies(text) {
  const deficiencies = [];
  const reasonsSection = extractSection(text, 'reasons');

  if (!reasonsSection || reasonsSection.trim().length < 100) {
    deficiencies.push({
      type: 'reasonsAndBasesDeficiency',
      missingElements: ['reasons and bases section not detected or too brief'],
      section: 'reasons',
      note: 'No substantial Reasons and Bases section detected. Human review required.',
    });
    return deficiencies;
  }

  const missing = [];

  if (!/38\s+c\.?f\.?r\.?|cfr|title\s+38/i.test(reasonsSection)) {
    missing.push('CFR citations');
  }
  if (!/evidence|records|exam|opinion|statement/i.test(reasonsSection)) {
    missing.push('evidence discussion');
  }
  if (!/because|therefore|accordingly|consequently|weight|credibility|probative/i.test(reasonsSection)) {
    missing.push('weighing explanation or rationale');
  }

  if (missing.length > 0) {
    deficiencies.push({
      type: 'reasonsAndBasesDeficiency',
      missingElements: missing,
      section: 'reasons',
      note: 'Possible deficiencies in Reasons and Bases. Human review required.',
    });
  }

  return deficiencies;
}

// ── 11. Medical Opinion Adequacy Indicators ───────────────────────────────────

export function detectMedicalOpinionAdequacyIndicators(text) {
  const normalized = String(text || '').toLowerCase();
  const indicators = [];

  for (const phrase of MEDICAL_OPINION_ADEQUACY_PHRASES) {
    let searchFrom = 0;
    while (true) {
      const idx = normalized.indexOf(phrase, searchFrom);
      if (idx === -1) break;
      indicators.push({
        type: 'medicalOpinionAdequacyIndicator',
        phrase,
        context: getContextSnippet(text, idx),
        section: identifySection(text, idx),
        note: 'Medical opinion adequacy indicator detected. Human review required.',
      });
      searchFrom = idx + phrase.length;
    }
  }

  return indicators;
}

// ── 12. Inferred Issue Indicators ────────────────────────────────────────────

export function detectInferredIssueIndicators(text) {
  const indicators = [];

  for (const [issueType, patterns] of Object.entries(INFERRED_ISSUE_PHRASES)) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        indicators.push({
          type: 'inferredIssueIndicator',
          issueType,
          phrase: match[0],
          context: getContextSnippet(text, match.index),
          section: identifySection(text, match.index),
          note: `${issueType} indicator detected. Verify this issue is addressed in the decision. Human review required.`,
        });
      }
    }
  }

  return indicators;
}

// ── 13. Regulatory Citation Gaps ──────────────────────────────────────────────

export function detectRegulatoryCitationGaps(text) {
  const gaps = [];
  const reasonsSection = extractSection(text, 'reasons') || text;

  const expectedCitations = [
    { label: 'evaluation/rating criteria (38 CFR § 4.x)', pattern: /38\s+c\.?f\.?r\.?\s+[§§]?\s*4\.\d+/i },
    { label: 'service connection (38 CFR § 3.303 or §3.304)', pattern: /38\s+c\.?f\.?r\.?\s+[§§]?\s*3\.30[34]/i },
    { label: 'effective date regulation (38 CFR § 3.400)', pattern: /38\s+c\.?f\.?r\.?\s+[§§]?\s*3\.4\d\d/i },
  ];

  // Only flag if there are substantive decisions (not just procedural letters)
  const hasDecisionContent = /service connection|evaluation|percent/i.test(text);
  if (!hasDecisionContent) return gaps;

  for (const { label, pattern } of expectedCitations) {
    if (!pattern.test(reasonsSection)) {
      gaps.push({
        type: 'regulatoryCitationGap',
        missingCitation: label,
        section: 'reasons',
        note: `Expected regulatory citation (${label}) not detected in Reasons and Bases. Human review required.`,
      });
    }
  }

  return gaps;
}

// ── 14. Combined Rating Math Verification ─────────────────────────────────────

/**
 * Recalculates CFR § 4.25 combined rating from individual ratings.
 * @param {number[]} ratings - Array of individual disability percentages (0–100).
 * @returns {{ computed: number, rounded: number }}
 */
export function computeCombinedRating(ratings) {
  const sorted = [...ratings].filter(r => r > 0 && r <= 100).sort((a, b) => b - a);
  if (sorted.length === 0) return { computed: 0, rounded: 0 };

  let wholePerson = 100;
  for (const r of sorted) {
    wholePerson = wholePerson * (1 - r / 100);
  }
  const disabilityFactor = 100 - wholePerson;
  const rounded = Math.round(disabilityFactor / 10) * 10;
  return { computed: Math.round(disabilityFactor), rounded };
}

export function detectCombinedRatingDiscrepancies(text, serviceConnectedConditions = []) {
  const discrepancies = [];

  // Extract stated combined rating from text
  const combinedMatch = text.match(/combined\b[^%\d]*(\d{1,3})\s*(?:%|percent)/i);
  if (!combinedMatch) return discrepancies;

  const statedCombinedRating = parseInt(combinedMatch[1], 10);
  const ratings = serviceConnectedConditions
    .map(c => parseInt(c.percentage || c.evaluationPercent || c.rating || 0, 10))
    .filter(r => r > 0);

  if (ratings.length === 0) return discrepancies;

  const { rounded: computedCombinedRating } = computeCombinedRating(ratings);
  const delta = Math.abs(statedCombinedRating - computedCombinedRating);

  if (delta > 0) {
    discrepancies.push({
      type: 'combinedRatingDiscrepancy',
      statedCombinedRating,
      computedCombinedRating,
      delta,
      individualRatingsUsed: ratings,
      note: `Computed under 38 CFR § 4.25. Delta: ${delta}%. Bilateral factor (§ 4.26) may explain differences. Human review required.`,
    });
  }

  return discrepancies;
}

// ── 15. Effective Date Inconsistencies ────────────────────────────────────────

export function detectEffectiveDateInconsistencies(text, serviceConnectedConditions = []) {
  const inconsistencies = [];

  // Extract claim date
  const claimDateMatch = text.match(/date\s+of\s+claim[:\s]+([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  const claimDate = claimDateMatch ? claimDateMatch[1] : null;

  for (const cond of serviceConnectedConditions) {
    const effectiveDate = cond.effective_date || cond.effectiveDate;
    if (!effectiveDate || !claimDate) continue;

    // Simple string comparison heuristic — full date parsing would need a date library
    const note = `Effective date: ${effectiveDate}, Claim date: ${claimDate}. Verify adherence to 38 CFR § 3.400.`;
    inconsistencies.push({
      type: 'effectiveDateInconsistency',
      condition: cond.condition || cond.name || 'Unknown',
      effectiveDate,
      claimDate,
      note,
    });
  }

  return inconsistencies;
}

// ── Helper: Extract a Named Section from Text ─────────────────────────────────

function extractSection(text, sectionKey) {
  const sectionDef = SECTION_HEADERS.find(s => s.key === sectionKey);
  if (!sectionDef) return null;

  let startIndex = -1;
  for (const pat of sectionDef.patterns) {
    const m = pat.exec(text);
    if (m) { startIndex = m.index; break; }
  }
  if (startIndex === -1) return null;

  // Find the next section header after startIndex
  let endIndex = text.length;
  for (const sec of SECTION_HEADERS) {
    if (sec.key === sectionKey) continue;
    for (const pat of sec.patterns) {
      const m = pat.exec(text);
      if (m && m.index > startIndex && m.index < endIndex) {
        endIndex = m.index;
      }
    }
  }

  return text.slice(startIndex, endIndex).trim();
}

// ── Main: Run All Quality & CUE Analysis ─────────────────────────────────────

/**
 * Run full CUE and quality-of-decision indicator analysis.
 *
 * @param {string} text - Full text of the rating decision.
 * @param {Object} options
 * @param {Array} [options.serviceConnectedConditions] - Parsed SC conditions from vaDecisionScanner.
 * @returns {Object} qualityAndCueIndicators
 */
export function analyzeDecisionQuality(text, { serviceConnectedConditions = [] } = {}) {
  if (!text || typeof text !== 'string' || text.trim().length < 50) {
    return buildEmptyQualityOutput();
  }

  return {
    cueTextualFlags: detectCueTextualFlags(text),
    dutyToAssistIndicators: detectDutyToAssistIndicators(text),
    evidenceReferenceGaps: detectEvidenceReferenceGaps(text),
    diagnosticCodeMismatches: [], // requires external CFR Part 4 mapping — populated by qualityIndicators.js
    combinedRatingDiscrepancies: detectCombinedRatingDiscrepancies(text, serviceConnectedConditions),
    effectiveDateInconsistencies: detectEffectiveDateInconsistencies(text, serviceConnectedConditions),
    smcIndicators: detectSmcIndicators(text),
    secondaryOrAggravationIndicators: detectSecondaryOrAggravationIndicators(text),
    favorableFindingGaps: detectFavorableFindingGaps(text),
    serviceConnectionTheoryGaps: detectServiceConnectionTheoryGaps(text),
    evidenceConclusionConflicts: detectEvidenceConclusionConflicts(text),
    benefitOfDoubtOmissions: detectBenefitOfDoubtOmissions(text),
    reasonsAndBasesDeficiencies: detectReasonsAndBasesDeficiencies(text),
    medicalOpinionAdequacyIndicators: detectMedicalOpinionAdequacyIndicators(text),
    inferredIssueIndicators: detectInferredIssueIndicators(text),
    regulatoryCitationGaps: detectRegulatoryCitationGaps(text),
    notes: 'For human review only. No legal conclusions. This module does not assert that any error, CUE, or appealable issue exists.',
  };
}

function buildEmptyQualityOutput() {
  return {
    cueTextualFlags: [],
    dutyToAssistIndicators: [],
    evidenceReferenceGaps: [],
    diagnosticCodeMismatches: [],
    combinedRatingDiscrepancies: [],
    effectiveDateInconsistencies: [],
    smcIndicators: [],
    secondaryOrAggravationIndicators: [],
    favorableFindingGaps: [],
    serviceConnectionTheoryGaps: [],
    evidenceConclusionConflicts: [],
    benefitOfDoubtOmissions: [],
    reasonsAndBasesDeficiencies: [],
    medicalOpinionAdequacyIndicators: [],
    inferredIssueIndicators: [],
    regulatoryCitationGaps: [],
    notes: 'For human review only. No legal conclusions.',
  };
}

export { extractSection };
export default analyzeDecisionQuality;
