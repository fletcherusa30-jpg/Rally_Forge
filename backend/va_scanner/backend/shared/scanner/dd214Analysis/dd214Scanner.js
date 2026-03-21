'use strict';

const DD214Validators = require('./validators/dd214_validators');

/**
 * DD-214 Discharge Paper Scanner - Main Entry Point
 * Orchestrates deterministic extraction and validation of service history
 */

class DD214Scanner {
  constructor(config = {}) {
    this.config = config;
    this.validators = new DD214Validators(config);
    this.logger = config.logger || { info: () => {}, warn: () => {}, error: () => {} };
  }

  /**
   * Scan and validate DD-214 extraction
   * @param {Object} extractedData - Raw extracted DD-214 data
   * @returns {Object} {success: boolean, data: Object, validation: Object}
   */
  async scanDD214(extractedData) {
    this.logger.info('Processing DD-214 extraction');

    try {
      // Perform deterministic validation
      const validation = this.validators.validateDD214Extraction(extractedData);

      if (!validation.isValid) {
        return {
          success: false,
          data: extractedData,
          validation: validation,
          errors: validation.errors
        };
      }

      // Post-processing: standardize fields
      const standardized = this.standardizeDD214Data(extractedData);

      // Calculate tenure metrics
      const metrics = this.calculateTenureMetrics(standardized);

      return {
        success: true,
        data: standardized,
        validation: validation,
        metrics: metrics,
        warnings: validation.warnings
      };
    } catch (error) {
      this.logger.error(`DD-214 processing error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Standardize DD-214 field formats
   */
  standardizeDD214Data(data) {
    const standardized = { ...data };

    // Standardize rank abbreviations
    if (standardized.payGradeRank && standardized.payGradeRank.rank) {
      standardized.payGradeRank.rank = standardized.payGradeRank.rank.toUpperCase();
    }

    // Standardize branch names
    if (standardized.personalInfo && standardized.personalInfo.branch) {
      const branchMap = {
        'Army': 'United States Army',
        'Navy': 'United States Navy',
        'Air Force': 'United States Air Force',
        'Marines': 'United States Marine Corps',
        'Coast Guard': 'United States Coast Guard',
        'Space Force': 'United States Space Force'
      };
      standardized.personalInfo.branch = branchMap[standardized.personalInfo.branch] || standardized.personalInfo.branch;
    }

    // Standardize character of service
    if (standardized.characterOfService && standardized.characterOfService.character) {
      standardized.characterOfService.character = standardized.characterOfService.character.trim();
    }

    return standardized;
  }

  /**
   * Calculate service tenure metrics
   */
  calculateTenureMetrics(data) {
    const metrics = {};

    if (data.serviceDates && data.serviceDates.activeEntryDate && data.serviceDates.separationDate) {
      const entryDate = new Date(data.serviceDates.activeEntryDate);
      const sepDate = new Date(data.serviceDates.separationDate);

      const totalDays = (sepDate - entryDate) / (1000 * 60 * 60 * 24);
      const totalYears = totalDays / 365.25;
      const totalMonths = (totalYears % 1) * 12;

      metrics.totalDays = Math.round(totalDays);
      metrics.totalYears = Math.floor(totalYears);
      metrics.totalMonths = Math.round(totalMonths);
      metrics.totalServiceString = `${metrics.totalYears} years, ${metrics.totalMonths} months`;

      // Determine service category
      if (totalYears < 2) {
        metrics.serviceTerm = 'Initial Entry Training Period';
      } else if (totalYears < 4) {
        metrics.serviceTerm = 'First Enlistment';
      } else if (totalYears < 10) {
        metrics.serviceTerm = 'Mid-Career';
      } else if (totalYears < 20) {
        metrics.serviceTerm = 'Career Service';
      } else {
        metrics.serviceTerm = 'Long Service';
      }
    }

    return metrics;
  }
}

module.exports = DD214Scanner;
