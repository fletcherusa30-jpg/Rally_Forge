import { ObjectId } from "mongodb";
import { getDb } from "../mongo.js";

const COLLECTION = "onboarding_results";

export const getOnboardingCollection = () => getDb().collection(COLLECTION);

export const saveOnboarding = async (veteranId, onboardingResult) => {
  const record = {
    _id: new ObjectId(),
    veteranId,
    onboardingResult,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await getOnboardingCollection().insertOne(record);
  return record;
};

export const findOnboardingByVeteranId = async (veteranId) => {
  return getOnboardingCollection().findOne(
    { veteranId },
    { sort: { createdAt: -1 } }
  );
};

