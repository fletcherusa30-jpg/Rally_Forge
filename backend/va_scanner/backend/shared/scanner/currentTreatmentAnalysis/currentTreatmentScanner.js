'use strict';

const CurrentTreatmentValidators = require('./validators/current_treatment_validators');

/**
 * Current Treatment Record Scanner - Main Entry Point
 * Orchestrates extraction and validation of active medical and medication data
 */

class CurrentTreatmentScanner {
  constructor(config = {}) {
    this.config = config;
    this.validators = new CurrentTreatmentValidators(config);
    this.logger = config.logger || { info: () => {}, warn: () => {}, error: () => {} };
  }

  /**
   * Scan and validate current treatment extraction
   * @param {Object} extractedData - Raw extracted current treatment data
   * @returns {Object} {success: boolean, data: Object, validation: Object}
   */
  async scanCurrentTreatment(extractedData) {
    this.logger.info('Processing Current Treatment Record extraction');

    try {
      // Perform deterministic validation
      const validation = this.validators.validateCurrentTreatmentExtraction(extractedData);

      if (!validation.isValid) {
        return {
          success: false,
          data: extractedData,
          validation: validation,
          errors: validation.errors
        };
      }

      // Analyze medical complexity
      const complexity = this.analyzeMedicalComplexity(extractedData);

      // Assess treatment continuity
      const continuity = this.assessTreatmentContinuity(extractedData);

      // Identify functional limitations
      const limitations = this.identifyFunctionalLimitations(extractedData);

      return {
        success: true,
        data: extractedData,
        validation: validation,
        complexity: complexity,
        continuity: continuity,
        limitations: limitations,
        warnings: validation.warnings
      };
    } catch (error) {
      this.logger.error(`Current treatment processing error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Analyze medical complexity
   */
  analyzeMedicalComplexity(data) {
    const complexity = {
      conditionCount: 0,
      medicationCount: 0,
      comorbidityIndex: 0,
      polypharmacyFlag: false,
      severityProfile: {
        mild: 0,
        moderate: 0,
        severe: 0
      }
    };

    // Count conditions
    if (data.activeConditions && Array.isArray(data.activeConditions)) {
      complexity.conditionCount = data.activeConditions.length;

      // Analyze severity distribution
      for (const condition of data.activeConditions) {
        if (condition.severity === 'Mild') complexity.severityProfile.mild++;
        else if (condition.severity === 'Moderate') complexity.severityProfile.moderate++;
        else if (condition.severity === 'Severe') complexity.severityProfile.severe++;
      }

      // Calculate Charlson-like comorbidity index (simplified)
      complexity.comorbidityIndex = Math.min(complexity.conditionCount, 10);

      // High-risk conditions increase complexity
      const highRiskConditions = ['Cancer', 'Organ Failure', 'Sepsis', 'Stroke', 'MI'];
      for (const condition of data.activeConditions) {
        if (highRiskConditions.some(risk => condition.conditionName.includes(risk))) {
          complexity.comorbidityIndex = Math.min(complexity.comorbidityIndex + 2, 10);
        }
      }
    }

    // Count medications (polypharmacy threshold: 5+ medications)
    if (data.currentMedications && Array.isArray(data.currentMedications)) {
      complexity.medicationCount = data.currentMedications.length;
      complexity.polypharmacyFlag = complexity.medicationCount >= 5;
    }

    return complexity;
  }

  /**
   * Assess treatment continuity
   */
  assessTreatmentContinuity(data) {
    const continuity = {
      continuityScore: 0,
      treatmentGaps: [],
      providerCount: 0,
      lastEncounterId: null,
      treatmentGapWarnings: []
    };

    // Count providers
    if (data.treatingProviders && Array.isArray(data.treatingProviders)) {
      continuity.providerCount = data.treatingProviders.length;

      // Track most recent visit
      let mostRecentDate = null;
      for (const provider of data.treatingProviders) {
        if (provider.lastVisitDate && (!mostRecentDate || provider.lastVisitDate > mostRecentDate)) {
          mostRecentDate = provider.lastVisitDate;
          continuity.lastEncounterId = provider.id || provider.providerName;
        }
      }

      // Assess provider coordination
      if (continuity.providerCount > 8) {
        continuity.treatmentGapWarnings.push('High provider count may indicate fragmented care');
      }
    }

    // Check for medication adherence clues
    if (data.currentMedications && Array.isArray(data.currentMedications)) {
      const recentlyStarted = data.currentMedications.filter(med => {
        if (!med.startDate) return false;
        const startDate = new Date(med.startDate);
        const monthsAgo = new Date();
        monthsAgo.setMonth(monthsAgo.getMonth() - 3);
        return startDate > monthsAgo;
      }).length;

      if (recentlyStarted > data.currentMedications.length / 2) {
        continuity.treatmentGapWarnings.push('Many recent medication changes - possible adherence issues');
      }
    }

    // Calculate continuity score (0-100)
    continuity.continuityScore = Math.min(
      (100 - (continuity.treatmentGapWarnings.length * 20)),
      100
    );

    return continuity;
  }

  /**
   * Identify and grade functional limitations
   */
  identifyFunctionalLimitations(data) {
    const limitations = {
      impairmentCount: 0,
      severityGrade: 0,
      affectedCategories: [],
      functionLevelEstimate: 'Unknown'
    };

    if (!data.functionalImpairments || !Array.isArray(data.functionalImpairments)) {
      return limitations;
    }

    limitations.impairmentCount = data.functionalImpairments.length;

    const activityCategoryMap = {};
    let totalSeverity = 0;

    for (const impairment of data.functionalImpairments) {
      const category = impairment.activityCategory || 'Unknown';
      if (!activityCategoryMap[category]) {
        activityCategoryMap[category] = [];
        limitations.affectedCategories.push(category);
      }
      activityCategoryMap[category].push(impairment);

      // Tally severity (Mild=1, Moderate=2, Severe=3, Profound=4)
      const severityMap = { Mild: 1, Moderate: 2, Severe: 3, Profound: 4 };
      totalSeverity += severityMap[impairment.severity] || 0;
    }

    // Calculate severity grade (0-100)
    if (data.functionalImpairments.length > 0) {
      limitations.severityGrade = Math.round((totalSeverity / (data.functionalImpairments.length * 4)) * 100);
    }

    // Estimate functional level
    if (limitations.severityGrade < 20) {
      limitations.functionLevelEstimate = 'Independent';
    } else if (limitations.severityGrade < 40) {
      limitations.functionLevelEstimate = 'Mild restriction';
    } else if (limitations.severityGrade < 60) {
      limitations.functionLevelEstimate = 'Moderate restriction';
    } else if (limitations.severityGrade < 80) {
      limitations.functionLevelEstimate = 'Significant restriction';
    } else {
      limitations.functionLevelEstimate = 'Severely dependent';
    }

    return limitations;
  }
}

module.exports = CurrentTreatmentScanner;
