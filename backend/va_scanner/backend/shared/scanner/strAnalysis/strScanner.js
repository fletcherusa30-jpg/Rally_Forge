'use strict';

const STRValidators = require('./validators/str_validators');

/**
 * Service Treatment Record (STR) Scanner - Main Entry Point
 * Orchestrates extraction and validation of in-service medical data
 */

class STRScanner {
  constructor(config = {}) {
    this.config = config;
    this.validators = new STRValidators(config);
    this.logger = config.logger || { info: () => {}, warn: () => {}, error: () => {} };
  }

  /**
   * Scan and validate STR extraction
   * @param {Object} extractedData - Raw extracted STR data
   * @returns {Object} {success: boolean, data: Object, validation: Object}
   */
  async scanSTR(extractedData) {
    this.logger.info('Processing STR extraction');

    try {
      // Perform deterministic validation
      const validation = this.validators.validateSTRExtraction(extractedData);

      if (!validation.isValid) {
        return {
          success: false,
          data: extractedData,
          validation: validation,
          errors: validation.errors
        };
      }

      // Analyze exposure profile
      const exposureAnalysis = this.analyzeExposureProfile(extractedData);

      // Identify presumptive conditions
      const presumptiveAnalysis = this.identifyPresumptiveConditions(extractedData);

      // Build chronological timeline
      const timeline = this.buildChronologicalTimeline(extractedData);

      return {
        success: true,
        data: extractedData,
        validation: validation,
        exposureAnalysis: exposureAnalysis,
        presumptiveAnalysis: presumptiveAnalysis,
        timeline: timeline,
        warnings: validation.warnings
      };
    } catch (error) {
      this.logger.error(`STR processing error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Analyze military service exposure profile
   */
  analyzeExposureProfile(data) {
    const profile = {
      exposureCount: 0,
      presumptiveExposures: [],
      exposuresByType: {},
      totalDuration: null
    };

    if (!data.serviceLineExposures || data.serviceLineExposures.length === 0) {
      return profile;
    }

    profile.exposureCount = data.serviceLineExposures.length;

    const presumptiveTypes = [
      'Agent Orange', 'Radiation', 'Burn Pit', 'IED', 'RPG',
      'Chemical Weapons', 'Biological'
    ];

    for (const exposure of data.serviceLineExposures) {
      profile.exposuresByType[exposure.exposureType] = 
        (profile.exposuresByType[exposure.exposureType] || 0) + 1;

      if (presumptiveTypes.includes(exposure.exposureType)) {
        profile.presumptiveExposures.push({
          type: exposure.exposureType,
          duration: exposure.durationOfExposure,
          location: exposure.locationOfExposure,
          documentation: exposure.documentationLevel
        });
      }
    }

    return profile;
  }

  /**
   * Identify presumptive conditions from diagnoses
   */
  identifyPresumptiveConditions(data) {
    const presumptive = {
      conditions: [],
      exposureBasedPresumptions: [],
      count: 0
    };

    const presumptiveConditionMap = {
      'Agent Orange': ['Diabetes', 'Ischemic Heart Disease', 'Parkinson-like', 'Respiratory', 'Chloracne'],
      'Radiation': ['Leukemia', 'Bone Cancer', 'Thyroid Cancer'],
      'Burn Pit': ['Respiratory', 'Gastrointestinal', 'Neurological'],
      'Gulf War': ['Undiagnosed Illness', 'Chronic Fatigue', 'Fibromyalgia']
    };

    if (!data.inServiceDiagnoses) {
      return presumptive;
    }

    for (const diagnosis of data.inServiceDiagnoses) {
      for (const [exposure, conditions] of Object.entries(presumptiveConditionMap)) {
        if (conditions.some(cond => diagnosis.diagnosisDescription.includes(cond))) {
          presumptive.conditions.push({
            diagnosis: diagnosis.diagnosisDescription,
            code: diagnosis.diagnosisCode,
            presumptiveExposure: exposure
          });
          presumptive.count++;
        }
      }
    }

    return presumptive;
  }

  /**
   * Build chronological timeline of service encounters
   */
  buildChronologicalTimeline(data) {
    const timeline = {
      encounters: [],
      startDate: null,
      endDate: null,
      totalEncounters: 0,
      avgMonthsBetweenEncounters: 0
    };

    if (!data.medicalEncounters || data.medicalEncounters.length === 0) {
      return timeline;
    }

    // Sort encounters chronologically
    const sorted = (data.medicalEncounters || [])
      .filter(e => e.encounterDate && !isNaN(Date.parse(e.encounterDate)))
      .sort((a, b) => new Date(a.encounterDate) - new Date(b.encounterDate));

    if (sorted.length === 0) {
      return timeline;
    }

    timeline.encounters = sorted;
    timeline.totalEncounters = sorted.length;
    timeline.startDate = sorted[0].encounterDate;
    timeline.endDate = sorted[sorted.length - 1].encounterDate;

    // Calculate average time between encounters
    if (sorted.length > 1) {
      const startMs = new Date(timeline.startDate).getTime();
      const endMs = new Date(timeline.endDate).getTime();
      const totalDays = (endMs - startMs) / (1000 * 60 * 60 * 24);
      const totalMonths = totalDays / 30.44;
      timeline.avgMonthsBetweenEncounters = (totalMonths / (sorted.length - 1)).toFixed(2);
    }

    return timeline;
  }
}

module.exports = STRScanner;
