/**
 * ⚠️  REFACTORED: Now uses domain layer (repositories + engines).
 * 
 * Previously imported from:
 *   - database/models/onboarding.js  → now: domain/veteranRepo.getLatestOnboarding()
 *   - database/models/benefitsCache.js → now: domain/benefitsRepo
 *   - engine/benefits/benefitsEngine.js → now: domain/benefitsEngine
 *   - utils/errors.js → now: core/errors/AppError.js
 */

import { benefitsRepo, veteranRepo, benefitsEngine } from '../domain/index.js';
import { Errors, createLogger } from '../core/index.js';

const log = createLogger('benefits-service');

/**
 * Get cached benefits or compute new ones.
 */
export const getOrComputeBenefits = async (veteranId) => {
  // Verify veteran exists and load profile
  await veteranRepo.requireById(veteranId);

  // Check cache
  const cached = await benefitsRepo.getLatestResult(veteranId);
  if (cached) {
    log.debug('Benefits served from cache', { veteranId });
    return cached.benefitsResult;
  }

  // Get onboarding record
  const onboarding = await veteranRepo.getLatestOnboarding(veteranId);
  if (!onboarding) {
    throw Errors.badRequest('Onboarding record not found for veteran');
  }

  // Compute benefits
  const benefitsResult = await benefitsEngine.evaluate(onboarding.onboardingResult, {
    requestId: `compute-${veteranId}`,
  });
  await benefitsRepo.saveResult(veteranId, benefitsResult);

  return benefitsResult;
};

/**
 * Force recomputation of benefits, invalidating cache.
 */
export const recomputeBenefits = async (veteranId) => {
  // Verify veteran exists
  await veteranRepo.requireById(veteranId);

  // Get onboarding record
  const onboarding = await veteranRepo.getLatestOnboarding(veteranId);
  if (!onboarding) {
    throw Errors.badRequest('Onboarding record not found for veteran');
  }

  // Recompute benefits
  const benefitsResult = await benefitsEngine.evaluate(onboarding.onboardingResult, {
    requestId: `recompute-${veteranId}`,
  });

  // Invalidate and save new result
  await benefitsRepo.invalidate(veteranId);
  await benefitsRepo.saveResult(veteranId, benefitsResult);
  log.info('Benefits recomputed', { veteranId });

  return benefitsResult;
};

