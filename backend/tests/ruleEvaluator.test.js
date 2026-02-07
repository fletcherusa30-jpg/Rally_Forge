import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRuleSet, buildFacts } from "../engine/benefits/ruleEvaluator.js";

const baseRuleSet = {
  version: "1.0.0",
  effectiveDate: "2026-02-01",
  source: "test",
  metadata: { category: "unit" },
  rules: [
    {
      id: "rule-eq",
      description: "Branch is Army",
      conditions: [{ field: "branch", operator: "eq", value: "Army" }],
      outcomes: [{ title: "Army benefit" }]
    },
    {
      id: "rule-contains",
      description: "Theaters include Middle East",
      conditions: [{ field: "facts.theaters", operator: "contains", value: "Middle East" }],
      outcomes: [{ title: "Exposure review" }]
    },
    {
      id: "rule-gte",
      description: "Rating at least 50",
      conditions: [{ field: "disabilityRatingPercent", operator: "gte", value: 50 }],
      outcomes: [{ title: "Priority group" }]
    },
    {
      id: "rule-exists",
      description: "Has state",
      conditions: [{ field: "stateOfResidence", operator: "exists", value: true }],
      outcomes: [{ title: "State benefits" }]
    }
  ]
};

test("evaluateRuleSet returns matching outcomes", () => {
  const onboardingResult = {
    branch: "Army",
    disabilityRatingPercent: 60,
    stateOfResidence: "Texas",
    servicePeriods: [{ startDate: "2020-01-01", endDate: null, theater: "Middle East" }]
  };

  const facts = buildFacts(onboardingResult);
  const result = evaluateRuleSet(baseRuleSet, { ...onboardingResult, facts });

  assert.equal(result.items.length, 4);
  assert.ok(result.items.some((item) => item.title === "Army benefit"));
  assert.ok(result.items.some((item) => item.title === "Exposure review"));
});

test("evaluateRuleSet excludes non-matching rules", () => {
  const onboardingResult = {
    branch: "Navy",
    disabilityRatingPercent: 20,
    stateOfResidence: "Florida",
    servicePeriods: [{ startDate: "2015-01-01", endDate: "2020-01-01" }]
  };

  const facts = buildFacts(onboardingResult);
  const result = evaluateRuleSet(baseRuleSet, { ...onboardingResult, facts });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, "State benefits");
});

test("buildFacts derives theaters and activeService", () => {
  const onboardingResult = {
    servicePeriods: [
      { startDate: "2010-01-01", endDate: "2014-01-01", theater: "Europe" },
      { startDate: "2016-01-01", endDate: null, theater: "Pacific" }
    ]
  };

  const facts = buildFacts(onboardingResult);
  assert.deepEqual(facts.theaters.sort(), ["Europe", "Pacific"].sort());
  assert.equal(facts.activeService, true);
  assert.equal(facts.servicePeriodCount, 2);
});
