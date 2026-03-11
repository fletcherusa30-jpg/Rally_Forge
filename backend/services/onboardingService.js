import { validateOnboarding } from "../../packages/shared-data/src/constants/onboardingSchema.js";
import { veteranRepo } from "../domain/index.js";
import { Errors } from "../core/index.js";

export const createOrUpdateOnboarding = async (payload) => {
  const { valid, errors } = validateOnboarding(payload);
  if (!valid) {
    throw Errors.badRequest("Invalid onboarding data", errors);
  }

  let veteranId = payload.veteranId || null;

  if (veteranId) {
    const existing = await veteranRepo.findById(veteranId);
    if (!existing) {
      veteranId = null;
    }
  }

  if (!veteranId) {
    const veteran = await veteranRepo.create({
      branch: payload.branch,
      component: payload.component,
      stateOfResidence: payload.stateOfResidence,
      status: "active"
    });
    veteranId = veteran.id;
  }

  await veteranRepo.saveOnboarding(veteranId, payload);

  return { veteranId, onboardingResult: payload };
};

