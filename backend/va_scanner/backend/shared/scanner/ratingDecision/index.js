'use strict';

/**
 * VA Rating Decision Scanner Module
 * Exports comprehensive rating decision scanning, validation, and calculation infrastructure
 */

const VADecisionScanner = require('./vaDecisionScanner');
const RatingDecisionValidator = require('./validators/rating_validators');
const combinedRatingCalculator = require('./transforms/combinedRatingCalculator');
const bilateralFactorCalculator = require('./transforms/bilateralFactorCalculator');
const backPayCalculator = require('./transforms/backPayCalculator');

// Configuration loader
const loadConfig = () => {
  try {
    return require('./config.json');
  } catch (error) {
    return {
      version: '1.0.0',
      name: 'VA Rating Decision Scanner',
      schema: 'va-rating-decision-schema-v1'
    };
  }
};

// Public API
const ratingDecisionScanner = {
  // Main scanner class
  VADecisionScanner: VADecisionScanner,

  // Validator class
  RatingDecisionValidator: RatingDecisionValidator,

  // Transform modules
  calculators: {
    combinedRating: combinedRatingCalculator,
    bilateralFactor: bilateralFactorCalculator,
    backPay: backPayCalculator
  },

  // Factory methods
  createScanner: (config = {}) => {
    return new VADecisionScanner({
      ...loadConfig(),
      ...config
    });
  },

  createValidator: (config = {}) => {
    return new RatingDecisionValidator({
      ...loadConfig(),
      ...config
    });
  },

  // Utility functions
  validateDecision: (data, config) => {
    const validator = new RatingDecisionValidator(config);
    return validator.validateRatingDecision(data);
  },

  processDecision: async (data, config) => {
    const scanner = new VADecisionScanner(config);
    return scanner.processRatingDecision(data);
  },

  getConfig: loadConfig
};

module.exports = ratingDecisionScanner;
