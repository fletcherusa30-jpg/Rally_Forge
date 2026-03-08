/**
 * PACT Act (Promise to Address Comprehensive Toxics Act of 2022)
 * Detection and Classification Logic
 * 
 * Identifies conditions eligible for presumptive service connection under PACT Act
 */

/**
 * PACT Act Presumptive Conditions by Category
 */
export const PACT_ACT_CONDITIONS = {
  // Respiratory/Airway Conditions (Burn Pit Exposure)
  respiratory: [
    'asthma',
    'chronic bronchitis',
    'chronic obstructive pulmonary disease',
    'copd',
    'chronic rhinitis',
    'chronic sinusitis',
    'constrictive bronchiolitis',
    'emphysema',
    'granulomatous disease',
    'interstitial lung disease',
    'pleuritis',
    'pulmonary fibrosis',
    'sarcoidosis'
  ],
  
  // Cancers (Toxic Exposure)
  cancers: [
    'brain cancer',
    'gastrointestinal cancer',
    'glioblastoma',
    'head cancer',
    'neck cancer',
    'kidney cancer',
    'lymphoma',
    'lymphatic cancer',
    'melanoma',
    'pancreatic cancer',
    'reproductive cancer',
    'respiratory cancer',
    'lung cancer',
    'bronchus cancer',
    'larynx cancer',
    'trachea cancer'
  ],
  
  // Agent Orange Related (Vietnam Era)
  agentOrange: [
    'al amyloidosis',
    "parkinson's disease",
    'hypothyroidism',
    'bladder cancer',
    'chronic b-cell leukemia',
    "hodgkin's disease",
    'multiple myeloma',
    'non-hodgkin lymphoma',
    'prostate cancer',
    'respiratory cancers',
    'soft tissue sarcoma',
    'peripheral neuropathy',
    'porphyria cutanea tarda',
    'chloracne',
    'type 2 diabetes'
  ],
  
  // Other Toxic Exposures
  other: [
    'chronic fatigue syndrome',
    'fibromyalgia',
    'functional gastrointestinal disorders',
    'gulf war syndrome',
    'undiagnosed illness'
  ]
};

/**
 * Exposure locations that qualify for PACT Act presumptions
 */
export const PACT_ACT_LOCATIONS = {
  // Post-9/11 (Burn Pit Presumption)
  post911: [
    'afghanistan',
    'iraq',
    'kuwait',
    'saudi arabia',
    'bahrain',
    'qatar',
    'united arab emirates',
    'oman',
    'gulf of aden',
    'gulf of oman',
    'waters of persian gulf',
    'arabian sea',
    'red sea',
    'airspace above'
  ],
  
  // Vietnam Era (Agent Orange)
  vietnam: [
    'vietnam',
    'republic of vietnam',
    'thailand',
    'laos',
    'cambodia',
    'guam',
    'american samoa',
    'johnston island'
  ],
  
  // Other Exposures
  other: [
    'camp lejeune',
    'k2 air base',
    'karshi-khanabad'
  ]
};

/**
 * Check if a condition is PACT Act eligible
 * @param {string} condition - The medical condition name
 * @returns {Object} PACT Act eligibility info
 */
export function checkPACTActEligibility(condition) {
  const normalized = condition.toLowerCase().trim();
  
  // Check each category
  for (const [category, conditions] of Object.entries(PACT_ACT_CONDITIONS)) {
    for (const pactCondition of conditions) {
      if (normalized.includes(pactCondition) || pactCondition.includes(normalized)) {
        return {
          isPACTActEligible: true,
          category: category,
          matchedCondition: pactCondition,
          description: getPACTActDescription(category),
          presumptiveFor: getPACTActExposureTypes(category)
        };
      }
    }
  }
  
  return {
    isPACTActEligible: false,
    category: null,
    matchedCondition: null,
    description: null,
    presumptiveFor: []
  };
}

/**
 * Get description for PACT Act category
 * @param {string} category - PACT Act category
 * @returns {string} Description
 */
function getPACTActDescription(category) {
  const descriptions = {
    respiratory: 'PACT Act - Presumptive for burn pit and airborne hazard exposure',
    cancers: 'PACT Act - Presumptive for toxic exposure related cancers',
    agentOrange: 'PACT Act - Presumptive for Agent Orange exposure (Vietnam Era)',
    other: 'PACT Act - Presumptive for Gulf War or other toxic exposures'
  };
  
  return descriptions[category] || 'PACT Act - Presumptive service connection eligible';
}

