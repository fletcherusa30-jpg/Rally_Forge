import { evaluateFederalBenefits } from '../engine/federalBenefits.js';

export function federalService(onboardingResult) {
    return evaluateFederalBenefits(onboardingResult);
}

