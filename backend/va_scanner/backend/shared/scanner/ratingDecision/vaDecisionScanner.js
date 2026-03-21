'use strict';

const RatingDecisionValidator = require('./validators/rating_validators');
const combinedRatingCalculator = require('./transforms/combinedRatingCalculator');
const bilateralFactorCalculator = require('./transforms/bilateralFactorCalculator');
const backPayCalculator = require('./transforms/backPayCalculator');

/**
 * VA Rating Decision Scanner - Main Entry Point
 * Orchestrates extraction, validation, and calculation of service-connected ratings
 */

class VADecisionScanner {
  constructor(config = {}) {
    this.config = config;
    this.validator = new RatingDecisionValidator(config);
    this.logger = config.logger || { info: () => {}, warn: () => {}, error: () => {} };
  }

  /**
   * Process complete VA rating decision
   * @param {Object} extractedData - Raw extracted decision data
   * @returns {Object} {decision: Object, validation: Object, calculations: Object}
   */
  async processRatingDecision(extractedData) {
    this.logger.info('Processing VA rating decision extraction');

    try {
      // Validate extraction
      const validation = this.validator.validateRatingDecision(extractedData);

      if (!validation.isValid) {
        return {
          success: false,
          decision: extractedData,
          validation: validation,
          error: 'Validation failed',
          errorDetails: validation.errors
        };
      }

      // Perform calculations
      const calculations = this.performCalculations(extractedData);

      return {
        success: true,
        decision: extractedData,
        validation: validation,
        calculations: calculations
      };
    } catch (error) {
      this.logger.error(`Processing error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Perform all required calculations
   */
  performCalculations(decisionData) {
    const calculations = {};

    // Calculate combined rating
    if (decisionData.serviceConnectedConditions) {
      const individualRatings = decisionData.serviceConnectedConditions
        .map(c => c.currentRatingPercentage)
        .filter(r => r !== undefined && r !== null);

      if (individualRatings.length > 0) {
        try {
          calculations.combinedRating = combinedRatingCalculator.calculateCombinedRating(individualRatings);
          this.logger.info(`Combined rating calculated: ${calculations.combinedRating.combinedRating}%`);
        } catch (error) {
          calculations.combinedRatingError = error.message;
        }
      }
    }

    // Calculate bilateral factor if applicable
    const bilateralConditions = (decisionData.serviceConnectedConditions || [])
      .filter(c => ['Knee', 'Hip', 'Ankle', 'Foot', 'Hand', 'Arm', 'Leg'].some(part => c.conditionName.includes(part)));

    if (bilateralConditions.length >= 2) {
      try {
        const leftCondition = bilateralConditions.find(c => c.conditionName.toLowerCase().includes('left'));
        const rightCondition = bilateralConditions.find(c => c.conditionName.toLowerCase().includes('right'));

        if (leftCondition && rightCondition) {
          calculations.bilateralFactor = bilateralFactorCalculator.calculateBilateralFactor(
            leftCondition.currentRatingPercentage,
            rightCondition.currentRatingPercentage
          );
          this.logger.info(`Bilateral factor calculated: ${calculations.bilateralFactor.totalIncrease}%`);
        }
      } catch (error) {
        calculations.bilateralFactorError = error.message;
      }
    }

    // Calculate back pay if separation date available
    if (decisionData._metadata && decisionData._metadata.separationDate) {
      try {
        calculations.backPay = backPayCalculator.calculateBackPay({
          effectiveDate: decisionData._metadata.effectiveDate || new Date().toISOString().split('T')[0],
          decisionDate: decisionData._metadata.decisionDate || new Date().toISOString().split('T')[0],
          monthlyAmount: this.estimateMonthlyCompensation(decisionData),
          priorMonthlyAmount: decisionData._metadata.priorMonthlyAmount || 0
        });
        this.logger.info(`Back pay calculated: $${calculations.backPay.totalBackPay}`);
      } catch (error) {
        calculations.backPayError = error.message;
      }
    }

    return calculations;
  }

  /**
   * Estimate monthly compensation based on combined rating
   */
  estimateMonthlyCompensation(decisionData) {
    // Placeholder - in production would use actual VA compensation rates
    const ratingPercentages = (decisionData.serviceConnectedConditions || [])
      .map(c => c.currentRatingPercentage)
      .filter(r => r !== undefined);

    if (ratingPercentages.length === 0) return 0;

    const combinedRating = Math.max(...ratingPercentages);

    // Approximate monthly rates (as of 2024)
    const ratesByRating = {
      0: 0,
      10: 180,
      20: 360,
      30: 540,
      40: 780,
      50: 1200,
      60: 1500,
      70: 1900,
      80: 2300,
      90: 2700,
      100: 3737
    };

    return ratesByRating[combinedRating] || 0;
  }
}

module.exports = VADecisionScanner;
