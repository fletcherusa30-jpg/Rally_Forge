'use strict';

const combinedRatingCalculator = require('./combinedRatingCalculator');
const bilateralFactorCalculator = require('./bilateralFactorCalculator');
const backPayCalculator = require('./backPayCalculator');

/**
 * VA Rating Decision Validators
 * Implements comprehensive validation pipeline for extracted rating decision data
 */

class RatingDecisionValidator {
  constructor(config = {}) {
    this.logger = config.logger || { info: () => {}, warn: () => {}, error: () => {} };
    this.strictMode = config.strictMode !== false;
    this.diagnosticCodes = config.diagnosticCodes || {};
  }

  /**
   * Validate complete rating decision output
   * @param {Object} decisionOutput - Complete extracted rating decision
   * @returns {Object} {isValid: boolean, errors: Array, warnings: Array, results: Object}
   */
  validateRatingDecision(decisionOutput) {
    const errors = [];
    const warnings = [];
    const results = {};

    this.logger.info('Beginning rating decision validation');

    // Validate metadata
    if (!decisionOutput._metadata) {
      errors.push('Missing _metadata object');
    } else {
      const metaValidation = this.validateMetadata(decisionOutput._metadata);
      if (!metaValidation.isValid) {
        errors.push(...metaValidation.errors);
      }
      warnings.push(...metaValidation.warnings);
      results.metadata = metaValidation;
    }

    // Validate combined rating
    if (decisionOutput.combinedRating) {
      const crValidation = this.validateCombinedRating(decisionOutput);
      if (!crValidation.isValid) {
        errors.push(...crValidation.errors);
      }
      warnings.push(...crValidation.warnings);
      results.combinedRating = crValidation;
    }

    // Validate service-connected conditions
    if (decisionOutput.serviceConnectedConditions && Array.isArray(decisionOutput.serviceConnectedConditions)) {
      const scValidation = this.validateServiceConnectedConditions(decisionOutput.serviceConnectedConditions);
      if (!scValidation.isValid) {
        errors.push(...scValidation.errors);
      }
      warnings.push(...scValidation.warnings);
      results.serviceConnectedConditions = scValidation;
    }

    // Validate denied conditions
    if (decisionOutput.deniedConditions && Array.isArray(decisionOutput.deniedConditions)) {
      const deniedValidation = this.validateDeniedConditions(decisionOutput.deniedConditions);
      if (!deniedValidation.isValid && this.strictMode) {
        errors.push(...deniedValidation.errors);
      }
      warnings.push(...deniedValidation.warnings);
      results.deniedConditions = deniedValidation;
    }

    // Validate SMC if present
    if (decisionOutput.specialMonthlyCompensation && Array.isArray(decisionOutput.specialMonthlyCompensation)) {
      const smcValidation = this.validateSMC(decisionOutput.specialMonthlyCompensation);
      if (!smcValidation.isValid) {
        errors.push(...smcValidation.errors);
      }
      warnings.push(...smcValidation.warnings);
      results.smc = smcValidation;
    }

    // Validate bilateral factor if applicable
    if (decisionOutput.bilateralFactor && decisionOutput.bilateralFactor.applicable) {
      const bilateralValidation = this.validateBilateralFactor(decisionOutput);
      if (!bilateralValidation.isValid) {
        errors.push(...bilateralValidation.errors);
      }
      warnings.push(...bilateralValidation.warnings);
      results.bilateralFactor = bilateralValidation;
    }

    const isValid = errors.length === 0;
    this.logger.info(`Rating decision validation complete: ${isValid ? 'PASS' : 'FAIL'}`);

    return {
      isValid: isValid,
      status: isValid ? 'PASS' : 'FAIL',
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      results: results
    };
  }

