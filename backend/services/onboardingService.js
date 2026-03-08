import { ObjectId } from "mongodb";
import { validateOnboarding } from "../../packages/shared-data/src/constants/onboardingSchema.js";
import { saveOnboarding } from "../database/models/onboarding.js";
import { createVeteran, findVeteranById } from "../database/models/veteran.js";
import { AppError } from "../utils/errors.js";

export const createOrUpdateOnboarding = async (payload) => {
  const { valid, errors } = validateOnboarding(payload);
  if (!valid) {
    throw new AppError("Invalid onboarding data", 400, "invalid_onboarding", errors);
  }

  let veteranId = payload.veteranId || null;

  if (veteranId && !ObjectId.isValid(veteranId)) {
    throw new AppError("Invalid veteranId", 400, "invalid_veteran_id");
  }

  if (veteranId) {
    const existing = await findVeteranById(veteranId);
    if (!existing) {
      veteranId = null;
    }
  }

  if (!veteranId) {
    const veteran = await createVeteran({
      branch: payload.branch,
      component: payload.component,
      stateOfResidence: payload.stateOfResidence,
      status: "active"
    });
    veteranId = veteran._id.toString();
  }

  await saveOnboarding(veteranId, payload);

  return { veteranId, onboardingResult: payload };
};

