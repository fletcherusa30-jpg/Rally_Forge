import { evaluateExposure } from '../engine/exposureEngine.js';
import { buildPresumptivePathways } from '../engine/presumptiveEngine.js';

export function exposureService(onboardingResult) {
    const exposures = evaluateExposure(onboardingResult);
    const presumptivePathways = buildPresumptivePathways(exposures);
    return { exposures, presumptivePathways };
}

