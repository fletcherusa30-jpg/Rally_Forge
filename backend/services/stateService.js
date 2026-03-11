import { benefitsEngine } from '../domain/index.js';

export async function stateService(onboardingResult) {
    return benefitsEngine.evaluateStateOnly(onboardingResult);
}

