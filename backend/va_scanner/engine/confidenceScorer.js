/**
 * Confidence Scoring System for VA Scanner
 * Calculates confidence levels (0-100) for all extractions
 */

export class ExtractionScorer {
  /**
   * Score a condition extraction
   * @param {object} condition - { condition, percentage, status, isBilateral, laterality }
   * @param {string} sourceText - Original source text where condition was found
   * @param {array} matchedPatterns - Patterns that matched
   * @returns {number} Confidence 0-100
   */
  static scoreConditionExtraction(condition, sourceText, matchedPatterns = []) {
    let confidence = 70; // Base confidence
    
    // Boost for explicit source text match
    if (sourceText && sourceText.toLowerCase().includes(condition.condition.toLowerCase())) {
      confidence += 15;
    }
    
    // Boost for multiple pattern matches
    if (matchedPatterns?.length > 1) {
      confidence += Math.min(15, matchedPatterns.length * 5);
    }
    
    // Boost for complete condition name (not truncated)
    if (condition.condition.length > 20) {
      confidence += 10; // Longer, more specific conditions are more reliable
    }
    
    // Penalty for conditions that are very short (could be false positives)
    if (condition.condition.length < 5) {
      confidence -= 20;
    }
    
    // Boost if it's a standard CFR condition
    if (this.isStandardCFRCondition(condition.condition)) {
      confidence += 15;
    }
    
    // Penalty for common false positives
    if (this.isCommonFalsePositive(condition.condition)) {
      confidence -= 25;
    }
    
    // Boost for explicit "service connection" text
    if (sourceText?.match(/service connection for.*?is granted/i)) {
      confidence += 10;
    }
    
    // Penalty if condition appears near denials
    if (sourceText?.match(/service connection.*?is denied/i)) {
      confidence -= 30;
    }
    
    return Math.max(0, Math.min(100, confidence));
  }
  
  /**
   * Score a rating percentage extraction
   * @param {number} percentage - Rating percentage extracted
   * @param {string} sourceText - Context where percentage was found
   * @returns {number} Confidence 0-100
   */
  static scoreRatingExtraction(percentage, sourceText) {
    let confidence = 75;
    
    // Boost for standard VA percentages (10% increments)
    if (percentage % 10 === 0) {
      confidence += 15;
    }
    
    // Boost for valid range
    if (percentage >= 0 && percentage <= 100) {
      confidence += 10;
    } else {
      confidence -= 40; // Invalid percentage
    }
    
    // Boost if "percent" or "%" explicitly present
    if (sourceText?.match(/%|percent/i)) {
      confidence += 10;
    }
    
    // Boost if percentage is in standard context
    if (sourceText?.match(/with an?.*?evaluation|rated at|assigned|evaluation of/i)) {
      confidence += 10;
    }
    
    return Math.max(0, Math.min(100, confidence));
  }
  
  /**
   * Score an effective date extraction
   * @param {string} effectiveDate - Extracted date
   * @param {string} sourceText - Context text
   * @returns {number} Confidence 0-100
   */
  static scoreDateExtraction(effectiveDate, sourceText) {
    let confidence = 60;
    
    // Boost for valid date format
    if (this.isValidDateFormat(effectiveDate)) {
      confidence += 20;
    } else {
      confidence -= 30;
    }
    
    // Boost if "effective" keyword present
    if (sourceText?.includes('effective')) {
      confidence += 15;
    }
    
    // Boost if date matches decision date context
    if (sourceText?.match(/effective\s+\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)/i)) {
      confidence += 10;
    }
    