/**
 * Get exposure types for PACT Act category
 * @param {string} category - PACT Act category
 * @returns {Array<string>} Exposure types
 */
function getPACTActExposureTypes(category) {
  const exposures = {
    respiratory: ['Burn Pits', 'Airborne Hazards', 'Southwest Asia Theater'],
    cancers: ['Toxic Exposure', 'Burn Pits', 'Environmental Hazards'],
    agentOrange: ['Agent Orange', 'Vietnam Service', 'Herbicide Exposure'],
    other: ['Gulf War Syndrome', 'Camp Lejeune Water', 'Undiagnosed Illnesses']
  };
  
  return exposures[category] || [];
}

/**
 * Detect PACT Act mentions in narrative text
 * @param {string} text - VA decision letter text
 * @returns {Object} PACT Act detection results
 */
export function detectPACTActReferences(text) {
  const normalized = text.toLowerCase();
  
  const pactActMentioned = /pact\s+act|promise\s+to\s+address\s+comprehensive\s+toxics/i.test(text);
  const burnPitMentioned = /burn\s+pit|open\s+air\s+burn|airborne\s+hazard/i.test(text);
  const agentOrangeMentioned = /agent\s+orange|herbicide\s+exposure|tactical\s+herbicide/i.test(text);
  const presumptiveMentioned = /presumptive.*service.*connection|presumed.*service.*connected/i.test(text);
  
  // Detect service locations
  const detectedLocations = [];
  for (const [era, locations] of Object.entries(PACT_ACT_LOCATIONS)) {
    for (const location of locations) {
      if (normalized.includes(location)) {
        detectedLocations.push({ location, era });
      }
    }
  }
  
  return {
    pactActMentioned,
    burnPitMentioned,
    agentOrangeMentioned,
    presumptiveMentioned,
    detectedLocations,
    isPACTActRelated: pactActMentioned || burnPitMentioned || agentOrangeMentioned || detectedLocations.length > 0
  };
}

/**
 * Enhance service-connected conditions with PACT Act flags
 * @param {Array} serviceConnectedConditions - List of service-connected conditions
 * @param {string} narrativeText - Full narrative text for context
 * @returns {Array} Enhanced conditions with PACT Act flags
 */
export function enhanceWithPACTActFlags(serviceConnectedConditions, narrativeText = '') {
  const pactActContext = detectPACTActReferences(narrativeText);
  
  return serviceConnectedConditions.map(condition => {
    const pactActCheck = checkPACTActEligibility(condition.condition);
    
    return {
      ...condition,
      pactActEligible: pactActCheck.isPACTActEligible,
      pactActCategory: pactActCheck.category,
      pactActDescription: pactActCheck.description,
      pactActExposureTypes: pactActCheck.presumptiveFor,
      pactActContext: pactActContext.isPACTActRelated ? {
        mentioned: pactActContext.pactActMentioned,
        burnPits: pactActContext.burnPitMentioned,
        agentOrange: pactActContext.agentOrangeMentioned,
        locations: pactActContext.detectedLocations
      } : null
    };
  });
}

/**
 * Generate PACT Act summary for a scan
 * @param {Array} enhancedConditions - Conditions with PACT Act flags
 * @returns {Object} PACT Act summary
 */
export function generatePACTActSummary(enhancedConditions) {
  const pactActConditions = enhancedConditions.filter(c => c.pactActEligible);
  
  const byCategory = pactActConditions.reduce((acc, condition) => {
    const category = condition.pactActCategory;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(condition.condition);
    return acc;
  }, {});
  
  return {
    totalPACTActConditions: pactActConditions.length,
    pactActPercentage: enhancedConditions.length > 0 
      ? Math.round((pactActConditions.length / enhancedConditions.length) * 100)
      : 0,
    byCategory,
    categories: Object.keys(byCategory),
    hasPACTActConditions: pactActConditions.length > 0
  };
}

export default {
  checkPACTActEligibility,
  detectPACTActReferences,
  enhanceWithPACTActFlags,
  generatePACTActSummary,
  PACT_ACT_CONDITIONS,
  PACT_ACT_LOCATIONS
};

