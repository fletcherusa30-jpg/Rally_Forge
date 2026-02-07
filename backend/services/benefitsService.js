import { ObjectId } from "mongodb";
import { findOnboardingByVeteranId } from "../database/models/onboarding.js";
import {
  findBenefitsCacheByVeteranId,
  saveBenefitsCache,
  invalidateBenefitsCache
} from "../database/models/benefitsCache.js";
import { computeBenefits } from "../engine/benefits/benefitsEngine.js";
import { AppError } from "../utils/errors.js";

const ensureValidVeteranId = (veteranId) => {
  if (!ObjectId.isValid(veteranId)) {
    throw new AppError("Invalid veteranId", 400, "invalid_veteran_id");
  }
};

export const getOrComputeBenefits = async (veteranId) => {
  ensureValidVeteranId(veteranId);

  const cached = await findBenefitsCacheByVeteranId(veteranId);
  if (cached) {
    return cached.benefitsResult;
  }

  const onboardingRecord = await findOnboardingByVeteranId(veteranId);
  if (!onboardingRecord) {
    throw new AppError("Onboarding result not found", 404, "onboarding_missing");
  }

  const benefitsResult = await computeBenefits(onboardingRecord.onboardingResult);
  await saveBenefitsCache(veteranId, benefitsResult);

  return benefitsResult;
};

export const recomputeBenefits = async (veteranId) => {
  ensureValidVeteranId(veteranId);

  const onboardingRecord = await findOnboardingByVeteranId(veteranId);
  if (!onboardingRecord) {
    throw new AppError("Onboarding result not found", 404, "onboarding_missing");
  }

  const benefitsResult = await computeBenefits(onboardingRecord.onboardingResult, {
    requestId: `recompute-${veteranId}`
  });

  await invalidateBenefitsCache(veteranId);
  await saveBenefitsCache(veteranId, benefitsResult);

  return benefitsResult;
};
