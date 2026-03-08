/**
 * Compensation Service Regression Tests
 * 
 * Validates that ratingMonthly values returned by the compensation service
 * match expected values from the RATE DATABASE for all rating levels (10-100).
 * 
 * This prevents unintended changes to compensation calculations during refactoring.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import CompensationEngine from '../../compensation-engine/index.js';

// Expected ratingMonthly values for 2025 (from RATE DATABASE)
// These are base veteran-only amounts (no dependents, no SMC)
const EXPECTED_2025_RATING_MONTHLY = {
  10: 193.10,
  20: 386.20,
  30: 531.90,
  40: 765.20,
  50: 1093.10,
  60: 1384.80,
  70: 1792.70,
  80: 2274.90,
  90: 2759.80,
  100: 4782.12
};

// Expected ratingMonthly values for 2026 (from RATE DATABASE - official VA rates corrected)
const EXPECTED_2026_RATING_MONTHLY = {
  10: 171.23,
  20: 338.49,
  30: 524.31,
  40: 755.28,
  50: 1075.16,
  60: 1361.88,
  70: 1716.28,
  80: 1995.01,
  90: 2241.91,
  100: 3737.85
};

describe('Compensation Engine - Rating Monthly Regression Tests', () => {
  describe('2025 Base Compensation Rates', () => {
    for (const [rating, expectedAmount] of Object.entries(EXPECTED_2025_RATING_MONTHLY)) {
      it(`should return correct ratingMonthly for ${rating}% in 2025`, () => {
        const quote = CompensationEngine.calculateVeteranCompensation({
          rating: Number(rating),
          effectiveDate: '2025-01-01',
          dependents: { spouse: 0, children: 0, parents: 0 }
        });

        const actualAmount = quote.breakdown.baseMonthly;
        
        // Use approximate equality for monetary values (within 1 cent)
        assert.ok(
          Math.abs(actualAmount - expectedAmount) < 0.01,
          `Expected ${rating}% to return $${expectedAmount}, but got $${actualAmount}`
        );
      });
    }
  });

  describe('2026 Base Compensation Rates', () => {
    for (const [rating, expectedAmount] of Object.entries(EXPECTED_2026_RATING_MONTHLY)) {
      it(`should return correct ratingMonthly for ${rating}% in 2026`, () => {
        const quote = CompensationEngine.calculateVeteranCompensation({
          rating: Number(rating),
          effectiveDate: '2026-01-01',
          dependents: { spouse: 0, children: 0, parents: 0 }
        });

        const actualAmount = quote.breakdown.baseMonthly;
        
        assert.ok(
          Math.abs(actualAmount - expectedAmount) < 0.01,
          `Expected ${rating}% to return $${expectedAmount}, but got $${actualAmount}`
        );
      });
    }
  });

  describe('Boundary Validation', () => {
    it('should reject invalid ratings below 10%', () => {
      assert.throws(() => {
        CompensationEngine.calculateVeteranCompensation({
          rating: 5,
          effectiveDate: '2026-01-01',
          dependents: { spouse: 0, children: 0, parents: 0 }
        });
      });
    });

    it('should reject invalid ratings above 100%', () => {
      assert.throws(() => {
        CompensationEngine.calculateVeteranCompensation({
          rating: 110,
          effectiveDate: '2026-01-01',
          dependents: { spouse: 0, children: 0, parents: 0 }
        });
      });
    });

    it('should reject non-10-increment ratings', () => {
      assert.throws(() => {
        CompensationEngine.calculateVeteranCompensation({
          rating: 55,
          effectiveDate: '2026-01-01',
          dependents: { spouse: 0, children: 0, parents: 0 }
        });
      });
    });
  });

  describe('Year Boundary Validation', () => {
    it('should handle year boundaries correctly (2024-12-31)', () => {
      const quote = CompensationEngine.calculateVeteranCompensation({
        rating: 100,
        effectiveDate: '2024-12-31',
        dependents: { spouse: 0, children: 0, parents: 0 }
      });

      // Should use 2024 rates, not 2025
      assert.ok(quote.breakdown.baseMonthly > 0);
      assert.notEqual(quote.breakdown.baseMonthly, EXPECTED_2025_RATING_MONTHLY[100]);
    });

    it('should handle year boundaries correctly (2025-01-01)', () => {
      const quote = CompensationEngine.calculateVeteranCompensation({
        rating: 100,
        effectiveDate: '2025-01-01',
        dependents: { spouse: 0, children: 0, parents: 0 }
      });

      // Should use 2025 rates
      assert.ok(
        Math.abs(quote.breakdown.baseMonthly - EXPECTED_2025_RATING_MONTHLY[100]) < 0.01
      );
    });

    it('should handle year boundaries correctly (2026-01-01)', () => {
      const quote = CompensationEngine.calculateVeteranCompensation({
        rating: 100,
        effectiveDate: '2026-01-01',
        dependents: { spouse: 0, children: 0, parents: 0 }
      });

      // Should use 2026 rates
      assert.ok(
        Math.abs(quote.breakdown.baseMonthly - EXPECTED_2026_RATING_MONTHLY[100]) < 0.01
      );
    });
  });

  describe('Dependent Profile Isolation', () => {
    it('should return only baseMonthly when no dependents specified', () => {
      const quote = CompensationEngine.calculateVeteranCompensation({
        rating: 70,
        effectiveDate: '2026-01-01',
        dependents: { spouse: 0, children: 0, parents: 0 }
      });

      assert.equal(quote.breakdown.dependentMonthly, 0);
      assert.equal(quote.breakdown.baseMonthly, quote.summary.totalMonthly);
      assert.ok(Math.abs(quote.breakdown.baseMonthly - EXPECTED_2026_RATING_MONTHLY[70]) < 0.01);
    });

    it('should add dependent amounts on top of baseMonthly when children present', () => {
      const quoteWithoutDependents = CompensationEngine.calculateVeteranCompensation({
        rating: 30,
        effectiveDate: '2026-01-01',
        dependents: { spouse: 0, children: 0, parents: 0 }
      });

      const quoteWithChildren = CompensationEngine.calculateVeteranCompensation({
        rating: 30,
        effectiveDate: '2026-01-01',
        dependents: { spouse: 0, children: 1, parents: 0 }
      });

      // Base should remain the same
      assert.equal(
        quoteWithoutDependents.breakdown.baseMonthly,
        quoteWithChildren.breakdown.baseMonthly
      );

      // Total should be higher with children
      assert.ok(quoteWithChildren.summary.totalMonthly > quoteWithoutDependents.summary.totalMonthly);
      assert.ok(quoteWithChildren.breakdown.dependentMonthly > 0);
    });
  });
});

