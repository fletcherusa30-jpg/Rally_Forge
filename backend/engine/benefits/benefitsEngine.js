import { getRules } from "../rulesLoader.js";
import { evaluateFederalBenefits } from "./federalBenefits.js";
import { evaluateStateBenefits } from "./stateBenefits.js";
import { evaluateCombatBenefits } from "./combatBenefits.js";
import { evaluateExposureBenefits } from "./exposureBenefits.js";
import { evaluateRatingBenefits } from "./ratingBenefits.js";
import { evaluateRetirementBenefits } from "./retirementBenefits.js";

export const computeBenefits = async (onboardingResult, options = {}) => {
  const [federalRules, stateRules, combatRules, exposureRules, ratingRules, retirementRules] = await Promise.all([
    getRules("federal"),
    getRules("state"),
    getRules("combat"),
    getRules("exposure"),
    getRules("rating"),
    getRules("retirement")
  ]);

  const context = {
    now: new Date(),
    logger: options.logger || console,
    requestId: options.requestId || null
  };

  const federal = evaluateFederalBenefits(onboardingResult, federalRules, context);
  const state = evaluateStateBenefits(onboardingResult, stateRules, context);
  const combat = evaluateCombatBenefits(onboardingResult, combatRules, context);
  const exposure = evaluateExposureBenefits(onboardingResult, exposureRules, context);
  const rating = evaluateRatingBenefits(onboardingResult, ratingRules, context);
  const retirement = evaluateRetirementBenefits(onboardingResult, retirementRules, context);

  return {
    federal,
    state,
    combat,
    exposure,
    rating,
    retirement,
    metadata: {
      computedAt: context.now.toISOString(),
      ruleVersions: {
        federal: federalRules?.version || "unknown",
        state: stateRules?.version || "unknown",
        combat: combatRules?.version || "unknown",
        exposure: exposureRules?.version || "unknown",
        rating: ratingRules?.version || "unknown",
        retirement: retirementRules?.version || "unknown"
      }
    }
  };
};
