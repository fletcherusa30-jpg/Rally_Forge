/**
 * Special Monthly Compensation (SMC) Extraction
 * Extracts explicit SMC awards and infers eligibility
 */

/**
 * Extract explicit SMC awards from normalized text
 * @param {string} normalizedText - Normalized VA decision text
 * @param {Array<Object>} serviceConnected - Service-connected conditions from extraction
 * @returns {Object} SMC information
 */
export function extractSMC(normalizedText, serviceConnected = []) {
  const smc = {
    explicit: [],
    inferred: [],
    eligibilityIndicators: [],
    totalMonthlyAmount: null
  };

  // Define actual SMC award patterns (not just keywords)
  const smcAwardPatterns = [
    // Pattern 1: "entitled to SMC-X" or "granted SMC-X"
    {
      regex: /(?:entitled\s+to|granted|approved\s+for)\s+SMC[-\s]?([KLMNOPQRST][1-9]?)\b/gi,
      type: 'explicit'
    },
    // Pattern 2: "SMC at the [level] rate"
    {
      regex: /SMC\s+at\s+the\s+(housebound|aid\s+and\s+attendance|higher\s+level)/gi,
      type: 'descriptor'
    },
    // Pattern 3: "Special Monthly Compensation at the [level] rate"
    {
      regex: /Special\s+Monthly\s+Compensation\s+at\s+the\s+(housebound|aid\s+and\s+attendance|higher\s+level)\s+rate/gi,
      type: 'descriptor'
    },
    // Pattern 4: "awarded/entitled to special monthly compensation for [reason]"
    {
      regex: /(?:awarded|entitled\s+to|granted)\s+(?:special\s+monthly\s+compensation|SMC)\s+(?:for|due\s+to)\s+([^.]+)/gi,
      type: 'reason'
    }
  ];

  // Map descriptors to SMC levels
  const descriptorMap = {
    'housebound': 'SMC-S (Housebound)',
    'aid and attendance': 'SMC-L (Aid and Attendance)',
    'higher level': 'SMC-Higher'
  };

  // Extract using patterns
  smcAwardPatterns.forEach(({ regex, type }) => {
    let match;
    regex.lastIndex = 0;  // Reset regex
    while ((match = regex.exec(normalizedText)) !== null) {
      if (type === 'explicit') {
        // Direct SMC level mentioned
        const level = `SMC-${match[1].toUpperCase()}`;
        
        if (!smc.explicit.find(e => e.level === level)) {
          smc.explicit.push({
            level,
            description: getSMCDescription(level),
            monthlyAmount: null,
            status: 'Granted',
            evidenceSource: 'VA Rating Decision'
          });
          console.log(`[SMC Explicit] Extracted: ${level}`);
        }
      } else if (type === 'descriptor') {
        // Descriptor like "housebound"
        const descriptor = match[1].toLowerCase();
        const smcLevel = descriptorMap[descriptor] || descriptor;
        
        if (!smc.explicit.find(e => e.level === smcLevel || e.description.toLowerCase().includes(descriptor))) {
          // Map descriptor to actual SMC level
          let actualLevel = smcLevel;
          if (descriptor === 'housebound') actualLevel = 'SMC-S (Housebound)';
          if (descriptor === 'aid and attendance') actualLevel = 'SMC-L (Aid and Attendance)';
          
          smc.explicit.push({
            level: actualLevel,
            type: actualLevel,  // Add type field
            description: match[0],
            monthlyAmount: null,
            status: 'Granted',
            evidenceSource: 'VA Rating Decision'
          });
          console.log(`[SMC Explicit] Extracted: ${actualLevel}`);
        }
      } else if (type === 'reason') {
        // Award with reason
        const reason = match[1].trim();
        
        if (!smc.explicit.find(e => e.description === reason)) {
          smc.explicit.push({
            level: determineSMCLevel(reason),
            description: reason,
            monthlyAmount: null,
            status: 'Granted',
            evidenceSource: 'VA Rating Decision'
          });
          console.log(`[SMC Explicit] Extracted: ${reason}`);
        }
      }
    }
  });

  // Only check for specific indicators that actually appear in AWARDS
  const eligibilityPatterns = [
    { pattern: /\b(?:entitled|awarded|granted).*?housebound/i, indicator: 'Housebound status' },
    { pattern: /\b(?:entitled|awarded|granted).*?aid\s+and\s+attendance/i, indicator: 'Aid and Attendance' },
    { pattern: /\b(?:entitled|awarded|granted).*?loss.*?extremit/i, indicator: 'Loss of extremity' }
  ];

  eligibilityPatterns.forEach(({ pattern, indicator }) => {
    if (pattern.test(normalizedText) && !smc.eligibilityIndicators.includes(indicator)) {
      smc.eligibilityIndicators.push(indicator);
      console.log(`[SMC Indicator] Found: ${indicator}`);
    }
  });

  // Infer SMC-K if Erectile Dysfunction is 100% service-connected
  const edCondition = serviceConnected.find(sc => 
    /erectile\s+dysfunction|ed$/i.test(sc.condition) && sc.percentage === 100
  );

  if (edCondition && !smc.explicit.some(e => e.level === 'SMC-K')) {
    smc.inferred.push({
      level: 'SMC-K',
      description: 'Loss of use of a creative organ (ED)',
      condition: edCondition.condition,
      reasoning: 'Service-connected ED at 100% may qualify for SMC-K',
      status: 'May Qualify',
      evidenceSource: 'Inferred from SC conditions'
    });
    
    console.log('[SMC Inferred] ED 100% may qualify for SMC-K');
  }

  // Infer SMC-T (Housebound) if qualifying conditions present
  const houseboundIndicators = serviceConnected.filter(sc => {
    const condition = sc.condition.toLowerCase();
    return (
      (sc.percentage === 100) ||  // Multiple 100% ratings
      /housebound|confined|mobility|paralysis/i.test(condition)
    );
  });

  if (houseboundIndicators.length >= 1 && !smc.explicit.some(e => e.level === 'SMC-T')) {
    smc.inferred.push({
      level: 'SMC-T',
      description: 'Housebound due to service-connected disability',
      conditions: houseboundIndicators.map(h => h.condition),
      reasoning: 'May qualify based on housebound criteria',
      status: 'May Qualify',
      evidenceSource: 'Inferred from SC conditions'
    });
    
    console.log('[SMC Inferred] May qualify for SMC-T (housebound)');
  }

  return smc;
}

