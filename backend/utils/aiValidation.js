/**
 * AI Validation Utility
 * Tests that the AI system can identify all 6 alternate theories of entitlement
 */

/**
 * The 6 core alternate theories that should be identified
 */
const ALTERNATE_THEORIES = {
  presumptive: {
    name: 'Presumptive Conditions',
    cfrSection: '38 CFR §3.309',
    keywords: ['presumptive', 'agent orange', 'radiation', 'mustard gas', 'combat-related', 'environmental hazard'],
    examples: [
      '38 CFR §3.309(e) - Agent Orange presumptions',
      '38 CFR §3.309(j) - Combat-related presumptions'
    ]
  },
  secondary: {
    name: 'Secondary Service Connection',
    cfrSection: '38 CFR §3.310',
    keywords: ['secondary', 'caused by', 'aggravated by', 'medical nexus', 'related to service-connected'],
    examples: [
      'Condition caused by service-connected disability',
      'Related to original service-connected condition'
    ]
  },
  aggravation: {
    name: 'Aggravation of Pre-Existing Condition',
    cfrSection: '38 CFR §3.306',
    keywords: ['aggravation', 'worsened', 'deteriorated', 'pre-existing', 'service-connected increase'],
    examples: [
      'Pre-existing condition materially worsened by service',
      'Changes from stable to compensable rating'
    ]
  },
  direct: {
    name: 'Direct Service Connection',
    cfrSection: '38 CFR §3.303',
    keywords: ['direct', 'in-service event', 'incident', 'documented', 'current evidence', 'nexus'],
    examples: [
      'In-service event, current medical evidence, and medical nexus',
      'Combat veteran presumption of credibility'
    ]
  },
  presumptionSoundness: {
    name: 'Presumption of Soundness',
    cfrSection: '38 CFR §3.103',
    keywords: ['presumption of soundness', 'sound at entry', 'not noted at entrance'],
    examples: [
      'Condition not noted at entrance but developed during service',
      'Presumed sound at beginning of service'
    ]
  },
  changeInLaw: {
    name: 'Change in Law',
    cfrSection: 'Regulatory Changes',
    keywords: ['new law', 'reclassified', 'change in regulation', 'recent decision'],
    examples: [
      'Conditions reclassified as presumptive',
      'New interpretations of existing regulations'
    ]
  }
};

/**
 * Validate an AI analysis response to ensure it includes all applicable theories
 * Returns: { isComplete: boolean, missingTheories: [], extraTheories: [], score: number }
 */
export function validateAnalysisCompleteness(analysis, applicableTheories = null) {
  const results = {
    isComplete: false,
    theoriesFound: [],
    theoriesMissing: [],
    appliedTheories: applicableTheories || Object.keys(ALTERNATE_THEORIES),
    score: 0,
    details: {}
  };

  if (!analysis || !analysis.alternateTheories) {
    results.score = 0;
    results.theoriesMissing = results.appliedTheories;
    return results;
  }

  const alternateTheories = analysis.alternateTheories || [];
  const cfrSectionsFound = new Set();
  
  // Collect all CFR sections mentioned
  alternateTheories.forEach(theory => {
    if (theory.cfrSections) {
      theory.cfrSections.forEach(section => {
        const match = section.match(/38 CFR §[\d.]+/);
        if (match) cfrSectionsFound.add(match[0]);
      });
    }
  });

  // Check which theories were identified
  Object.entries(ALTERNATE_THEORIES).forEach(([key, theory]) => {
    const theoryMentioned = alternateTheories.some(
      alt => alt.name?.toLowerCase().includes(theory.name.toLowerCase()) ||
              alt.cfrSections?.some(s => s.includes(theory.cfrSection))
    );

    if (theoryMentioned) {
      results.theoriesFound.push(key);
      results.details[key] = { identified: true };
    } else if (results.appliedTheories.includes(key)) {
      results.theoriesMissing.push(key);
      results.details[key] = { identified: false, reason: 'Not found in response' };
    }
  });

  // Calculate completeness score
  const expectedCount = results.appliedTheories.length;
  const foundCount = results.theoriesFound.filter((theory) =>
    results.appliedTheories.includes(theory)
  ).length;
  const rawScore = expectedCount > 0 ? Math.round((foundCount / expectedCount) * 100) : 0;
  results.score = Math.min(100, Math.max(0, rawScore));
  results.isComplete = results.theoriesMissing.length === 0;

  // Validation metrics
  results.metrics = {
    cfrSectionsCited: cfrSectionsFound.size,
    theoriesWithMedicalNexus: alternateTheories.filter(t => t.medical_nexus).length,
    theoriesWithEvidence: alternateTheories.filter(t => t.evidence_required?.length > 0).length,
    theoriesWithFeasibility: alternateTheories.filter(t => t.feasibility).length,
    hasMostPromisingTheory: !!analysis.most_promising_theory,
    hasActionItems: Array.isArray(analysis.action_items) && analysis.action_items.length > 0
  };

  return results;
}

/**
 * Get test conditions that should trigger each theory identification
 */
