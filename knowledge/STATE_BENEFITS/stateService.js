import { evaluateStateBenefits } from '../engine/stateBenefits.js';

export function stateService(onboardingResult) {
    return evaluateStateBenefits(onboardingResult);
}

