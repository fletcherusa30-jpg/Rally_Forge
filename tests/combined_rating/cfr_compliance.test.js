import assert from "node:assert/strict";
import test from "node:test";
import { getCombinedRating, getCombinedRatingRaw } from "../../frontend/js/vaCombinedRating.js";

/**
 * CFR Compliance Test Suite
 * 
 * These tests validate that the VA math engine follows 38 CFR § 4.25 exactly.
 * DO NOT modify these tests without explicit CFR citation justifying the change.
 */

test("§ 4.25: MUST round at each step, not floor", () => {
  // Test case from real VA decision letter (2017-12-15)
  // These ratings with bilateral factor produce raw combined 95% → round to 100%
  // If flooring is used instead of rounding, result would be 94% → round to 90% (WRONG)
  
  const ratings = [
    65, // Bilateral upper extremity with factor
    50, // Sleep apnea
    30, // Bilateral lower extremity with factor
    20, // Lumbar spine
    20, // Cervical spine
    10, // GERD
    10, // Tinnitus
    10  // Adjustment disorder
  ];
  
  const raw = getCombinedRatingRaw(ratings);
  const rounded = getCombinedRating(ratings);
  
  // § 4.25 requires rounding at each step → produces 95%
  assert.equal(raw, 95, "Raw combined must be 95% per § 4.25 (rounding at each step)");
  
  // § 4.25 requires rounding to nearest 10 → 95% rounds to 100%
  assert.equal(rounded, 100, "95% must round to 100% per § 4.25");
});

test("§ 4.25: Rounding at each step vs flooring produces different results", () => {
  // This test proves why rounding at each step matters
  const ratings = [20, 20, 20, 10, 10];
  
  // Correct § 4.25 implementation (round at each step):
  // 20 + 20 = 36 (exact) → 36
  // 36 + 20 = 48.8 (exact) → 49
  // 49 + 10 = 54.1 (exact) → 54
  // 54 + 10 = 58.6 (exact) → 59
  // Result: 59%
  
  const raw = getCombinedRatingRaw(ratings);
  assert.equal(raw, 59, "Must produce 59% with rounding at each step");
  
  // If flooring were used instead (WRONG):
  // 20 + 20 = 36.0 → 36
  // 36 + 20 = 48.8 → 48
  // 48 + 10 = 53.2 → 53
  // 53 + 10 = 57.7 → 57
  // Would produce: 57% (INCORRECT)
  
  assert.notEqual(raw, 57, "Must NOT produce 57% (that would indicate flooring)");
});

test("§ 4.25: Rounding to nearest 10 for final combined", () => {
  // Test rounding rules for final combined rating
  const testCases = [
    { raw: 0, final: 0 },
    { raw: 4, final: 0 },
    { raw: 5, final: 10 },    // 5 rounds UP
    { raw: 14, final: 10 },
    { raw: 15, final: 20 },   // 15 rounds UP
    { raw: 24, final: 20 },
    { raw: 25, final: 30 },   // 25 rounds UP
    { raw: 84, final: 80 },
    { raw: 85, final: 90 },   // 85 rounds UP
    { raw: 94, final: 90 },
    { raw: 95, final: 100 },  // 95 rounds UP
    { raw: 100, final: 100 }
  ];
  
  testCases.forEach(({ raw, final }) => {
    const rounded = getCombinedRating([raw]);
    assert.equal(rounded, final, `${raw}% must round to ${final}%`);
  });
});

test("§ 4.25: Zero and single rating edge cases", () => {
  // No compensable ratings
  assert.equal(getCombinedRatingRaw([]), 0);
  assert.equal(getCombinedRating([]), 0);
  
  // Single rating
  assert.equal(getCombinedRatingRaw([50]), 50);
  assert.equal(getCombinedRating([50]), 50);
  
  // All zero ratings
  assert.equal(getCombinedRatingRaw([0, 0, 0]), 0);
  assert.equal(getCombinedRating([0, 0, 0]), 0);
});

test("§ 4.25: Order independence (highest to lowest sorting)", () => {
  // VA math requires sorting highest to lowest first
  // Result should be same regardless of input order
  
  const unsorted = [10, 50, 20, 30];
  const sorted = [50, 30, 20, 10];
  const reversed = [10, 20, 30, 50];
  
  const raw1 = getCombinedRatingRaw(unsorted);
  const raw2 = getCombinedRatingRaw(sorted);
  const raw3 = getCombinedRatingRaw(reversed);
  
  assert.equal(raw1, raw2, "Order must not affect result");
  assert.equal(raw2, raw3, "Order must not affect result");
});

test("§ 4.25: Determinism - same input produces same output", () => {
  const ratings = [50, 30, 20, 10, 10];
  
  const results = [];
  for (let i = 0; i < 10; i++) {
    results.push(getCombinedRatingRaw(ratings));
  }
  
  const allSame = results.every(r => r === results[0]);
  assert.ok(allSame, "Must produce identical results for identical inputs");
});

test("§ 4.25: Maximum rating caps at 100", () => {
  // Even with many high ratings, cannot exceed 100%
  const ratings = [90, 90, 90, 90];
  
  const raw = getCombinedRatingRaw(ratings);
  const rounded = getCombinedRating(ratings);
  
  assert.ok(raw <= 100, "Raw combined cannot exceed 100");
  assert.ok(rounded <= 100, "Final combined cannot exceed 100");
  assert.equal(rounded, 100, "Should reach 100%");
});
