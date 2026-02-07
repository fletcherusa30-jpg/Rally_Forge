import { ObjectId } from "mongodb";
import { getDb } from "../mongo.js";

const COLLECTION = "veterans";

export const getVeteransCollection = () => getDb().collection(COLLECTION);

export const createVeteran = async (doc) => {
  const now = new Date();
  const record = {
    _id: new ObjectId(),
    ...doc,
    createdAt: now,
    updatedAt: now
  };

  await getVeteransCollection().insertOne(record);
  return record;
};

export const findVeteranById = async (veteranId) => {
  return getVeteransCollection().findOne({ _id: new ObjectId(veteranId) });
};