export function getTestConditions() {
  return [
    {
      name: 'Agent Orange Exposure',
      description: 'Vietnam veteran with diabetes - should trigger presumptive theory',
      condition: 'Type 2 Diabetes - Vietnam veteran with possible Agent Orange exposure',
      expectedTheories: ['presumptive', 'secondary', 'direct']
    },
    {
      name: 'Radiation Exposure',
      description: 'Nuclear test participant with cancer',
      condition: 'Prostate cancer - Atomic test veteran with radiation exposure history',
      expectedTheories: ['presumptive', 'direct']
    },
    {
      name: 'Service-Connected Aggravation',
      description: 'Pre-existing condition worsened by service',
      condition: 'Knee arthritis - Pre-existing condition from high school sports worsened by military service marching and training',
      expectedTheories: ['aggravation', 'direct', 'presumptionSoundness']
    },
    {
      name: 'Combat-Related PTSD',
      description: 'Combat veteran with mental health condition',
      condition: 'Anxiety Disorder - Combat veteran in Middle East conflict',
      expectedTheories: ['direct', 'combatVeteran', 'presumptive']
    },
    {
      name: 'Secondary to Service-Connected',
      description: 'Condition secondary to granted disability',
      condition: 'Sleep Apnea - Secondary to service-connected PTSD',
      expectedTheories: ['secondary', 'direct']
    },
    {
      name: 'Burn Pit Exposure',
      description: 'Presumptive condition from burn pit exposure',
      condition: 'Respiratory disease - Iraq/Afghanistan veteran with burn pit exposure',
      expectedTheories: ['presumptive', 'direct', 'secondary']
    }
  ];
}

/**
 * Generate a validation report from an analysis
 */
export function generateValidationReport(condition, analysis, applicableTheories = null) {
  const validation = validateAnalysisCompleteness(analysis, applicableTheories);

  return {
    condition,
    timestamp: new Date().toISOString(),
    validation: {
      completeness: `${validation.score}% (${validation.theoriesFound.length}/${validation.appliedTheories.length} theories found)`,
      isComplete: validation.isComplete,
      theoriesFound: validation.theoriesFound.map(t => ALTERNATE_THEORIES[t].name),
      theoriesMissing: validation.theoriesMissing.map(t => ALTERNATE_THEORIES[t].name)
    },
    qualityMetrics: validation.metrics,
    analysis: {
      hasAlternateTheories: Array.isArray(analysis?.alternateTheories) && analysis.alternateTheories.length > 0,
      theoryCount: analysis?.alternateTheories?.length || 0,
      hasMostPromisingTheory: !!analysis?.most_promising_theory,
      hasRelatedConditions: Array.isArray(analysis?.related_conditions) && analysis.related_conditions.length > 0,
      hasActionItems: Array.isArray(analysis?.action_items) && analysis.action_items.length > 0,
      hasSuccessLikelihood: !!analysis?.success_likelihood
    },
    recommendations: generateRecommendations(validation, analysis)
  };
}

/**
 * Generate improvement recommendations
 */
function generateRecommendations(validation, analysis) {
  const recommendations = [];

  if (validation.score < 100) {
    recommendations.push({
      type: 'MISSING_THEORIES',
      severity: 'HIGH',
      message: `Missing ${validation.theoriesMissing.length} theory/theories: ${validation.theoriesMissing.map(t => ALTERNATE_THEORIES[t].name).join(', ')}`,
      action: 'Ensure all 6 alternate theories are evaluated in the prompt'
    });
  }

  if (!validation.metrics.hasMostPromisingTheory) {
    recommendations.push({
      type: 'MISSING_FIELD',
      severity: 'MEDIUM',
      message: 'Missing "most_promising_theory" field',
      action: 'Include identification of single most viable theory'
    });
  }

  if (validation.metrics.theoriesWithMedicalNexus < analysis?.alternateTheories?.length) {
    recommendations.push({
      type: 'INCOMPLETE_DETAIL',
      severity: 'MEDIUM',
      message: 'Not all theories have medical_nexus field populated',
      action: 'Ensure each theory includes medical nexus requirements'
    });
  }

  if (validation.metrics.cfrSectionsCited < 3) {
    recommendations.push({
      type: 'LIMITED_CFR',
      severity: 'MEDIUM',
      message: 'Few CFR sections cited - only found ' + validation.metrics.cfrSectionsCited,
      action: 'Include specific CFR section numbers for each theory'
    });
  }

  if (!validation.metrics.hasActionItems) {
    recommendations.push({
      type: 'MISSING_GUIDANCE',
      severity: 'LOW',
      message: 'No action items provided',
      action: 'Include specific steps the veteran should take'
    });
  }

  return recommendations;
}

/**
 * Check if a theory is applicable to a condition based on keywords
 */
export function isTheoryApplicable(condition, theoryKey) {
  const theory = ALTERNATE_THEORIES[theoryKey];
  if (!theory) return false;

  const lowerCondition = condition.toLowerCase();
  return theory.keywords.some(keyword => lowerCondition.includes(keyword.toLowerCase()));
}

/**
 * Get applicable theories for a condition
 */
export function getApplicableTheories(condition) {
  return Object.keys(ALTERNATE_THEORIES).filter(key => isTheoryApplicable(condition, key));
}

export default {
  ALTERNATE_THEORIES,
  validateAnalysisCompleteness,
  getTestConditions,
  generateValidationReport,
  getApplicableTheories,
  isTheoryApplicable
};

