import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RULES_DIR = path.resolve(__dirname, "../rules");

const cache = new Map();

const isIsoDate = (value) => typeof value === "string" && !Number.isNaN(Date.parse(value));

export const validateRuleSet = (ruleSet) => {
  if (!ruleSet || typeof ruleSet !== "object") {
    throw new Error("Rule set must be an object.");
  }

  if (typeof ruleSet.version !== "string") {
    throw new Error("Rule set version must be a string.");
  }

  if (!isIsoDate(ruleSet.effectiveDate)) {
    throw new Error("Rule set effectiveDate must be an ISO date string.");
  }

  if (!ruleSet.metadata || typeof ruleSet.metadata !== "object") {
    throw new Error("Rule set metadata must be an object.");
  }

  if (!ruleSet.source && !ruleSet.citations) {
    throw new Error("Rule set must include source or citations.");
  }

  if (!Array.isArray(ruleSet.rules)) {
    throw new Error("Rule set rules must be an array.");
  }

  return true;
};

export const loadRules = async (category) => {
  const fileName = `${category}Rules.json`;
  const filePath = path.join(RULES_DIR, fileName);
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw);

  validateRuleSet(data);
  // TODO: Validate rule conditions/outcomes schema once semantics are finalized.
  cache.set(category, data);

  return data;
};

export const getRules = async (category) => {
  if (cache.has(category)) {
    return cache.get(category);
  }

  return loadRules(category);
};
