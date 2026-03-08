/**
 * CFR-Faithful VA Rating Decision Parser
 * ========================================
 * 
 * Parser compliant with 38 CFR (Code of Federal Regulations) for accurate
 * extraction and interpretation of VA rating decisions.
 * 
 * Key Regulations Implemented:
 * - 38 CFR § 4.25 - Combined ratings table
 * - 38 CFR § 4.26 - Bilateral factor
 * - 38 CFR § 3.102 - Reasonable doubt
 * - 38 CFR § 3.310 - Ratings for service-connected disabilities
 * - 38 CFR § 3.400 - Peacetime and wartime service
 * - 38 CFR § 3.350 - Special monthly compensation (SMC)
 * 
 * @version 1.0.0
 * @date 2026-02-21
 * @compliance 38 CFR Parts 3 & 4
 */

// ============================================================================
// 38 CFR § 4.25 - COMBINED RATINGS TABLE
// ============================================================================

/**
 * Official VA Combined Rating Table per 38 CFR § 4.25
 * 
 * This table is used to combine two or more disabilities.
 * The combined value is always less than the sum of the individual ratings.
 */
const COMBINED_RATINGS_TABLE = {
  /**
   * Get combined rating for two disabilities
   * @param {number} rating1 - First disability rating (0-100)
   * @param {number} rating2 - Second disability rating (0-100)
   * @returns {number} Combined rating
   */
  combine: (rating1, rating2) => {
    if (rating1 === 0) return rating2;
    if (rating2 === 0) return rating1;
    
    // Per 38 CFR § 4.25: Start with the highest rating
    const higher = Math.max(rating1, rating2);
    const lower = Math.min(rating1, rating2);
    
    // Calculate efficiency percentage (what's left after the higher rating)
    const efficiency = 100 - higher;
    
    // Apply the lower rating to the remaining efficiency
    const additional = Math.round(efficiency * (lower / 100));
    
    return higher + additional;
  },
  
  /**
   * Combine multiple ratings per 38 CFR § 4.25
   * @param {number[]} ratings - Array of disability ratings
   * @returns {number} Final combined rating
   */
  combineMultiple: (ratings) => {
    if (!Array.isArray(ratings) || ratings.length === 0) return 0;
    
    // Sort descending per regulation
    const sorted = ratings.filter(r => r > 0 && r <= 100).sort((a, b) => b - a);
    
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];
    
    // Start with highest rating
    let combined = sorted[0];
    
    // Apply each additional rating
    for (let i = 1; i < sorted.length; i++) {
      combined = COMBINED_RATINGS_TABLE.combine(combined, sorted[i]);
    }
    
    return COMBINED_RATINGS_TABLE.round(combined);
  },
  
  /**
   * Round combined rating per 38 CFR § 4.25
   * Values 1-4 round down, 5-9 round up
   */
  round: (value) => {
    const ones = value % 10;
    const base = Math.floor(value / 10) * 10;
    
    if (ones <= 4) return base;
    return base + 10;
  }
};

// ============================================================================
// 38 CFR § 4.26 - BILATERAL FACTOR
// ============================================================================

/**
 * Bilateral factor calculator per 38 CFR § 4.26
 * 
 * When bilateral disabilities exist (same condition on both sides),
 * an additional 10% is added to the combined value before final rounding.
 */
