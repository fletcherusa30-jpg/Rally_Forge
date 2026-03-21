'use strict';

const RatingDecisionValidator = require('../validators/rating_validators');

/**
 * Test Suite: VA Rating Decision Validators
 * Tests comprehensive validation pipeline for extracted rating data
 */

describe('RatingDecisionValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new RatingDecisionValidator({
      strictMode: true,
      logger: { info: () => {}, warn: () => {}, error: () => {} }
    });
  });

  describe('validateRatingDecision', () => {
    it('should validate complete rating decision output', () => {
      const validDecision = {
        _metadata: {
          scannerId: 'va-rater-001',
          decisionType: 'Initial',
          combinedRating: 50
        },
        combinedRating: {
          percentage: 50,
          calculationMethod: 'VA Schedule 38 CFR §4.25'
        },
        serviceConnectedConditions: [
          {
            conditionName: 'PTSD',
            diagnosticCode: '307001',
            currentRatingPercentage: 40,
            effectiveDate: '2023-01-15',
            serviceConnected: true
          },
          {
            conditionName: 'Lower Back Strain',
            diagnosticCode: '846000',
            currentRatingPercentage: 20,
            effectiveDate: '2023-01-15',
            serviceConnected: true
          }
        ]
      };

      const result = validator.validateRatingDecision(validDecision);

      expect(result.isValid).toBe(true);
      expect(result.status).toBe('PASS');
      expect(result.errors).toBeUndefined();
    });

    it('should fail when metadata is missing', () => {
      const invalidDecision = {
        combinedRating: { percentage: 50 },
        serviceConnectedConditions: []
      };

      const result = validator.validateRatingDecision(invalidDecision);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing _metadata object');
    });

    it('should fail when service-connected conditions are missing', () => {
      const invalidDecision = {
        _metadata: {
          scannerId: 'va-rater-001',
          decisionType: 'Initial'
        },
        combinedRating: { percentage: 50 }
      };

      const result = validator.validateRatingDecision(invalidDecision);

      expect(result.isValid).toBe(false);
    });
  });

  describe('validateServiceConnectedConditions', () => {
    it('should detect duplicate conditions', () => {
      const conditions = [
        {
          conditionName: 'PTSD',
          diagnosticCode: '307001',
          currentRatingPercentage: 40,
          serviceConnected: true
        },
        {
          conditionName: 'PTSD',
          diagnosticCode: '307001',
          currentRatingPercentage: 40,
          serviceConnected: true
        }
      ];

      const result = validator.validateServiceConnectedConditions(conditions);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Duplicate condition');
    });

    it('should validate diagnostic code format', () => {
      const conditions = [
        {
          conditionName: 'PTSD',
          diagnosticCode: 'invalid',  // Invalid format
          currentRatingPercentage: 40,
          serviceConnected: true
        }
      ];

      const result = validator.validateServiceConnectedConditions(conditions);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid diagnostic code format');
    });

    it('should validate rating percentages', () => {
      const conditions = [
        {
          conditionName: 'PTSD',
          diagnosticCode: '307001',
          currentRatingPercentage: 45,  // Invalid - must be 0,10,20,30,40,50,60,70,80,90,100
          serviceConnected: true
        }
      ];

      const result = validator.validateServiceConnectedConditions(conditions);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid rating percentage');
    });
  });

  describe('validateCombinedRating', () => {
    it('should validate combined rating calculation', () => {
      const decision = {
        combinedRating: {
          percentage: 50,
          calculationMethod: 'VA Schedule'
        },
        serviceConnectedConditions: [
          {
            currentRatingPercentage: 40
          },
          {
            currentRatingPercentage: 20
          }
        ]
      };

      const result = validator.validateCombinedRating(decision);

      expect(result.isValid).toBe(true);
    });

    it('should detect missing combined rating', () => {
      const decision = {
        combinedRating: null,
        serviceConnectedConditions: []
      };

      const result = validator.validateCombinedRating(decision);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Missing combined rating');
    });
  });

  describe('validateSMC', () => {
    it('should validate SMC awards', () => {
      const smc = [
        {
          smcCode: 'A',
          effectiveDate: '2023-01-15',
          monthlyAmount: 150.00
        }
      ];

      const result = validator.validateSMC(smc);

      expect(result.isValid).toBe(true);
    });

    it('should reject invalid SMC codes', () => {
      const smc = [
        {
          smcCode: 'X',  // Invalid code
          effectiveDate: '2023-01-15',
          monthlyAmount: 150.00
        }
      ];

      const result = validator.validateSMC(smc);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid SMC code');
    });

    it('should reject negative monthly amounts', () => {
      const smc = [
        {
          smcCode: 'A',
          effectiveDate: '2023-01-15',
          monthlyAmount: -150.00
        }
      ];

      const result = validator.validateSMC(smc);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid SMC monthly amount');
    });
  });

  describe('validateBilateralFactor', () => {
    it('should validate bilateral factor application', () => {
      const decision = {
        bilateralFactor: {
          applicable: true,
          effectiveDate: '2023-01-15',
          affectedConditions: ['Left Knee', 'Right Knee']
        }
      };

      const result = validator.validateBilateralFactor(decision);

      expect(result.isValid).toBe(true);
    });

    it('should warn on minimal affected conditions', () => {
      const decision = {
        bilateralFactor: {
          applicable: true,
          effectiveDate: '2023-01-15',
          affectedConditions: ['Left Knee']
        }
      };

      const result = validator.validateBilateralFactor(decision);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
