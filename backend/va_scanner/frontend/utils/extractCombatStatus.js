/**
 * extractCombatStatus.js
 * 
 * Extracts combat status, service branch, and CRSC eligibility indicators
 * from VA Rating Decision text.
 * 
 * Combat status is critical for:
 * - CRSC (Combat-Related Special Compensation) eligibility
 * - Presumptive condition qualification (PACT Act, Agent Orange, Gulf War)
 * - Tax treatment of benefits
 * 
 * Extracted Fields:
 * - combatStatus: war era/conflict period
 * - serviceBranch: military branch
 * - serviceStartDate / serviceEndDate
 * - combatAwards: Purple Heart, CIB, CAR, etc.
 * - crscEligible: inferred from awards/combat indicators
 * - presumptiveEligible: inferred from service era/locations
 * - deploymentLocations: extracted theater locations
 * 
 * Author: Rally Forge Scanner Enhancement - March 2026
 */

/**
 * Extract combat and service status information
 * @param {string} normalizedText - Preprocessed decision text
 * @returns {Object} Combat/service status details
 */
export function extractCombatStatus(normalizedText) {
  const result = {
    combatStatus: null,
    serviceBranch: null,
    serviceStartDate: null,
    serviceEndDate: null,
    combatAwards: [],
    deploymentLocations: [],
    crscEligible: false,
    presumptiveEligible: false,
    presumptiveCategories: [],
    confidence: {
      combatStatus: 0,
      serviceBranch: 0,
      crscEligibility: 0,
      overall: 0
    }
  };

  // Extract service branch
  const branchData = extractServiceBranch(normalizedText);
  result.serviceBranch = branchData.branch;
  result.confidence.serviceBranch = branchData.confidence;

  // Extract service dates
  const serviceDates = extractServiceDates(normalizedText);
  result.serviceStartDate = serviceDates.startDate;
  result.serviceEndDate = serviceDates.endDate;

  // Extract combat awards
  result.combatAwards = extractCombatAwards(normalizedText);

  // Extract deployment locations
  result.deploymentLocations = extractDeploymentLocations(normalizedText);

  // Determine combat status era
  const combatEra = determineCombatEra(normalizedText, serviceDates, result.deploymentLocations);
  result.combatStatus = combatEra.era;
  result.confidence.combatStatus = combatEra.confidence;

  // CRSC eligibility assessment
  const crscAssessment = assessCRSCEligibility(result);
  result.crscEligible = crscAssessment.eligible;
  result.confidence.crscEligibility = crscAssessment.confidence;

  // Presumptive eligibility assessment
  const presumptiveAssessment = assessPresumptiveEligibility(result, normalizedText);
  result.presumptiveEligible = presumptiveAssessment.eligible;
  result.presumptiveCategories = presumptiveAssessment.categories;

  // Overall confidence
  const confidenceValues = [
    result.confidence.combatStatus,
    result.confidence.serviceBranch,
    result.confidence.crscEligibility
  ].filter(v => v > 0);
  
  result.confidence.overall = confidenceValues.length > 0
    ? Math.round(confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length)
    : 0;

  return result;
}

/**
 * Extract military service branch
 */
function extractServiceBranch(text) {
  const branchPatterns = [
    { pattern: /\b(?:U\.?S\.?\s+)?Army\b/i, branch: 'Army', confidence: 95 },
    { pattern: /\b(?:U\.?S\.?\s+)?Navy\b/i, branch: 'Navy', confidence: 95 },
    { pattern: /\b(?:U\.?S\.?\s+)?Marine\s+Corps\b/i, branch: 'Marine Corps', confidence: 95 },
    { pattern: /\b(?:U\.?S\.?\s+)?Air\s+Force\b/i, branch: 'Air Force', confidence: 95 },
    { pattern: /\b(?:U\.?S\.?\s+)?Coast\s+Guard\b/i, branch: 'Coast Guard', confidence: 95 },
    { pattern: /\bSpace\s+Force\b/i, branch: 'Space Force', confidence: 90 },
    // Legacy branches for older veterans
    { pattern: /\bArmy\s+Air\s+Corps\b/i, branch: 'Army Air Corps', confidence: 90 }
  ];

  for (const { pattern, branch, confidence } of branchPatterns) {
    if (pattern.test(text)) {
      return { branch, confidence };
    }
  }

  return { branch: null, confidence: 0 };
}

/**
 * Extract military service dates
 */