const BILATERAL_FACTOR = {
  /**
   * Paired body parts that qualify for bilateral consideration
   */
  BILATERAL_BODY_PARTS: [
    'eye', 'ear', 'arm', 'hand', 'finger', 'thumb',
    'leg', 'foot', 'toe', 'knee', 'ankle', 'hip',
    'shoulder', 'elbow', 'wrist'
  ],
  
  /**
   * Determine if a condition is bilateral
   */
  isBilateral: (condition) => {
    const text = condition.toLowerCase();
    
    // Check if involves a paired body part
    const hasPairedPart = BILATERAL_FACTOR.BILATERAL_BODY_PARTS.some(part => 
      text.includes(part)
    );
    
    if (!hasPairedPart) return false;
    
    // Check if laterality is specified
    const hasLeft = /\b(left|l\.?)\b/i.test(text);
    const hasRight = /\b(right|r\.?)\b/i.test(text);
    
    return hasLeft || hasRight;
  },
  
  /**
   * Extract laterality from condition
   */
  getLaterality: (condition) => {
    const text = condition.toLowerCase();
    // Check for non-dominant FIRST to avoid false match with dominant
    if (/\b(left|l\.?|non-dominant)\b/i.test(text)) return 'left';
    if (/\b(right|r\.?|dominant)\b/i.test(text)) return 'right';
    return null;
  },
  
  /**
   * Find bilateral pairs in a list of conditions
   * @param {Array} conditions - Array of condition objects
   * @returns {Array} Array of bilateral pair groups
   */
  findBilateralPairs: (conditions) => {
    const pairs = [];
    const processed = new Set();
    
    for (let i = 0; i < conditions.length; i++) {
      if (processed.has(i)) continue;
      
      const cond1 = conditions[i];
      if (!BILATERAL_FACTOR.isBilateral(cond1.condition)) continue;
      
      const laterality1 = BILATERAL_FACTOR.getLaterality(cond1.condition);
      if (!laterality1) continue;
      
      // Find matching pair
      for (let j = i + 1; j < conditions.length; j++) {
        if (processed.has(j)) continue;
        
        const cond2 = conditions[j];
        const laterality2 = BILATERAL_FACTOR.getLaterality(cond2.condition);
        
        // Check if same body part, opposite sides
        if (laterality1 !== laterality2 && 
            BILATERAL_FACTOR.isSameBodyPart(cond1.condition, cond2.condition)) {
          
          pairs.push({
            left: laterality1 === 'left' ? cond1 : cond2,
            right: laterality1 === 'right' ? cond1 : cond2,
            bodyPart: BILATERAL_FACTOR.extractBodyPart(cond1.condition)
          });
          
          processed.add(i);
          processed.add(j);
          break;
        }
      }
    }
    
    return pairs;
  },
  
  /**
   * Check if two conditions affect the same body part
   */
  isSameBodyPart: (cond1, cond2) => {
    const text1 = cond1.toLowerCase().replace(/\b(left|right|bilateral)\b/g, '');
    const text2 = cond2.toLowerCase().replace(/\b(left|right|bilateral)\b/g, '');
    
    // Extract body parts
    for (const part of BILATERAL_FACTOR.BILATERAL_BODY_PARTS) {
      if (text1.includes(part) && text2.includes(part)) {
        return true;
      }
    }
    
    return false;
  },
  
  /**
   * Extract body part name from condition
   */
  extractBodyPart: (condition) => {
    const text = condition.toLowerCase();
    for (const part of BILATERAL_FACTOR.BILATERAL_BODY_PARTS) {
      if (text.includes(part)) return part;
    }
    return 'unknown';
  },
  
  /**
   * Apply bilateral factor per 38 CFR § 4.26
   * @param {number} combinedRating - Combined rating of bilateral conditions
   * @returns {number} Rating with 10% bilateral factor applied
   */
  applyBilateralFactor: (combinedRating) => {
    // Add 10% of the combined value
    const bilateralBonus = Math.round(combinedRating * 0.10);
    return combinedRating + bilateralBonus;
  }
};

// ============================================================================
// 38 CFR § 3.350 - SPECIAL MONTHLY COMPENSATION (SMC)
// ============================================================================

/**
 * Special Monthly Compensation rules per 38 CFR § 3.350
 */
const SMC_RULES = {
  /**
   * Conditions that may qualify for SMC
   */
  SMC_CONDITIONS: {
    'loss of use': {
      bodyParts: ['hand', 'foot', 'leg', 'arm'],
      smcLevel: 'K',
      description: 'Loss of use of a limb'
    },
    'anatomical loss': {
      bodyParts: ['hand', 'foot', 'leg', 'arm'],
      smcLevel: 'K',
      description: 'Anatomical loss of a limb'
    },
    'blindness': {
      keywords: ['blind', 'vision', 'eye'],
      smcLevel: 'L',
      description: 'Loss of vision'
    },
    'deafness': {
      keywords: ['deaf', 'hearing loss', 'hearing'],
      smcLevel: 'K',
      description: 'Deafness of both ears'
    },
    'bedridden': {
      keywords: ['bedridden', 'bed rest', 'housebound'],
      smcLevel: 'S',
      description: 'Housebound or bedridden'
    }
  },
  
  /**
   * Detect potential SMC eligibility
   */
  detectSMC: (conditions) => {
    const smcCandidates = [];
    
    for (const condition of conditions) {
      const text = condition.condition.toLowerCase();
      
      for (const [type, rules] of Object.entries(SMC_RULES.SMC_CONDITIONS)) {
        let matches = false;
        
        if (rules.bodyParts) {
          matches = rules.bodyParts.some(part => text.includes(part)) &&
                   text.includes(type);
        } else if (rules.keywords) {
          matches = rules.keywords.some(kw => text.includes(kw));
        }
        
        if (matches) {
          smcCandidates.push({
            condition: condition.condition,
            smcType: type,
            smcLevel: rules.smcLevel,
            description: rules.description
          });
        }
      }
    }
    
    return smcCandidates;
  }
};

