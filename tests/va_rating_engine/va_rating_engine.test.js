import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeLetterText,
  canonicalizeName,
  extractSide,
  classifyBodyGroup,
  generateConditionId,
  dedupeById,
  buildCombinedRatingResultFromConditions
} from "../../frontend/js/vaRatingEngine.js";

test("normalizeLetterText collapses whitespace and hyphens", () => {
  const input = "Service\u2014connection for  left knee\n\n  is granted.";
  const normalized = normalizeLetterText(input);
  assert.ok(normalized.includes("Service-connection for left knee"));
});

test("canonicalizeName maps variants to canonical names", () => {
  const canonical = canonicalizeName("Right wrist (dominant) scapholunate ligament derangement");
  assert.equal(canonical, "right wrist (dominant) scapholunate ligament derangement");
});

test("extractSide detects laterality and midline", () => {
  assert.equal(extractSide("left knee condition"), "left");
  assert.equal(extractSide("right shoulder condition"), "right");
  assert.equal(extractSide("bilateral knee pain"), "bilateral");
  assert.equal(extractSide("cervical spine degenerative arthritis"), "midline");
});

test("classifyBodyGroup detects upper/lower extremity", () => {
  assert.equal(classifyBodyGroup("right shoulder impingement", "right"), "upper_extremity");
  assert.equal(classifyBodyGroup("left knee pain", "left"), "lower_extremity");
  assert.equal(classifyBodyGroup("sleep apnea", "midline"), "midline");
});

test("generateConditionId is stable for same condition", () => {
  const condition = {
    canonicalName: "left knee pain",
    percent: 20,
    effectiveDate: "2020-01-01",
    bodyGroup: "lower_extremity",
    side: "left"
  };
  const first = generateConditionId(condition);
  const second = generateConditionId(condition);
  assert.equal(first, second);
});

test("dedupeById removes duplicate ids", () => {
  const debugTrace = [];
  const conditions = [
    { id: "c-1", name: "left knee" },
    { id: "c-1", name: "left knee" },
    { id: "c-2", name: "right knee" }
  ];
  const deduped = dedupeById(conditions, debugTrace);
  assert.equal(deduped.length, 2);
  assert.ok(debugTrace.some((line) => line.includes("Duplicate condition id")));
});

test("buildCombinedRatingResultFromConditions applies bilateral factor", () => {
  const conditions = [
    { name: "left knee", status: "SC", percent: 20 },
    { name: "right knee", status: "SC", percent: 20 },
    { name: "tinnitus", status: "SC", percent: 10 }
  ];

  const result = buildCombinedRatingResultFromConditions(conditions, { useBilateralFactor: true });
  assert.equal(result.usedBilateralFactor, true);
  assert.ok(result.rawCombined >= 40);
});

test("buildCombinedRatingResultFromConditions excludes NSC and denied from math", () => {
  const conditions = [
    { name: "back", status: "SC", percent: 50 },
    { name: "migraine", status: "Denied", percent: null },
    { name: "fatigue", status: "NSC", percent: null }
  ];

  const result = buildCombinedRatingResultFromConditions(conditions, { useBilateralFactor: false });
  assert.equal(result.roundedCombined, 50);
});