/**
 * Get SMC description for a given level
 * @param {string} level - SMC level (e.g., "SMC-K")
 * @returns {string} Description
 */
function getSMCDescription(level) {
  const descriptions = {
    'SMC-K': 'Loss of use of a creative organ',
    'SMC-L': 'Loss of use of one extremity',
    'SMC-M': 'Loss of use of two extremities',
    'SMC-N': 'Loss or loss of use of one arm and one leg',
    'SMC-O': 'Loss or loss of use of both arms or both legs',
    'SMC-P': 'Loss or loss of use of both legs at the hip',
    'SMC-R': 'Loss or loss of use of one arm at the shoulder',
    'SMC-S': 'Loss or loss of use of both arms at the shoulder',
    'SMC-T': 'Housebound due to service-connected disability',
    'SMC-S (Housebound)': 'Housebound due to service-connected disability',
    'SMC-L (Aid and Attendance)': 'Aid and Attendance'
  };
  
  return descriptions[level] || level;
}

/**
 * Determine SMC level from reason text
 * @param {string} reason - Reason for SMC award
 * @returns {string} SMC level
 */
function determineSMCLevel(reason) {
  const reasonLower = reason.toLowerCase();
  
  if (/housebound/i.test(reasonLower)) return 'SMC (Housebound)';
  if (/aid\s+and\s+attendance/i.test(reasonLower)) return 'SMC (Aid and Attendance)';
  if (/loss.*creative\s+organ|erectile\s+dysfunction/i.test(reasonLower)) return 'SMC-K';
  if (/loss.*both\s+arms.*shoulder/i.test(reasonLower)) return 'SMC-S';
  if (/loss.*one\s+arm.*shoulder/i.test(reasonLower)) return 'SMC-R';
  if (/loss.*both\s+legs.*hip/i.test(reasonLower)) return 'SMC-P';
  if (/loss.*both.*(?:arms|legs)/i.test(reasonLower)) return 'SMC-O';
  if (/loss.*one\s+arm.*one\s+leg/i.test(reasonLower)) return 'SMC-N';
  if (/loss.*two\s+extremit/i.test(reasonLower)) return 'SMC-M';
  if (/loss.*one\s+extremit/i.test(reasonLower)) return 'SMC-L';
  
  return 'SMC (Unspecified Level)';
}

/**
 * Extract SMC monthly amount from text
 * @param {string} normalizedText - Text to search
 * @param {string} smcLevel - SMC level (e.g., "SMC-K")
 * @returns {number|null} Monthly amount or null
 */
function extractSMCAmount(normalizedText, smcLevel) {
  // Pattern: "SMC-K: $XYZ" or "Special Monthly Compensation K: $XYZ"
  const patterns = [
    new RegExp(`${smcLevel}\\s*[:=]?\\s*\\$([\\d,]+)`, 'i'),
    new RegExp(`special\\s+monthly\\s+compensation\\s+${smcLevel.replace('SMC-', '')}\\s*[:=]?\\s*\\$([\\d,]+)`, 'i'),
    new RegExp(`${smcLevel}\\s+monthly\\s+amount\\s*[:=]?\\s*\\$([\\d,]+)`, 'i')
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      const amount = parseInt(match[1].replace(/,/g, ''));
      if (!isNaN(amount)) {
        return amount;
      }
    }
  }

  return null;
}

/**
 * Determine SMC eligibility from service-connected conditions
 * @param {Array<Object>} serviceConnected - Service-connected conditions
 * @returns {Object} SMC eligibility assessment
 */
export function assessSMCEligibility(serviceConnected) {
  const assessment = {
    potentialLevels: [],
    recommendations: []
  };

  if (!Array.isArray(serviceConnected)) return assessment;

  // Check for loss of use conditions
  const lossOfUseConditions = serviceConnected.filter(sc => 
    /loss\s+of|amputation|paralysis|immobility/i.test(sc.condition)
  );

  if (lossOfUseConditions.length >= 1) {
    assessment.potentialLevels.push('SMC-L or higher');
    assessment.recommendations.push('Evaluate for loss of extremity SMC levels');
  }

  // Check for ED
  const edConditions = serviceConnected.filter(sc => 
    /erectile\s+dysfunction|ed$/i.test(sc.condition)
  );

  if (edConditions.some(ed => ed.percentage === 100)) {
    assessment.potentialLevels.push('SMC-K');
    assessment.recommendations.push('Verify SMC-K eligibility for 100% ED');
  }

  // Check for housebound indicators
  const houseboundConditions = serviceConnected.filter(sc => 
    /housebound|confined|mobility|wheelchair/i.test(sc.condition) || sc.percentage === 100
  );

  if (houseboundConditions.length >= 1) {
    assessment.potentialLevels.push('SMC-T');
    assessment.recommendations.push('Evaluate for housebound SMC-T eligibility');
  }

  return assessment;
}