// ============================================================================
// 38 CFR § 3.102 - BENEFIT OF THE DOUBT
// ============================================================================

/**
 * Benefit of the doubt (reasonable doubt) markers
 * per 38 CFR § 3.102
 */
const REASONABLE_DOUBT = {
  /**
   * Keywords indicating benefit of the doubt was applied
   */
  INDICATORS: [
    'reasonable doubt',
    'benefit of the doubt',
    'doubt resolved in favor',
    'equipoise',
    'approximately equal evidence'
  ],
  
  /**
   * Detect if reasonable doubt was applied
   */
  wasApplied: (text) => {
    const lower = text.toLowerCase();
    return REASONABLE_DOUBT.INDICATORS.some(indicator => 
      lower.includes(indicator)
    );
  }
};

// ============================================================================
// CFR-FAITHFUL PARSER
// ============================================================================

export class CFRRatingParser {
  constructor() {
    this.version = '1.0.0';
    this.compliance = '38 CFR Parts 3 & 4';
  }
  
  /**
   * Parse VA rating decision with CFR compliance
   * @param {string} rawText - Raw decision letter text
   * @returns {Object} Parsed decision with CFR annotations
   */
  parse(rawText) {
    const text = this.normalize(rawText);
    
    // Extract basic information
    const fileNumber = this.extractFileNumber(text);
    const veteranName = this.extractVeteranName(text);
    const decisionDate = this.extractDecisionDate(text);
    
    // Extract service-connected disabilities
    const serviceConnected = this.extractServiceConnected(text);
    
    // Extract denied claims
    const denied = this.extractDenied(text);
    
    // Apply 38 CFR § 4.26 - Bilateral factor
    const bilateralPairs = BILATERAL_FACTOR.findBilateralPairs(serviceConnected);
    
    // Calculate combined rating per 38 CFR § 4.25
    const ratings = serviceConnected.map(c => c.percentage).filter(r => r > 0);
    let calculatedCombined = COMBINED_RATINGS_TABLE.combineMultiple(ratings);
    
    // Apply bilateral factor if applicable
    if (bilateralPairs.length > 0) {
      const bilateralRatings = bilateralPairs.flatMap(pair => [
        pair.left.percentage,
        pair.right.percentage
      ]);
      const bilateralCombined = COMBINED_RATINGS_TABLE.combineMultiple(bilateralRatings);
      const withBilateralFactor = BILATERAL_FACTOR.applyBilateralFactor(bilateralCombined);
      
      // Recalculate with non-bilateral conditions
      const nonBilateralRatings = ratings.filter(r => 
        !bilateralRatings.includes(r)
      );
      
      if (nonBilateralRatings.length > 0) {
        calculatedCombined = COMBINED_RATINGS_TABLE.combine(
          withBilateralFactor,
          COMBINED_RATINGS_TABLE.combineMultiple(nonBilateralRatings)
        );
      } else {
        calculatedCombined = withBilateralFactor;
      }
      
      calculatedCombined = COMBINED_RATINGS_TABLE.round(calculatedCombined);
    }
    
    // Extract stated combined rating
    const extractedCombined = this.extractCombinedRating(text);
    
    // Detect SMC per 38 CFR § 3.350
    const smcCandidates = SMC_RULES.detectSMC(serviceConnected);
    
    // Detect reasonable doubt per 38 CFR § 3.102
    const reasonableDoubtApplied = REASONABLE_DOUBT.wasApplied(text);
    
    // Effective dates per 38 CFR § 3.400
    const effectiveDates = this.extractEffectiveDates(text);
    
    return {
      metadata: {
        fileNumber,
        veteranName,
        decisionDate,
        parserVersion: this.version,
        cfrCompliance: this.compliance,
      },
      
      serviceConnected: serviceConnected.map(condition => ({
        ...condition,
        cfrReference: '38 CFR § 3.310',
        isBilateral: BILATERAL_FACTOR.isBilateral(condition.condition),
        laterality: BILATERAL_FACTOR.getLaterality(condition.condition),
      })),
      
      denied: denied.map(condition => ({
        ...condition,
        cfrReference: '38 CFR § 3.102',
      })),
      
      combinedRating: {
        calculated: calculatedCombined,
        extracted: extractedCombined,
        method: '38 CFR § 4.25',
        bilateralFactorApplied: bilateralPairs.length > 0,
        bilateralPairs: bilateralPairs.map(pair => ({
          bodyPart: pair.bodyPart,
          leftRating: pair.left.percentage,
          rightRating: pair.right.percentage,
          cfrReference: '38 CFR § 4.26',
        })),
      },
      
      specialMonthlyCompensation: {
        candidates: smcCandidates,
        cfrReference: '38 CFR § 3.350',
      },
      
      reasonableDoubt: {
        applied: reasonableDoubtApplied,
        cfrReference: '38 CFR § 3.102',
      },
      
      effectiveDates,
      
      cfrAnnotations: {
        '38 CFR § 4.25': 'Combined ratings table',
        '38 CFR § 4.26': 'Bilateral factor',
        '38 CFR § 3.102': 'Reasonable doubt',
        '38 CFR § 3.310': 'Service-connected disabilities',
        '38 CFR § 3.350': 'Special monthly compensation',
        '38 CFR § 3.400': 'Effective dates',
      },
    };
  }
  
