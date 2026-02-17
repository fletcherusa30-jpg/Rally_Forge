import assert from "node:assert/strict";
import test from "node:test";
import { buildEffectiveRatingsFromConditions, getCombinedRating, getCombinedRatingRaw } from "../../frontend/js/vaCombinedRating.js";

test("getCombinedRating uses VA math and rounds to nearest 10", () => {
  const rounded = getCombinedRating([50, 20]);
  assert.equal(rounded, 60);

  const raw = getCombinedRatingRaw([50, 20]);
  assert.ok(raw > 59 && raw < 61);
});

test("combined rating ignores 0% evaluations", () => {
  const rounded = getCombinedRating([50, 0, 20, 0]);
  assert.equal(rounded, 60);
});

test("combined ratings table for provided list", () => {
  const ratings = [
    50,
    20, 20, 20, 20,
    10, 10, 10, 10, 10, 10, 10, 10, 10
  ];

  const raw = getCombinedRatingRaw(ratings);
  const rounded = getCombinedRating(ratings);
  assert.ok(raw >= 89 && raw < 93, `Expected raw between 89-93, got ${raw}`);
  assert.equal(rounded, 90);
});

test("combined rating dedupes by condition identity", () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(String(message));

  const entries = [
    { id: "c-1", condition: "left knee", percentage: 20 },
    { id: "c-1", condition: "left knee", percentage: 20 },
    { id: "c-2", condition: "right knee", percentage: 20 }
  ];

  const effectiveRatings = buildEffectiveRatingsFromConditions(entries);
  assert.equal(effectiveRatings.length, 2);
  assert.equal(getCombinedRating(effectiveRatings), 40);
  assert.ok(warnings.some((message) => message.includes("Duplicate condition")));

  console.warn = originalWarn;
});

test("same percentage with different IDs is kept", () => {
  const entries = [
    { id: "c-1", condition: "left knee", percentage: 20 },
    { id: "c-2", condition: "right knee", percentage: 20 }
  ];

  const effectiveRatings = buildEffectiveRatingsFromConditions(entries);
  assert.equal(effectiveRatings.length, 2);
  assert.equal(getCombinedRating(effectiveRatings), 40);
});

test("NSC and denied conditions are excluded from math", () => {
  const entries = [
    { id: "c-1", condition: "back", percentage: 50, status: "service_connected" },
    { id: "c-2", condition: "migraine", percentage: 30, status: "denied" },
    { id: "c-3", condition: "fatigue", percentage: 20, rating: "NSC" }
  ];

  const effectiveRatings = buildEffectiveRatingsFromConditions(entries);
  const rounded = getCombinedRating(effectiveRatings);
  assert.equal(rounded, 50);
});

test("combined rating with unique condition IDs reaches 100", () => {
  const entries = [
    { id: "c-1", condition: "sleep apnea", percentage: 50 },
    { id: "c-2", condition: "right shoulder osteoarthritis", percentage: 50 },
    { id: "c-3", condition: "left knee", percentage: 20 },
    { id: "c-4", condition: "right knee", percentage: 20 },
    { id: "c-5", condition: "left ankle", percentage: 20 },
    { id: "c-6", condition: "right ankle", percentage: 20 },
    { id: "c-7", condition: "neck", percentage: 20 },
    { id: "c-8", condition: "right sciatic nerve", percentage: 20 },
    { id: "c-9", condition: "right arm radiculopathy", percentage: 20 },
    { id: "c-10", condition: "lumbar fusion", percentage: 20 },
    { id: "c-11", condition: "cervical fusion", percentage: 20 },
    { id: "c-12", condition: "right clavicle", percentage: 10 },
    { id: "c-13", condition: "right wrist", percentage: 10 },
    { id: "c-14", condition: "left patellofemoral", percentage: 10 },
    { id: "c-15", condition: "tinnitus", percentage: 10 },
    { id: "c-16", condition: "gastroesophageal reflux", percentage: 10 },
    { id: "c-17", condition: "right sciatic nerve (secondary)", percentage: 10 },
    { id: "c-18", condition: "adjustment disorder", percentage: 10 },
    { id: "c-19", condition: "right foot hammer toes", percentage: 10 },
    { id: "c-20", condition: "surgical scars", percentage: 10 },
    { id: "c-21", condition: "laceration scars", percentage: 10 },
    { id: "c-22", condition: "hypertension", percentage: 0 }
  ];

  const effectiveRatings = buildEffectiveRatingsFromConditions(entries);
  const rounded = getCombinedRating(effectiveRatings);
  assert.equal(rounded, 100);
});
