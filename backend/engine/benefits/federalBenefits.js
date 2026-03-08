import { evaluateRuleSet } from "./ruleEvaluator.js";

export const evaluateFederalBenefits = (onboardingResult, rules, context) => {
  const data = { ...onboardingResult, facts: context.facts };
  const results = rules ? evaluateRuleSet(rules, data) : { items: [], notes: [] };

  return {
    category: "federal",
    rulesVersion: rules?.version || "unknown",
    items: results.items,
    notes: results.notes
  };
};

