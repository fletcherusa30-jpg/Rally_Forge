import { evaluateCombat } from '../engine/combatEngine.js';

export function combatService(onboardingResult) {
    return evaluateCombat(onboardingResult);
}