function extractServiceDates(text) {
  const result = {
    startDate: null,
    endDate: null
  };

  const patterns = [
    // "served from January 1, 2000 to December 31, 2004"
    /served\s+from\s+(\w+\s+\d{1,2},?\s+\d{4})\s+to\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
    
    // "service dates: 01/01/2000 - 12/31/2004"
    /service\s+dates?\s*[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    
    // "active duty from..."
    /active\s+duty\s+from\s+(\w+\s+\d{1,2},?\s+\d{4})\s+to\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
    
    // "period of service: ..."
    /period\s+of\s+service\s*[:\s]+(\w+\s+\d{1,2},?\s+\d{4})\s+(?:through|to|-)\s+(\w+\s+\d{1,2},?\s+\d{4})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      result.startDate = match[1];
      result.endDate = match[2];
      break;
    }
  }

  return result;
}

/**
 * Extract combat-related awards/decorations
 */
function extractCombatAwards(text) {
  const awards = [];

  const awardPatterns = [
    { pattern: /\bPurple\s+Heart\b/i, award: 'Purple Heart' },
    { pattern: /\bCombat\s+Infantryman\s+Badge\b|\bCIB\b/i, award: 'Combat Infantryman Badge' },
    { pattern: /\bCombat\s+Action\s+Ribbon\b|\bCAR\b/i, award: 'Combat Action Ribbon' },
    { pattern: /\bCombat\s+Action\s+Badge\b|\bCAB\b/i, award: 'Combat Action Badge' },
    { pattern: /\bBronze\s+Star\b.*?(?:V-device|valor|"V")/i, award: 'Bronze Star with Valor' },
    { pattern: /\bSilver\s+Star\b/i, award: 'Silver Star' },
    { pattern: /\bDistinguished\s+Service\s+Cross\b/i, award: 'Distinguished Service Cross' },
    { pattern: /\bNavy\s+Cross\b/i, award: 'Navy Cross' },
    { pattern: /\bAir\s+Force\s+Cross\b/i, award: 'Air Force Cross' },
    { pattern: /\bMedal\s+of\s+Honor\b/i, award: 'Medal of Honor' },
    { pattern: /\bCombat\s+Medical\s+Badge\b|\bCMB\b/i, award: 'Combat Medical Badge' },
    { pattern: /\bCombat\s+Distinguishing\s+Device\b/i, award: 'Combat Distinguishing Device' }
  ];

  for (const { pattern, award } of awardPatterns) {
    if (pattern.test(text)) {
      awards.push(award);
    }
  }

  return awards;
}

/**
 * Extract deployment locations (combat theaters)
 */
function extractDeploymentLocations(text) {
  const locations = [];

  const locationPatterns = [
    // Vietnam theater
    { pattern: /\bVietnam\b/i, location: 'Vietnam' },
    { pattern: /\bThailand\b/i, location: 'Thailand' },
    { pattern: /\bKorean\s+DMZ\b|\bKorea\b/i, location: 'Korean DMZ' },
    
    // Gulf War / OIF / OEF
    { pattern: /\bIraq\b/i, location: 'Iraq' },
    { pattern: /\bAfghanistan\b/i, location: 'Afghanistan' },
    { pattern: /\bKuwait\b/i, location: 'Kuwait' },
    { pattern: /\bSaudi\s+Arabia\b/i, location: 'Saudi Arabia' },
    { pattern: /\bQatar\b/i, location: 'Qatar' },
    { pattern: /\bBahrain\b/i, location: 'Bahrain' },
    { pattern: /\bPersian\s+Gulf\b/i, location: 'Persian Gulf' },
    { pattern: /\bSouthwest\s+Asia\b/i, location: 'Southwest Asia' },
    
    // Burn pit / PACT Act locations
    { pattern: /\bDjibouti\b/i, location: 'Djibouti' },
    { pattern: /\bSyria\b/i, location: 'Syria' },
    { pattern: /\bUzbekistan\b/i, location: 'Uzbekistan' },
    
    // Other combat zones
    { pattern: /\bLebanon\b/i, location: 'Lebanon' },
    { pattern: /\bGrenada\b/i, location: 'Grenada' },
    { pattern: /\bPanama\b/i, location: 'Panama' },
    { pattern: /\bSomalia\b/i, location: 'Somalia' }
  ];

  for (const { pattern, location } of locationPatterns) {
    if (pattern.test(text)) {
      locations.push(location);
    }
  }

  return [...new Set(locations)]; // Remove duplicates
}

