/**
 * Dependent Calculation Validation Tests
 * 
 * Validates that dependent tier calculations are explicit, reproducible,
 * and match expected values from the RATE DATABASE.
 * 
 * Tests different dependent profiles:
 * - Spouse alone (no additional benefit at most ratings)
 * - Children with spouse (higher tier)
 * - Children without spouse (lower tier)
 * - Parents with spouse
 * - Parents without spouse
 * - Multiple dependents
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import CompensationEngine from '../../compensation-engine/index.js';

// 2026 Dependent Rates (from RATE DATABASE - knowledge/RATE_DATABASE/YEARS/2026.json)
// Official VA rates corrected to match standard VA disability compensation tables
const DEPENDENT_RATES_2026 = {
  spouse: {
    first_child: 83,
    each_additional_child: 83,
    first_parent: 125,
    each_additional_parent: 125
  },
  no_spouse: {
    first_child: 62,
    each_additional_child: 62,
    first_parent: 125,
    each_additional_parent: 125
  }
};

const BASE_RATE_70_PCT = 1716.28;
const EFFECTIVE_DATE = '2026-01-01';

describe('Dependent Calculation Validation Tests', () => {
  describe('Spouse Tier (with spouse) - Children', () => {
    it('should add first_child bonus for 1 child with spouse', () => {
      const quote = CompensationEngine.calculateVeteranCompensation({
        rating: 70,
        effectiveDate: EFFECTIVE_DATE,
        dependents: { spouse: 1, children: 1, parents: 0 }
      });

      // Engine uses bundled withSpouseAndOneChildRates which includes first child
      // No additional children, so dependentMonthly is 0 (only additional children beyond 1st are bonuses)
      const expectedTotal = 1944.28; // withSpouseAndOneChildRates[70] from rate table
      const expectedDependent = 0; // First child already included in bundled rate
      
      assert.ok(
        Math.abs(quote.summary.totalMonthly - expectedTotal) < 0.01,
        `Expected ${expectedTotal}, got ${quote.summary.totalMonthly}`
      );
      assert.equal(quote.breakdown.dependentMonthly, expectedDependent);
    });

    it('should add first_child + additional_child for 2 children with spouse', () => {
      const quote = CompensationEngine.calculateVeteranCompensation({
        rating: 70,
        effectiveDate: EFFECTIVE_DATE,
        dependents: { spouse: 1, children: 2, parents: 0 }
      });

      // Engine uses bundled withSpouseAndOneChildRates + bonus for each additional child beyond 1st
      const expectedAdditionalChildBonus = DEPENDENT_RATES_2026.spouse.each_additional_child;
      const expectedTotal = 1944.28 + expectedAdditionalChildBonus; // 1944.28 is bundled rate
      
      assert.ok(
        Math.abs(quote.summary.totalMonthly - expectedTotal) < 0.01,
        `Expected ${expectedTotal}, got ${quote.summary.totalMonthly}`
      );
      assert.equal(quote.breakdown.dependentMonthly, expectedAdditionalChildBonus);
    });

    it('should calculate correctly for 3 children with spouse', () => {
      const quote = CompensationEngine.calculateVeteranCompensation({
        rating: 70,
        effectiveDate: EFFECTIVE_DATE,
        dependents: { spouse: 1, children: 3, parents: 0 }
      });

      // Engine uses bundled withSpouseAndOneChildRates + bonus for 2 additional children
      const expectedAdditionalChildBonus = 2 * DEPENDENT_RATES_2026.spouse.each_additional_child;
      const expectedTotal = 1944.28 + expectedAdditionalChildBonus;
      
      assert.ok(
        Math.abs(quote.summary.totalMonthly - expectedTotal) < 0.01,
        `Expected ${expectedTotal}, got ${quote.summary.totalMonthly}`
      );
      assert.equal(quote.breakdown.dependentMonthly, expectedAdditionalChildBonus);
    });
  });

  describe('No Spouse Tier - Children', () => {
    it('should add first_child bonus (no_spouse tier) for 1 child without spouse', () => {
      const quote = CompensationEngine.calculateVeteranCompensation({
        rating: 70,
        effectiveDate: EFFECTIVE_DATE,
        dependents: { spouse: 0, children: 1, parents: 0 }
      });

      const expectedTotal = BASE_RATE_70_PCT + DEPENDENT_RATES_2026.no_spouse.first_child;
      
      assert.ok(
        Math.abs(quote.summary.totalMonthly - expectedTotal) < 0.01,
        `Expected ${expectedTotal}, got ${quote.summary.totalMonthly}`
      );
      assert.equal(quote.breakdown.dependentMonthly, DEPENDENT_RATES_2026.no_spouse.first_child);
    });

    it('should add first_child + additional_child for 2 children without spouse', () => {
      const quote = CompensationEngine.calculateVeteranCompensation({
        rating: 70,
        effectiveDate: EFFECTIVE_DATE,
        dependents: { spouse: 0, children: 2, parents: 0 }
      });

      const expectedDependent = DEPENDENT_RATES_2026.no_spouse.first_child 
        + DEPENDENT_RATES_2026.no_spouse.each_additional_child;
      const expectedTotal = BASE_RATE_70_PCT + expectedDependent;
      
      assert.ok(
        Math.abs(quote.summary.totalMonthly - expectedTotal) < 0.01,
        `Expected ${expectedTotal}, got ${quote.summary.totalMonthly}`
      );
      assert.equal(quote.breakdown.dependentMonthly, expectedDependent);
    });
  });

  describe('Spouse Tier (with spouse) - Parents', () => {
    it('should add first_parent bonus for 1 parent with spouse', () => {
      const quote = CompensationEngine.calculateVeteranCompensation({
        rating: 70,
        effectiveDate: EFFECTIVE_DATE,
        dependents: { spouse: 1, children: 0, parents: 1 }
      });

      // Engine uses withSpouseRates when spouse but no children, then adds parent bonuses
      const expectedParentBonus = DEPENDENT_RATES_2026.spouse.first_parent;
      const expectedTotal = 1861.28 + expectedParentBonus; // 1861.28 is withSpouseRates[70]
      
      assert.ok(
        Math.abs(quote.summary.totalMonthly - expectedTotal) < 0.01,
        `Expected ${expectedTotal}, got ${quote.summary.totalMonthly}`
      );
      assert.equal(quote.breakdown.dependentMonthly, expectedParentBonus);
    });

    it('should add first_parent + additional_parent for 2 parents with spouse', () => {
      const quote = CompensationEngine.calculateVeteranCompensation({
        rating: 70,
        effectiveDate: EFFECTIVE_DATE,
        dependents: { spouse: 1, children: 0, parents: 2 }
      });

      const expectedDependent = DEPENDENT_RATES_2026.spouse.first_parent 
        + DEPENDENT_RATES_2026.spouse.each_additional_parent;
      const expectedTotal = 1861.28 + expectedDependent; // 1861.28 is withSpouseRates[70]
      
      assert.ok(
        Math.abs(quote.summary.totalMonthly - expectedTotal) < 0.01,
        `Expected ${expectedTotal}, got ${quote.summary.totalMonthly}`
      );
      assert.equal(quote.breakdown.dependentMonthly, expectedDependent);
    });
  });

  describe('No Spouse Tier - Parents', () => {
    it('should add first_parent bonus (no_spouse tier) for 1 parent without spouse', () => {
      const quote = CompensationEngine.calculateVeteranCompensation({
        rating: 70,
        effectiveDate: EFFECTIVE_DATE,
        dependents: { spouse: 0, children: 0, parents: 1 }
      });

      const expectedTotal = BASE_RATE_70_PCT + DEPENDENT_RATES_2026.no_spouse.first_parent;
      
      assert.ok(
        Math.abs(quote.summary.totalMonthly - expectedTotal) < 0.01,
        `Expected ${expectedTotal}, got ${quote.summary.totalMonthly}`
      );
      assert.equal(quote.breakdown.dependentMonthly, DEPENDENT_RATES_2026.no_spouse.first_parent);
    });

    it('should add first_parent + additional_parent for 2 parents without spouse', () => {
      const quote = CompensationEngine.calculateVeteranCompensation({
        rating: 70,
        effectiveDate: EFFECTIVE_DATE,
        dependents: { spouse: 0, children: 0, parents: 2 }
      });

      const expectedDependent = DEPENDENT_RATES_2026.no_spouse.first_parent 
        + DEPENDENT_RATES_2026.no_spouse.each_additional_parent;
      const expectedTotal = BASE_RATE_70_PCT + expectedDependent;
      
      assert.ok(
        Math.abs(quote.summary.totalMonthly - expectedTotal) < 0.01,
        `Expected ${expectedTotal}, got ${quote.summary.totalMonthly}`
      );
      assert.equal(quote.breakdown.dependentMonthly, expectedDependent);
    });
  });

  describe('Combined Dependents', () => {
    it('should correctly calculate 1 child + 1 parent with spouse', () => {
      const quote = CompensationEngine.calculateVeteranCompensation({
        rating: 70,
        effectiveDate: EFFECTIVE_DATE,
        dependents: { spouse: 1, children: 1, parents: 1 }
      });

      // Engine uses bundled withSpouseAndOneChildRates + parent bonus
      const expectedParentBonus = DEPENDENT_RATES_2026.spouse.first_parent;
      const expectedTotal = 1944.28 + expectedParentBonus; // 1944.28 is withSpouseAndOneChildRates[70]
      
      assert.ok(
        Math.abs(quote.summary.totalMonthly - expectedTotal) < 0.01,
        `Expected ${expectedTotal}, got ${quote.summary.totalMonthly}`
      );
      assert.equal(quote.breakdown.dependentMonthly, expectedParentBonus);
    });

    it('should correctly calculate 2 children + 2 parents with spouse', () => {
      const quote = CompensationEngine.calculateVeteranCompensation({
        rating: 70,
        effectiveDate: EFFECTIVE_DATE,
        dependents: { spouse: 1, children: 2, parents: 2 }
      });

      // Engine uses bundled withSpouseAndOneChildRates + 1 additional child bonus + 2 parent bonuses
      const expectedAdditionalChild = DEPENDENT_RATES_2026.spouse.each_additional_child;
      const expectedParents = DEPENDENT_RATES_2026.spouse.first_parent 
        + DEPENDENT_RATES_2026.spouse.each_additional_parent;
      const expectedDependent = expectedAdditionalChild + expectedParents;
      const expectedTotal = 1944.28 + expectedDependent; // 1944.28 is withSpouseAndOneChildRates[70]
      
      assert.ok(
        Math.abs(quote.summary.totalMonthly - expectedTotal) < 0.01,
        `Expected ${expectedTotal}, got ${quote.summary.totalMonthly}`
      );
      assert.equal(quote.breakdown.dependentMonthly, expectedDependent);
    });

    it('should correctly calculate 1 child + 1 parent without spouse', () => {
      const quote = CompensationEngine.calculateVeteranCompensation({
        rating: 70,
        effectiveDate: EFFECTIVE_DATE,
        dependents: { spouse: 0, children: 1, parents: 1 }
      });

      const expectedDependent = DEPENDENT_RATES_2026.no_spouse.first_child 
        + DEPENDENT_RATES_2026.no_spouse.first_parent;
      const expectedTotal = BASE_RATE_70_PCT + expectedDependent;
      
      assert.ok(
        Math.abs(quote.summary.totalMonthly - expectedTotal) < 0.01,
        `Expected ${expectedTotal}, got ${quote.summary.totalMonthly}`
      );
      assert.equal(quote.breakdown.dependentMonthly, expectedDependent);
    });
  });

  describe('Tier Difference Validation', () => {
    it('should provide higher benefits with spouse vs without for same children count', () => {
      const withSpouse = CompensationEngine.calculateVeteranCompensation({
        rating: 70,
        effectiveDate: EFFECTIVE_DATE,
        dependents: { spouse: 1, children: 1, parents: 0 }
      });

      const withoutSpouse = CompensationEngine.calculateVeteranCompensation({
        rating: 70,
        effectiveDate: EFFECTIVE_DATE,
        dependents: { spouse: 0, children: 1, parents: 0 }
      });

      // Total should be significantly higher with spouse
      assert.ok(withSpouse.summary.totalMonthly > withoutSpouse.summary.totalMonthly);
      
      // With spouse uses bundled withSpouseAndOneChildRates, without spouse uses base + child bonus
      // Expected: with spouse $1944.28, without spouse $1716.28 + $62 = $1778.28
      const expectedWithSpouse = 1944.28;
      const expectedWithoutSpouse = 1716.28 + 62;
      
      assert.ok(Math.abs(withSpouse.summary.totalMonthly - expectedWithSpouse) < 0.01);
      assert.ok(Math.abs(withoutSpouse.summary.totalMonthly - expectedWithoutSpouse) < 0.01);
    });
  });

  describe('Reproducibility Tests', () => {
    it('should return identical results for identical inputs', () => {
      const input = {
        rating: 70,
        effectiveDate: EFFECTIVE_DATE,
        dependents: { spouse: 1, children: 2, parents: 1 }
      };

      const result1 = CompensationEngine.calculateVeteranCompensation(input);
      const result2 = CompensationEngine.calculateVeteranCompensation(input);

      assert.deepEqual(result1, result2, 'Results should be identical for identical inputs');
    });

    it('should be deterministic across multiple calls', () => {
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(CompensationEngine.calculateVeteranCompensation({
          rating: 70,
          effectiveDate: EFFECTIVE_DATE,
          dependents: { spouse: 1, children: 1, parents: 1 }
        }));
      }

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        assert.deepEqual(results[0], results[i], `Result ${i} differs from result 0`);
      }
    });
  });
});