    return Math.max(0, Math.min(100, confidence));
  }
  
  /**
   * Score combined rating calculation
   * @param {array} conditions - Extracted conditions with ratings
   * @param {number} calculatedRating - Combined rating
   * @param {boolean} hasVerification - Whether calculation was verified
   * @returns {number} Confidence 0-100
   */
  static scoreCombinedRating(conditions, calculatedRating, hasVerification = false) {
    let confidence = 70;
    
    // Boost if reasonable number of conditions
    if (conditions.length >= 3 && conditions.length <= 30) {
      confidence += 15;
    } else if (conditions.length > 30) {
      confidence -= 10; // Very large number might indicate extraction error
    }
    
    // Boost if rating is within expected range
    if (calculatedRating >= 0 && calculatedRating <= 100) {
      confidence += 15;
    } else {
      confidence -= 40;
    }
    
    // Boost if highest individual rating <= combined rating <= 100
    const maxRating = Math.max(...conditions.map(c => parseInt(c.rating) || 0));
    if (calculatedRating >= maxRating && calculatedRating <= 100) {
      confidence += 10;
    } else {
      confidence -= 20;
    }
    
    // Significant boost if verified
    if (hasVerification) {
      confidence += 20;
    }
    
    return Math.max(0, Math.min(100, confidence));
  }
  
  /**
   * Check if condition is in standard CFR diagnostic categories
   * @param {string} condition - Condition name
   * @returns {boolean}
   */
  static isStandardCFRCondition(condition) {
    const standardConditions = [
      'obstructive sleep apnea', 'tinnitus', 'hypertension',
      'arthritis', 'spondylosis', 'dermatitis', 'asthma',
      'sinusitis', 'rhinitis', 'gastroesophageal reflux',
      'anxiety', 'depression', 'adjustment disorder',
      'radiculopathy', 'sciatica', 'hearing loss'
    ];
    
    return standardConditions.some(std => 
      condition.toLowerCase().includes(std.toLowerCase())
    );
  }
  
  /**
   * Check if condition is known false positive
   * @param {string} condition - Condition name
   * @returns {boolean}
   */
  static isCommonFalsePositive(condition) {
    const falsePositives = [
      'flavum', // Typically part of longer condition name
      'claimed as', 'also claimed',
      'see rating decision',
      'please refer',
      'the law provides',
      'form', 'page'
    ];
    
    return falsePositives.some(fp => 
      condition.toLowerCase().includes(fp.toLowerCase())
    );
  }
  
  /**
   * Validate date format
   * @param {string} dateStr - Date string to validate
   * @returns {boolean}
   */
  static isValidDateFormat(dateStr) {
    if (!dateStr) return false;
    
    const patterns = [
      /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY
      /^\w+\s+\d{1,2},?\s+\d{4}$/, // Month DD, YYYY
      /^\d{4}-\d{2}-\d{2}$/, // ISO YYYY-MM-DD
      /^\d{1,2}-\w+-\d{4}$/, // DD-Mon-YYYY
      /^\w+\s+\d{4}$/ // Month YYYY (less specific)
    ];
    
    return patterns.some(p => p.test(dateStr));
  }
  
  /**
   * Score bilateral pairing
   * @param {object} pair - { left, right, groupKey }
   * @returns {number} Confidence 0-100
   */
  static scoreBilateralPair(pair) {
    let confidence = 70;
    
    // Boost if both sides present
    if (pair.left && pair.right) {
      confidence += 15;
    } else {
      confidence -= 20; // Incomplete pair
    }
    
    // Boost if anatomically related
    if (this.isValidBilateralGroup(pair.groupKey)) {
      confidence += 15;
    }
    
    // Boost if same rating
    if (pair.left?.rating === pair.right?.rating) {
      confidence += 10;
    } else {
      confidence -= 10; // Different ratings might be error
    }
    
    return Math.max(0, Math.min(100, confidence));
  }
  
  /**
   * Validate bilateral grouping
   * @param {string} groupKey - Bilateral group ( upper_extremities, lower_extremities, etc. )
   * @returns {boolean}
   */
  static isValidBilateralGroup(groupKey) {
    const validGroups = [
      'upper_extremities', 'lower_extremities',
      'paired_eyes', 'paired_ears', 'paired_organs',
      'upper_extremity', 'lower_extremity', // Singular forms
      'arm', 'leg', 'foot', 'hand', 'shoulder', 'knee', 'hip'
    ];
    
    return validGroups.some(g => 
      groupKey?.toLowerCase().includes(g)
    );
  }
  
  /**
   * Generate detailed confidence report
   * @param {object} scanResults - Full scanner output
   * @returns {object} Confidence report with breakdowns
   */
  static generateConfidenceReport(scanResults) {
    const report = {
      timestamp: new Date().toISOString(),
      overallConfidence: 0,
      sections: {}
    };
    
    // Score service-connected conditions
    if (scanResults.serviceConnected?.length > 0) {
      const scScores = scanResults.serviceConnected.map((c, idx) => ({
        index: idx,
        condition: c.condition,
        confidence: this.scoreConditionExtraction(c)
      }));
      
      report.sections.serviceConnected = {
        itemCount: scScores.length,
        averageConfidence: Math.round(
          scScores.reduce((sum, s) => sum + s.confidence, 0) / scScores.length
        ),
        lowConfidenceItems: scScores.filter(s => s.confidence < 70),
        items: scScores
      };
    }
    
    // Score denied conditions
    if (scanResults.denied?.length > 0) {
      const deniedScores = scanResults.denied.map((c, idx) => ({
        index: idx,
        condition: c.condition,
        confidence: this.scoreConditionExtraction(c)
      }));
      
      report.sections.denied = {
        itemCount: deniedScores.length,
        averageConfidence: Math.round(
          deniedScores.reduce((sum, s) => sum + s.confidence, 0) / deniedScores.length
        ),
        lowConfidenceItems: deniedScores.filter(s => s.confidence < 70),
        items: deniedScores
      };
    }
    
    // Score combined rating
    if (scanResults.ratingCalculation?.calculatedCombinedRating !== undefined) {
      report.sections.combinedRating = {
        rating: scanResults.ratingCalculation.calculatedCombinedRating,
        confidence: this.scoreCombinedRating(
          scanResults.serviceConnected || [],
          scanResults.ratingCalculation.calculatedCombinedRating,
          true
        )
      };
    }
    
    // Calculate overall confidence
    const sectionConfidences = Object.values(report.sections)
      .map(s => s.averageConfidence || s.confidence)
      .filter(c => c !== undefined);
    
    report.overallConfidence = Math.round(
      sectionConfidences.reduce((sum, c) => sum + c, 0) / sectionConfidences.length
    );
    
    // Add quality flags
    report.qualityFlags = this.generateQualityFlags(scanResults, report);
    
    return report;
  }
  
  /**
   * Generate quality flags for problematic extractions
   * @param {object} scanResults - Scanner output
   * @param {object} report - Confidence report
   * @returns {array} Array of quality flags
   */
  static generateQualityFlags(scanResults, report) {
    const flags = [];
    
    if (report.overallConfidence < 70) {
      flags.push({
        level: 'warning',
        message: 'Overall extraction confidence is below 70% - recommend manual review'
      });
    }
    
    if (report.overallConfidence < 50) {
      flags.push({
        level: 'error',
        message: 'Overall extraction confidence is below 50% - extraction may be unreliable'
      });
    }
    
    if (report.sections.serviceConnected?.lowConfidenceItems?.length > 0) {
      flags.push({
        level: 'warning',
        message: `${report.sections.serviceConnected.lowConfidenceItems.length} service-connected items have low confidence`
      });
    }
    
    if (scanResults.serviceConnected?.length > 30) {
      flags.push({
        level: 'warning',
        message: 'Unusually high number of conditions extracted (>30) - verify accuracy'
      });
    }
    
    return flags;
  }
}

export default ExtractionScorer;

