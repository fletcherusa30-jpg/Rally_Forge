import stateRules from '../rules/stateRules.json' assert { type: 'json' };

export function evaluateStateBenefits(onboardingResult) {
    const state = onboardingResult.state;
    const combatFlag = onboardingResult.combatSelfReport === 'Yes';
    const rating = onboardingResult.disability?.ratingPercent ?? 0;

    return stateRules.filter(rule => {
        if (rule.state_code !== state) return false;
        if (rule.requires_combat_flag && !combatFlag) return false;
        if (rule.requires_wartime_service && !hasWartimeService(onboardingResult.servicePeriods)) return false;
        if (rule.min_rating_percent !== null && rule.min_rating_percent !== undefined) {
            return rating >= rule.min_rating_percent;
        }
        return true;
    });
}

function hasWartimeService(servicePeriods) {
    if (!Array.isArray(servicePeriods)) return false;
    return servicePeriods.some(period => {
        if (!period?.startDate || !period?.endDate) return false;
        const start = new Date(period.startDate);
        const end = new Date(period.endDate);
        return start <= new Date('2014-12-31') && end >= new Date('1990-08-02');
    });
}

