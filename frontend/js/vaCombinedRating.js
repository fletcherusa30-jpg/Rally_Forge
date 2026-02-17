const normalizePercent = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(100, parsed));
};

const normalizeConditionName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const hashString = (value) => {
  let hash = 5381;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const buildCombinedRatingsTable = () => {
  const table = Array.from({ length: 101 }, () => Array(101).fill(0));

  for (let c = 0; c <= 100; c += 1) {
    for (let d = 0; d <= 100; d += 1) {
      const combined = c + (d * (100 - c)) / 100;
      table[c][d] = Math.floor(combined);
    }
  }

  return table;
};

const COMBINED_RATINGS_TABLE = buildCombinedRatingsTable();

const combineRatingsUsingTable = (percentages) => {
  const normalized = (Array.isArray(percentages) ? percentages : [])
    .map((rating) => Math.round(normalizePercent(rating)))
    .filter((rating) => rating > 0)
    .sort((left, right) => right - left);

  if (!normalized.length) {
    return 0;
  }

  console.log(`Initial ratings (sorted): [${normalized.join(", ")}]`);
  let combined = normalized[0];
  console.log(`Start: ${combined}`);

  normalized.slice(1).forEach((rating) => {
    const next = COMBINED_RATINGS_TABLE[combined][rating];
    console.log(`Combine ${combined} with ${rating} -> ${next}`);
    combined = next;
  });

  return Math.max(0, Math.min(100, combined));
};

/**
 * VA Combined Rating Calculator per 38 CFR § 4.25
 * 
 * CRITICAL: MUST round at each step per § 4.25
 * DO NOT change to floor, truncate, or keep exact decimals
 * 
 * CFR Reference: 38 CFR § 4.25 - Combined ratings table
 */
const combineRatingsExact = (percentages) => {
  const normalized = (Array.isArray(percentages) ? percentages : [])
    .map((rating) => Math.round(normalizePercent(rating)))
    .filter((rating) => rating > 0)
    .sort((left, right) => right - left);

  if (!normalized.length) {
    return 0;
  }

  let combined = normalized[0];

  normalized.slice(1).forEach((rating) => {
    const exact = combined + (rating * (100 - combined)) / 100;
    combined = Math.round(exact); // § 4.25: MUST round at each step
  });

  return Math.max(0, Math.min(100, combined));
};

const roundToNearestTen = (value) => {
  const roundedWhole = Math.round(Number.isFinite(value) ? value : 0);
  return Math.max(0, Math.min(100, Math.round(roundedWhole / 10) * 10));
};

const normalizeConditionBaseKey = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/\bleft\b|\bright\b|\bdominant\b|\bnon-dominant\b|\bnon dominant\b/g, " ")
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const detectSideFromName = (name) => {
  const value = String(name || "").toLowerCase();
  if (/\bleft\b/.test(value)) {
    return "left";
  }
  if (/\bright\b/.test(value)) {
    return "right";
  }
  return "none";
};

const normalizeSide = (value) => (value === "left" || value === "right" ? value : "none");

const buildConditionKey = (entry) => {
  const id = entry?.id;
  if (id !== undefined && id !== null && String(id).trim() !== "") {
    return `id:${String(id).trim()}`;
  }

  const name = normalizeConditionName(entry?.condition ?? entry?.name ?? "");
  if (name) {
    return `name:${name}`;
  }

  return `hash:${hashString("unknown")}`;
};

const isExcludedFromMath = (entry) => {
  const status = String(entry?.status || "").toLowerCase();
  const rating = String(entry?.rating || "").toLowerCase();
  if (status === "denied" || status === "nsc") {
    return true;
  }
  if (rating === "nsc" || rating === "denied") {
    return true;
  }
  return false;
};

export const getCombinedRatingRaw = (percentages) => {
  const raw = combineRatingsExact(percentages);
  console.log(`Final raw combined: ${raw}`);
  return raw;
};

export const getCombinedRating = (percentages) => {
  const raw = combineRatingsExact(percentages);
  const rounded = roundToNearestTen(raw);
  console.log(`Final rounded combined: ${rounded}`);
  return rounded;
};

export const buildEffectiveRatingsFromConditions = (entries) => {
  const source = Array.isArray(entries) ? entries : [];
  const unique = new Map();

  source.forEach((entry, index) => {
    if (isExcludedFromMath(entry)) {
      return;
    }
    const key = buildConditionKey(entry);
    if (unique.has(key)) {
      console.warn(`Duplicate condition ignored: ${key}`);
      return;
    }
    unique.set(key, entry ?? { id: `unknown-${index}` });
  });

  return Array.from(unique.values())
    .map((entry) => normalizePercent(entry?.percentage ?? entry?.percent))
    .filter((percent) => percent > 0);
};