  /**
   * Validate metadata fields
   */
  validateMetadata(metadata) {
    const errors = [];
    const warnings = [];

    if (!metadata.scannerId) {
      errors.push('Missing scannerId in metadata');
    }

    if (!metadata.decisionType) {
      errors.push('Missing decisionType in metadata');
    } else if (!['Initial', 'Rerate', 'Supplemental', 'Reduction', 'Assumed-Granted', 'Deferred'].includes(metadata.decisionType)) {
      warnings.push(`Unknown decision type: ${metadata.decisionType}`);
    }

    if (metadata.combinedRating !== undefined) {
      if (![0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].includes(metadata.combinedRating)) {
        errors.push(`Invalid combined rating in metadata: ${metadata.combinedRating}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate combined rating calculation
   */
  validateCombinedRating(decisionOutput) {
    const errors = [];
    const warnings = [];

    if (!decisionOutput.combinedRating || !decisionOutput.combinedRating.percentage) {
      errors.push('Missing combined rating percentage');
      return { isValid: false, errors, warnings };
    }

    const statedRating = decisionOutput.combinedRating.percentage;
    const individualRatings = (decisionOutput.serviceConnectedConditions || [])
      .map(c => c.currentRatingPercentage)
      .filter(r => r !== undefined && r !== null);

    if (individualRatings.length === 0) {
      warnings.push('Cannot validate combined rating - no individual ratings found');
      return { isValid: true, errors, warnings };
    }

    try {
      const validation = combinedRatingCalculator.validateCombinedRating(statedRating, individualRatings);
      
      if (!validation.isValid) {
        errors.push(`Combined rating validation failed: ${validation.details}`);
        warnings.push(`Stated: ${statedRating}%, Calculated: ${validation.calculatedRating}%`);
      }

      return {
        isValid: validation.isValid,
        errors,
        warnings,
        validation: validation
      };
    } catch (error) {
      errors.push(`Combined rating calculation error: ${error.message}`);
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * Validate service-connected conditions
   */
  validateServiceConnectedConditions(conditions) {
    const errors = [];
    const warnings = [];

    if (!Array.isArray(conditions) || conditions.length === 0) {
      errors.push('No service-connected conditions found');
      return { isValid: false, errors, warnings };
    }

    const seenConditions = new Set();

    for (let i = 0; i < conditions.length; i++) {
      const cond = conditions[i];

      // Check for duplicates
      const condKey = `${cond.conditionName}-${cond.diagnosticCode}`;
      if (seenConditions.has(condKey)) {
        errors.push(`Duplicate condition found: ${cond.conditionName} (DC ${cond.diagnosticCode})`);
      }
      seenConditions.add(condKey);

      // Validate DC format
      if (cond.diagnosticCode && !/^\d{6}$/.test(cond.diagnosticCode)) {
        errors.push(`Invalid diagnostic code format: ${cond.diagnosticCode}. Must be 6 digits.`);
      }

      // Validate rating percentage
      if (![0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].includes(cond.currentRatingPercentage)) {
        errors.push(`Invalid rating percentage for ${cond.conditionName}: ${cond.currentRatingPercentage}`);
      }

      // Validate effective date
      if (cond.effectiveDate && isNaN(Date.parse(cond.effectiveDate))) {
        errors.push(`Invalid effective date for ${cond.conditionName}: ${cond.effectiveDate}`);
      }

      // Check for service-connected flag
      if (cond.serviceConnected !== true) {
        warnings.push(`Service-connected flag not set for ${cond.conditionName}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      conditionCount: conditions.length
    };
  }

  /**
   * Validate denied conditions
   */
  validateDeniedConditions(conditions) {
    const errors = [];
    const warnings = [];

    for (const cond of conditions) {
      if (!cond.conditionName) {
        errors.push('Denied condition missing name');
      }

      if (!cond.denialReason) {
        warnings.push(`Denied condition missing reason: ${cond.conditionName}`);
      }

      if (!['not-service-connected', 'insufficient-evidence', 'already-rated', 'other'].includes(cond.denialReason)) {
        warnings.push(`Unknown denial reason: ${cond.denialReason}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      deniedCount: conditions.length
    };
  }

  /**
   * Validate SMC awards
   */
  validateSMC(smcArray) {
    const errors = [];
    const warnings = [];

    const validCodes = ['A', 'A1', 'A2', 'H', 'H1', 'H2', 'K', 'K1', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];

    for (const smc of smcArray) {
      if (!smc.smcCode) {
        errors.push('SMC missing code');
      } else if (!validCodes.includes(smc.smcCode)) {
        errors.push(`Invalid SMC code: ${smc.smcCode}`);
      }

      if (!smc.effectiveDate || isNaN(Date.parse(smc.effectiveDate))) {
        errors.push(`Invalid SMC effective date: ${smc.effectiveDate}`);
      }

      if (smc.monthlyAmount === undefined || typeof smc.monthlyAmount !== 'number' || smc.monthlyAmount < 0) {
        errors.push(`Invalid SMC monthly amount: ${smc.monthlyAmount}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      smcCount: smcArray.length
    };
  }

  /**
   * Validate bilateral factor application
   */
  validateBilateralFactor(decisionOutput) {
    const errors = [];
    const warnings = [];

    const bilateral = decisionOutput.bilateralFactor;
    if (!bilateral || !bilateral.applicable) {
      return { isValid: true, errors, warnings };
    }

    if (!bilateral.affectedConditions || bilateral.affectedConditions.length < 2) {
      warnings.push('Bilateral factor marked applicable but less than 2 affected conditions');
    }

    if (!bilateral.effectiveDate || isNaN(Date.parse(bilateral.effectiveDate))) {
      errors.push(`Invalid bilateral effective date: ${bilateral.effectiveDate}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = RatingDecisionValidator;
