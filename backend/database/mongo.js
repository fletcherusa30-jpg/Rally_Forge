import { MongoClient } from "mongodb";

let client;
let db;

const getConnectionOptions = () => ({
  maxPoolSize: 10,
  minPoolSize: 2,
  retryWrites: true
});

export const connectToMongo = async (
  uri = process.env.MONGO_URL || "mongodb://127.0.0.1:27017",
  dbName = process.env.MONGO_DB || "rallyforge"
) => {
  if (client && db) {
    return db;
  }

  client = new MongoClient(uri, getConnectionOptions());
  await client.connect();
  db = client.db(dbName);

  return db;
};

export const getDb = () => {
  if (!db) {
    throw new Error("MongoDB not initialized. Call connectToMongo() first.");
  }

  return db;
};