/**
 * Determine combat era/status from dates and locations
 */
function determineCombatEra(text, serviceDates, locations) {
  // Check explicit era mentions first
  const eraPatterns = [
    { pattern: /\bVietnam\s+Era\b/i, era: 'Vietnam Era', confidence: 95 },
    { pattern: /\bGulf\s+War\b/i, era: 'Gulf War', confidence: 95 },
    { pattern: /\bOIF\b|\bOperation\s+Iraqi\s+Freedom\b/i, era: 'Operation Iraqi Freedom', confidence: 95 },
    { pattern: /\bOEF\b|\bOperation\s+Enduring\s+Freedom\b/i, era: 'Operation Enduring Freedom', confidence: 95 },
    { pattern: /\bpost-?9\/?11\b/i, era: 'Post-9/11', confidence: 90 },
    { pattern: /\bWWII\b|\bWorld\s+War\s+II\b/i, era: 'World War II', confidence: 95 },
    { pattern: /\bKorean\s+War\b/i, era: 'Korean War', confidence: 95 }
  ];

  for (const { pattern, era, confidence } of eraPatterns) {
    if (pattern.test(text)) {
      return { era, confidence };
    }
  }

  // Infer from locations
  if (locations.includes('Vietnam') || locations.includes('Thailand')) {
    return { era: 'Vietnam Era', confidence: 85 };
  }
  
  if (locations.some(loc => ['Iraq', 'Afghanistan', 'Kuwait', 'Persian Gulf', 'Southwest Asia'].includes(loc))) {
    return { era: 'Gulf War / Post-9/11', confidence: 80 };
  }

  // Infer from service dates if available
  if (serviceDates.startDate || serviceDates.endDate) {
    const dateText = `${serviceDates.startDate || ''} ${serviceDates.endDate || ''}`;
    
    if (/19[6-7]\d|197[0-5]/.test(dateText)) {
      return { era: 'Vietnam Era (inferred)', confidence: 70 };
    }
    
    if (/199[0-9]|20[0-2]\d/.test(dateText)) {
      return { era: 'Gulf War / Post-9/11 (inferred)', confidence: 70 };
    }
  }

  return { era: null, confidence: 0 };
}

/**
 * Assess CRSC (Combat-Related Special Compensation) eligibility
 */
function assessCRSCEligibility(combatData) {
  let score = 0;

  // Combat awards strongly indicate CRSC eligibility
  if (combatData.combatAwards.length > 0) {
    score += 50;
  }

  // Combat era/location indicators
  if (combatData.combatStatus) {
    score += 25;
  }

  if (combatData.deploymentLocations.length > 0) {
    score += 15;
  }

  // Service branch (all branches eligible, but military service required)
  if (combatData.serviceBranch) {
    score += 10;
  }

  return {
    eligible: score >= 50,  // Threshold for likely eligibility
    confidence: Math.min(score, 95)
  };
}

/**
 * Assess presumptive condition eligibility
 */
function assessPresumptiveEligibility(combatData, text) {
  const categories = [];
  let eligible = false;

  // Agent Orange presumptive (Vietnam, Thailand, Korean DMZ)
  if (combatData.deploymentLocations.some(loc => ['Vietnam', 'Thailand', 'Korean DMZ'].includes(loc))) {
    categories.push('Agent Orange');
    eligible = true;
  }

  // Gulf War presumptive
  if (combatData.deploymentLocations.some(loc => 
    ['Iraq', 'Kuwait', 'Saudi Arabia', 'Qatar', 'Bahrain', 'Persian Gulf', 'Southwest Asia'].includes(loc)
  )) {
    categories.push('Gulf War');
    eligible = true;
  }

  // PACT Act / Burn Pits
  if (combatData.deploymentLocations.some(loc => 
    ['Iraq', 'Afghanistan', 'Djibouti', 'Syria', 'Uzbekistan'].includes(loc)
  ) || /burn\s+pit|PACT\s+Act/i.test(text)) {
    categories.push('PACT Act / Burn Pit');
    eligible = true;
  }

  // Camp Lejeune
  if (/Camp\s+Lejeune/i.test(text)) {
    categories.push('Camp Lejeune');
    eligible = true;
  }

  return {
    eligible,
    categories: [...new Set(categories)]
  };
}

/**
 * Default export
 */
export default extractCombatStatus;
