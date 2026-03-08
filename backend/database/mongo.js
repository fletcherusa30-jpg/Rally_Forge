import { MongoClient, ObjectId } from "mongodb";

let client;
let db;
let inMemoryDb;

const getConnectionOptions = () => ({
  maxPoolSize: 10,
  minPoolSize: 2,
  retryWrites: true,
  serverSelectionTimeoutMS: 2000,
  connectTimeoutMS: 2000
});

const valuesEqual = (left, right) => {
  if (left === right) {
    return true;
  }

  if (left && right && typeof left === "object" && typeof right === "object") {
    if (typeof left.equals === "function") {
      return left.equals(right);
    }

    return String(left) === String(right);
  }

  return false;
};

const matchesFilter = (doc, filter = {}) => {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "_id" && value && typeof value === "string") {
      return valuesEqual(doc._id, new ObjectId(value));
    }

    return valuesEqual(doc[key], value);
  });
};

const createMemoryCollection = () => {
  let records = [];

  return {
    insertOne: async (doc) => {
      records = [...records, doc];
      return { insertedId: doc._id };
    },
    findOne: async (filter, options = {}) => {
      let results = records.filter((doc) => matchesFilter(doc, filter));

      if (options.sort) {
        const [[field, direction]] = Object.entries(options.sort);
        results = [...results].sort((left, right) => {
          const leftValue = left?.[field];
          const rightValue = right?.[field];
          if (leftValue === rightValue) {
            return 0;
          }
          return (leftValue > rightValue ? 1 : -1) * (direction < 0 ? -1 : 1);
        });
      }

      return results[0] ?? null;
    },
    deleteMany: async (filter) => {
      const before = records.length;
      records = records.filter((doc) => !matchesFilter(doc, filter));
      return { deletedCount: before - records.length };
    }
  };
};

const getInMemoryDb = () => {
  if (!inMemoryDb) {
    const collections = new Map();
    inMemoryDb = {
      collection: (name) => {
        if (!collections.has(name)) {
          collections.set(name, createMemoryCollection());
        }
        return collections.get(name);
      },
      isInMemory: true
    };
  }

  return inMemoryDb;
};

export const connectToMongo = async (
  uri = process.env.MONGO_URL || "mongodb://127.0.0.1:27017",
  dbName = process.env.MONGO_DB || "rallyforge",
  { allowFallback = true } = {}
) => {
  if (client && db) {
    return db;
  }

  try {
    client = new MongoClient(uri, getConnectionOptions());
    await client.connect();
    db = client.db(dbName);
  } catch (error) {
    if (!allowFallback) {
      throw error;
    }

    console.warn("MongoDB unavailable, falling back to in-memory storage.");
    db = getInMemoryDb();
  }

  return db;
};

export const getDb = () => {
  if (!db) {
    throw new Error("MongoDB not initialized. Call connectToMongo() first.");
  }

  return db;
};

