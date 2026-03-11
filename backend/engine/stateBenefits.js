/**
 * ⚠️  DEPRECATED: Use backend/domain/engines/BenefitsEngine.js instead.
 * 
 * This monolithic implementation is being consolidated into the domain layer.
 * Will be removed in Phase 4 (Backend Services Refactor).
 * 
 * stateBenefits.js - State-Level Benefits Determination
 *
 * Evaluates eligibility for state-specific veteran benefits based on:
 * - State of residence
 * - Disability rating
 * - Combat history
 * - Wartime service
 *
 * Delegates to comprehensive state rules database
 */

import stateRules from '../rules/stateRules.json' with { type: 'json' };

/**
 * Evaluate state-specific benefits eligibility
 * @param {Object} onboardingResult - Veteran onboarding record
 * @returns {Array} Array of eligible state benefits
 */
export function evaluateStateBenefits(onboardingResult) {
  if (!onboardingResult) return [];

  const state = onboardingResult.state;
  const combatFlag = onboardingResult.combatSelfReport === 'Yes';
  const rating = Number(onboardingResult.disability?.ratingPercent ?? 0);

  if (!state || !Array.isArray(stateRules)) {
    return [];
  }

  // Filter rules matching veteran profile
  return stateRules.filter(rule => {
    // State must match exactly
    if (rule.state_code !== state) return false;

    // Combat requirement (if specified)
    if (rule.requires_combat_flag && !combatFlag) return false;

    // Wartime service requirement (if specified)
    if (rule.requires_wartime_service && !hasWartimeService(onboardingResult.servicePeriods)) {
      return false;
    }

    // Rating minimum (if specified)
    if (rule.min_rating_percent !== null && rule.min_rating_percent !== undefined) {
      if (rating < rule.min_rating_percent) return false;
    }

    // All conditions met
    return true;
  });
}

/**
 * Check if veteran has wartime service
 * @param {Array} servicePeriods - Service period records
 * @returns {boolean}
 */
function hasWartimeService(servicePeriods) {
  if (!Array.isArray(servicePeriods) || servicePeriods.length === 0) {
    return false;
  }

  // Wartime periods (simplified)
  const wartimePeriods = [
    { start: '1990-08-02', end: '2014-12-31' },  // Gulf War/Post-911 era
    { start: '1964-08-02', end: '1973-05-07' },  // Vietnam
    { start: '1950-06-25', end: '1955-07-27' },  // Korea
    { start: '1941-12-07', end: '1945-12-31' }   // WWII
  ];

  return servicePeriods.some(period => {
    if (!period?.startDate || !period?.endDate) return false;

    const start = new Date(period.startDate);
    const end = new Date(period.endDate);

    return wartimePeriods.some(warPeriod => {
      const warStart = new Date(warPeriod.start);
      const warEnd = new Date(warPeriod.end);

      // Service overlaps with wartime period
      return start <= warEnd && end >= warStart;
    });
  });
}

export default { evaluateStateBenefits, hasWartimeService }

