import { ObjectId } from "mongodb";
import { getDb } from "../mongo.js";

const COLLECTION = "benefits_cache";

export const getBenefitsCacheCollection = () => getDb().collection(COLLECTION);

export const saveBenefitsCache = async (veteranId, benefitsResult) => {
  const record = {
    _id: new ObjectId(),
    veteranId,
    benefitsResult,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await getBenefitsCacheCollection().insertOne(record);
  return record;
};

export const findBenefitsCacheByVeteranId = async (veteranId) => {
  return getBenefitsCacheCollection().findOne(
    { veteranId },
    { sort: { createdAt: -1 } }
  );
};

export const invalidateBenefitsCache = async (veteranId) => {
  await getBenefitsCacheCollection().deleteMany({ veteranId });
};