  normalize(text) {
    return text
      .replace(/\r/g, '')
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  extractFileNumber(text) {
    const match = text.match(/(?:file\s+number|claim\s+number)[\s:]+(\d{3}-?\d{2}-?\d{4})/i);
    return match ? match[1] : null;
  }
  
  extractVeteranName(text) {
    const match = text.match(/(?:veteran|claimant)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
    return match ? match[1].trim() : null;
  }
  
  extractDecisionDate(text) {
    const match = text.match(/(?:decision\s+date|dated)[\s:]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i);
    return match ? match[1] : null;
  }
  
  extractServiceConnected(text) {
    const pattern = /(service.{0,20}connection.{0,50}?(?:for|of)\s+(.+?)(?:is|was)\s+(?:granted|established|confirmed|awarded).{0,100}?(?:evaluated|rated)\s+(?:as|at)\s+(\d+)\s*percent)/gi;
    const conditions = [];
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      conditions.push({
        condition: match[2].trim(),
        percentage: parseInt(match[3], 10),
        rawText: match[0],
      });
    }
    
    return conditions;
  }
  
  extractDenied(text) {
    const pattern = /(service.{0,20}connection.{0,50}?(?:for|of)\s+(.+?)(?:is|was)\s+(?:denied|not granted|not established))/gi;
    const conditions = [];
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      conditions.push({
        condition: match[2].trim(),
        rawText: match[0],
      });
    }
    
    return conditions;
  }
  
  extractCombinedRating(text) {
    const match = text.match(/combined.{0,30}?(?:evaluation|rating)[\s:]+(?:is|of)\s+(\d+)\s*percent/i);
    return match ? parseInt(match[1], 10) : null;
  }
  
  extractEffectiveDates(text) {
    const pattern = /effective\s+date[\s:]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi;
    const dates = [];
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      dates.push(match[1]);
    }
    
    return dates;
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  CFRRatingParser,
  COMBINED_RATINGS_TABLE,
  BILATERAL_FACTOR,
  SMC_RULES,
  REASONABLE_DOUBT,
};

// ============================================================================
// CLI USAGE
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const parser = new CFRRatingParser();
  
  const sampleText = `
DEPARTMENT OF VETERANS AFFAIRS
Rating Decision
File Number: 123-45-6789
Veteran: John Doe
Decision Date: January 15, 2024

Service connection for Post Traumatic Stress Disorder (PTSD) is granted and evaluated as 70 percent disabling.

Service connection for right knee strain is granted and evaluated as 20 percent disabling.

Service connection for left knee strain is granted and evaluated as 20 percent disabling.

Service connection for tinnitus is granted and evaluated as 10 percent disabling.

Service connection for migraine headaches is denied.

Your combined disability evaluation is 80 percent.

Effective date: January 1, 2024
  `;
  
  const result = parser.parse(sampleText);
  console.log(JSON.stringify(result, null, 2));
}

