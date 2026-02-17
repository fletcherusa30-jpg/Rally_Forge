/**
 * CFR VERSION TRACKING
 * This implementation is based on 38 CFR as published in e-CFR (up to date as of Feb 2026)
 * § 4.25 - Combined ratings table
 * § 4.26 - Bilateral factor
 * 
 * CRITICAL: Any changes to VA math MUST cite CFR section and pass all tests
 * See: tests/combined_rating/CFR_COMPLIANCE.md
 */
const CFR_COMPLIANCE_VERSION = "38 CFR § 4.25-4.26 (2026-02)";

const MIDLINE_KEYWORDS = [
  "spine",
  "cervical",
  "thoracic",
  "lumbar",
  "gerd",
  "gastroesophageal",
  "sleep apnea",
  "migraines",
  "migraine",
  "hypertension",
  "tinnitus",
  "sinusitis",
  "rhinitis",
  "erectile dysfunction",
  "ptsd",
  "adjustment disorder"
];

const UPPER_EXTREMITY_KEYWORDS = [
  "shoulder",
  "arm",
  "elbow",
  "wrist",
  "hand",
  "clavicle",
  "scapula",
  "radiculopathy",
  "upper extremity"
];

const LOWER_EXTREMITY_KEYWORDS = [
  "hip",
  "knee",
  "ankle",
  "foot",
  "leg",
  "sciatic",
  "patellofemoral",
  "lower extremity",
  "hallux",
  "hammer toe",
  "hammer toes"
];

const CANONICAL_MAP = new Map([
  ["degenerative arthritis of the cervical spine degenerative disc disease", "degenerative arthritis of the cervical spine"],
  ["degenerative arthritis of the cervical spine degenerative disc", "degenerative arthritis of the cervical spine"],
  ["degenerative arthritis of the cervical spine", "degenerative arthritis of the cervical spine"],
  ["thoracic and lumbar spine spondylosis degenerative arthritis of the lumbar thoracic spine ligamentum flavum", "thoracic and lumbar spine spondylosis"],
  ["thoracic and lumbar spine spondylosis", "thoracic and lumbar spine spondylosis"],
  ["left non dominant shoulder impingement syndrome acromioclavicular separation", "left (non-dominant) shoulder impingement"],
  ["left non dominant shoulder impingement", "left (non-dominant) shoulder impingement"],
  ["right dominant shoulder impingement syndrome acromioclavicular osteoarthritis", "right (dominant) shoulder impingement"],
  ["right dominant shoulder impingement", "right (dominant) shoulder impingement"],
  ["right arm dominant middle radicular group radiculopathy", "right arm (dominant) middle radicular group"],
  ["right arm dominant middle radicular group", "right arm (dominant) middle radicular group"],
  ["right patellofemoral pain syndrome claimed", "right patellofemoral pain syndrome"],
  ["right patellofemoral pain syndrome", "right patellofemoral pain syndrome"],
  ["left patellofemoral pain syndrome", "left patellofemoral pain syndrome"],
  ["left non dominant clavicle or scapula impairment", "left (non-dominant) clavicle or scapula impairment"],
  ["right wrist dominant scapholunate ligament derangement", "right wrist (dominant) scapholunate ligament derangement"],
  ["right wrist dominant scapholunate ligament", "right wrist (dominant) scapholunate ligament"],
  ["right wrist dominant scapholunate", "right wrist (dominant) scapholunate ligament"],
  ["right sciatic nerve", "right sciatic nerve"],
  ["left hallux valgus left foot degenerative arthritis", "left hallux valgus"],
  ["right foot hammer toe(s) third and fourth toes", "right foot hammer toes"],
  ["right foot hammer toes", "right foot hammer toes"],
  ["right hallux valgus", "right hallux valgus"],
  ["surgical scars cervical spine and lumbar segment", "surgical scars"],
  ["laceration scar(s)", "laceration scars"],
  ["obstructive sleep apnea", "obstructive sleep apnea"],
  ["gastroesophageal reflux disease", "gastroesophageal reflux disease"],
  ["adjustment disorder with mixed anxiety and depressed mood", "adjustment disorder with mixed anxiety and depressed mood"],
  ["adjustment disorder with mixed anxiety and", "adjustment disorder with mixed anxiety"],
  ["tinnitus", "tinnitus"],
  ["hypertension", "hypertension"],
  ["allergic rhinitis", "allergic rhinitis"],
  ["acute self-limiting sinusitis", "acute self-limiting sinusitis"],
  ["erectile dysfunction", "erectile dysfunction"]
]);

const hashString = (value) => {
  let hash = 5381;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const normalizeKey = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeLetterText = (value) => {
  const raw = String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\u00a0/g, " ");

  const lines = raw
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((line) => line.replace(/[;,.:]+$/g, ""));

  return lines.join("\n").trim();
};

export const canonicalizeName = (value) => {
  const normalized = normalizeKey(value);
  if (!normalized) {
    return "";
  }
  if (CANONICAL_MAP.has(normalized)) {
    return CANONICAL_MAP.get(normalized);
  }
  return normalized.replace(/\s+/g, " ").trim();
};

export const extractSide = (value) => {
  const normalized = normalizeKey(value);
  if (!normalized) {
    return null;
  }
  if (normalized.includes("bilateral")) {
    return "bilateral";
  }
  if (normalized.includes("left")) {
    return "left";
  }
  if (normalized.includes("right")) {
    return "right";
  }

  const isMidline = MIDLINE_KEYWORDS.some((keyword) => normalized.includes(keyword));
  if (isMidline) {
    return "midline";
  }

  return null;
};

export const classifyBodyGroup = (canonicalName, side) => {
  const normalized = normalizeKey(canonicalName);
  if (!normalized) {
    return null;
  }

  if (MIDLINE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "midline";
  }

  if (UPPER_EXTREMITY_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "upper_extremity";
  }

  if (LOWER_EXTREMITY_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "lower_extremity";
  }

  if (side === "midline") {
    return "midline";
  }

  return null;
};

export const generateConditionId = (condition) => {
  const canonicalName = condition?.canonicalName || condition?.name || "";
  const percent = condition?.percent ?? "null";
  const effectiveDate = condition?.effectiveDate || "null";
  const bodyGroup = condition?.bodyGroup || "null";
  const side = condition?.side || "null";
  const seed = `${canonicalName}|${percent}|${effectiveDate}|${bodyGroup}|${side}`;
  return `cond-${hashString(seed)}`;
};

export const dedupeById = (conditions, debugTrace = []) => {
  const map = new Map();
  let removed = 0;

  (Array.isArray(conditions) ? conditions : []).forEach((condition) => {
    if (!condition?.id) {
      return;
    }
    if (map.has(condition.id)) {
      removed += 1;
      debugTrace.push(`Duplicate condition id ignored: ${condition.id} (${condition.name || condition.canonicalName || ""})`);
      return;
    }
    map.set(condition.id, condition);
  });

  debugTrace.push(`After dedupe: ${map.size} conditions (removed ${removed} duplicates).`);
  return Array.from(map.values());
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

const roundToNearestTen = (raw) => {
  const rounded = Math.round((Number.isFinite(raw) ? raw : 0) / 10) * 10;
  if (rounded > 100) return 100;
  if (rounded < 0) return 0;
  return rounded;
};

/**
 * VA Combined Rating Calculator per 38 CFR § 4.25
 * 
 * CRITICAL: This implementation MUST follow § 4.25 exactly:
 * 1. Sort compensable ratings from highest to lowest
 * 2. Use formula: Combined = A + (100 - A) * (B / 100)
 * 3. ROUND TO NEAREST WHOLE NUMBER after EACH combination step
 * 4. Use rounded result as input to next step
 * 5. Final raw combined is the result after all steps
 * 6. Round raw combined to nearest 10 for final combined rating
 * 
 * DO NOT:
 * - Floor at each step (violates § 4.25)
 * - Keep exact decimals through all steps (violates § 4.25)
 * - Use lookup tables that floor (violates § 4.25)
 * - Skip rounding at intermediate steps (violates § 4.25)
 * 
 * CFR Reference: 38 CFR § 4.25 - Combined ratings table
 */
const combineRatingsTable = (ratings, debugTrace) => {
  const steps = [];
  const values = (Array.isArray(ratings) ? ratings : [])
    .map((value) => Math.round(Number(value)))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b - a);

  if (!values.length) {
    steps.push("Initial ratings (sorted): []");
    steps.push("Raw combined: 0");
    steps.push("Rounded combined: 0");
    if (debugTrace) {
      debugTrace.push(...steps);
    }
    return { raw: 0, rounded: 0, steps };
  }

  steps.push(`Initial ratings (sorted): [${values.join(", ")}]`);
  
  // § 4.25: Round at each step (NOT floor, NOT exact decimals)
  let combined = values[0];
  steps.push(`Start with: ${combined}`);

  values.slice(1).forEach((rating) => {
    const before = combined;
    const exact = combined + (rating * (100 - combined)) / 100;
    combined = Math.round(exact); // § 4.25 REQUIRES rounding at each step
    
    // CFR compliance validation: ensure rounding is happening
    if (!Number.isInteger(combined)) {
      throw new Error(`CFR § 4.25 violation: Combined rating must be rounded to whole number at each step. Got: ${combined}`);
    }
    
    steps.push(`Combine ${before} with ${rating} -> ${exact.toFixed(2)} → ${combined}`);
  });

  const raw = combined;
  const rounded = roundToNearestTen(raw);
  steps.push(`Raw combined: ${raw}`);
  steps.push(`Rounded combined: ${rounded}`);

  if (debugTrace) {
    debugTrace.push(...steps);
  }

  return { raw, rounded, steps };
};

/**
 * Apply Bilateral Factor per 38 CFR § 4.26
 * 
 * CRITICAL: This implementation MUST follow § 4.26 exactly:
 * 1. Applies ONLY to paired extremities (both left AND right affected)
 * 2. Upper extremity: shoulder, arm, elbow, wrist, hand, upper extremity radiculopathy
 * 3. Lower extremity: hip, knee, leg, ankle, foot, lower extremity radiculopathy
 * 4. Combine all bilateral ratings using § 4.25
 * 5. Compute 10% of that combined value
 * 6. ADD (not combine) the 10% to the combined value
 * 7. Round to nearest whole number
 * 8. Treat result as single disability for further combination
 * 
 * DO NOT:
 * - Floor the bilateral combined or factor (violates § 4.26)
 * - Apply to non-extremity conditions
 * - Apply when only one side is affected
 * - Apply the factor more than once to same disabilities
 * 
 * CFR Reference: 38 CFR § 4.26 - Bilateral factor
 */
const applyBilateralFactor = (conditions, debugTrace) => {
  const bilateralGroups = new Map();
  const usedIds = new Set();
  const bilateralRatings = [];

  conditions.forEach((condition) => {
    if (!condition.isBilateralCandidate) {
      return;
    }
    if (!condition.bodyGroup || !condition.side) {
      return;
    }
    if (condition.side !== "left" && condition.side !== "right") {
      return;
    }
    const key = condition.bodyGroup;
    if (!bilateralGroups.has(key)) {
      bilateralGroups.set(key, { left: [], right: [] });
    }
    const group = bilateralGroups.get(key);
    group[condition.side].push(condition);
  });

  bilateralGroups.forEach((group, key) => {
    if (!group.left.length || !group.right.length) {
      return;
    }
    const ratings = [...group.left, ...group.right]
      .map((condition) => condition.percent)
      .filter((value) => Number.isFinite(value) && value > 0);

    if (!ratings.length) {
      return;
    }

    const { raw } = combineRatingsTable(ratings, debugTrace);
    const bilateralCombined = Math.round(raw); // § 4.26 requires rounding
    const bilateralFactor = Math.round(bilateralCombined * 0.1); // § 4.26: 10% of combined
    const bilateralWithFactor = bilateralCombined + bilateralFactor; // § 4.26: ADD the factor
    
    // CFR compliance validation: ensure values are whole numbers
    if (!Number.isInteger(bilateralCombined) || !Number.isInteger(bilateralFactor) || !Number.isInteger(bilateralWithFactor)) {
      throw new Error(`CFR § 4.26 violation: Bilateral values must be whole numbers. Got combined=${bilateralCombined}, factor=${bilateralFactor}, withFactor=${bilateralWithFactor}`);
    }
    
    debugTrace.push(`Bilateral group (${key}): combined ${bilateralCombined}%, bilateral factor ${bilateralFactor}%, with factor ${bilateralWithFactor}%`);
    bilateralRatings.push(bilateralWithFactor);

    group.left.forEach((condition) => usedIds.add(condition.id));
    group.right.forEach((condition) => usedIds.add(condition.id));
  });

  return { bilateralRatings, usedIds };
};

const extractStatedCombinedRating = (text) => {
  const normalized = String(text || "").replace(/\s+/g, " ");
  const match = normalized.match(/combined\s+(?:rating|evaluation)[^\d]{0,40}(\d{1,3})\s*%/i);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return null;
  }
  return value;
};

export const buildCombinedRatingResultFromConditions = (conditions, options = {}) => {
  const debugTrace = [];
  const useBilateralFactor = options.useBilateralFactor !== false;

  const canonicalized = (Array.isArray(conditions) ? conditions : []).map((condition) => {
    const name = String(condition?.name || condition?.condition || "").trim();
    const canonicalName = canonicalizeName(name);
    const status = condition?.status || "SC";
    const percent = Number.isFinite(condition?.percent) ? condition.percent : condition?.percentage ?? null;
    const denialReason = condition?.denialReason ?? condition?.reason_for_denial ?? null;
    const effectiveDate = condition?.effectiveDate ?? condition?.effective_date ?? null;
    const side = extractSide(canonicalName);
    const bodyGroup = classifyBodyGroup(canonicalName, side);
    const isBilateralCandidate =
      String(status).toUpperCase() === "SC" &&
      Number.isFinite(percent) &&
      percent > 0 &&
      (side === "left" || side === "right") &&
      (bodyGroup === "upper_extremity" || bodyGroup === "lower_extremity");

    const normalized = {
      id: "",
      name,
      canonicalName,
      status: String(status).toUpperCase(),
      percent: Number.isFinite(percent) ? percent : null,
      denialReason,
      bodyGroup,
      side,
      isBilateralCandidate,
      effectiveDate
    };

    normalized.id = generateConditionId(normalized);
    return normalized;
  });

  debugTrace.push(`Parsed conditions: ${canonicalized.length} total`);
  debugTrace.push("Canonicalized names: " + canonicalized.map((c) => `${c.name} -> ${c.canonicalName}`).join(" | "));

  let deduped = dedupeById(canonicalized, debugTrace);

  const scConditions = deduped.filter((condition) => condition.status === "SC");
  const nscConditions = deduped.filter((condition) => condition.status === "NSC");
  const deniedConditions = deduped.filter((condition) => condition.status === "DENIED");

  debugTrace.push(`SC: ${scConditions.length}, NSC: ${nscConditions.length}, Denied: ${deniedConditions.length}.`);
  deniedConditions.forEach((condition) => {
    if (condition.denialReason) {
      debugTrace.push(`Denied: ${condition.name} - Reason: ${condition.denialReason}`);
    }
  });

  const scForMath = dedupeById(
    scConditions.filter((condition) => Number.isFinite(condition.percent) && condition.percent > 0),
    debugTrace
  );

  const ratingsForMath = [];
  const usedBilateral = new Set();

  if (useBilateralFactor) {
    const bilateralResult = applyBilateralFactor(scForMath, debugTrace);
    ratingsForMath.push(...bilateralResult.bilateralRatings);
    bilateralResult.usedIds.forEach((id) => usedBilateral.add(id));
  }

  scForMath.forEach((condition) => {
    if (usedBilateral.has(condition.id)) {
      return;
    }
    ratingsForMath.push(condition.percent);
  });

  if (useBilateralFactor) {
    debugTrace.push(`Ratings after bilateral expansion: [${ratingsForMath.join(", ")}]`);
  }

  const { raw, rounded, steps } = combineRatingsTable(ratingsForMath, debugTrace);

  const sortedConditions = [...deduped].sort((left, right) => {
    const leftIsSC = left.status === "SC";
    const rightIsSC = right.status === "SC";
    if (leftIsSC && !rightIsSC) return -1;
    if (!leftIsSC && rightIsSC) return 1;

    if (leftIsSC && rightIsSC) {
      const lp = left.percent ?? 0;
      const rp = right.percent ?? 0;
      if (lp !== rp) {
        return rp - lp;
      }
    }

    return left.canonicalName.localeCompare(right.canonicalName, undefined, { sensitivity: "base" });
  });

  const statedCombinedFromLetter = options.statedCombinedFromLetter ?? null;
  const validationWarnings = [];
  if (Number.isFinite(statedCombinedFromLetter) && statedCombinedFromLetter !== rounded) {
    validationWarnings.push(
      `Computed combined rating (${rounded}%) differs from letter's stated combined rating (${statedCombinedFromLetter}%). Check parsing and classification.`
    );
  }

  return {
    rawCombined: raw,
    roundedCombined: rounded,
    scConditions: sortedConditions.filter((condition) => condition.status === "SC"),
    nscConditions: sortedConditions.filter((condition) => condition.status === "NSC"),
    deniedConditions: sortedConditions.filter((condition) => condition.status === "DENIED"),
    usedBilateralFactor: useBilateralFactor && ratingsForMath.length > 0,
    statedCombinedFromLetter,
    validationWarnings,
    debugTrace: debugTrace.concat(steps)
  };
};

export const scanVaDecisionLetter = (rawText, options = {}) => {
  const { parseVADecisionScanner } = options;
  if (typeof parseVADecisionScanner !== "function") {
    throw new Error("scanVaDecisionLetter requires parseVADecisionScanner in options");
  }

  const normalizedText = normalizeLetterText(rawText);
  const statedCombinedFromLetter = extractStatedCombinedRating(normalizedText);
  const scanResult = parseVADecisionScanner(rawText);

  const scConditions = (scanResult?.service_connected || scanResult?.serviceConnected || []).map((entry) => ({
    name: entry?.condition || "",
    status: "SC",
    percent: Number(entry?.percentage),
    effectiveDate: entry?.effective_date || null
  }));

  const deniedConditions = (scanResult?.denied || scanResult?.deniedConditions || []).map((entry) => ({
    name: entry?.condition || "",
    status: "Denied",
    percent: null,
    denialReason: entry?.reason_for_denial || entry?.reason || null
  }));

  const conditions = [...scConditions, ...deniedConditions];

  const computedResult = buildCombinedRatingResultFromConditions(conditions, {
    useBilateralFactor: options.useBilateralFactor !== false,
    statedCombinedFromLetter
  });

  // Always use computed values, never override with stated combined rating from letter
  const debugTrace = [...(computedResult.debugTrace || [])];
  
  if (Number.isFinite(statedCombinedFromLetter)) {
    debugTrace.push(
      `Letter stated combined rating: ${statedCombinedFromLetter}%`,
      `Computed raw combined: ${computedResult.rawCombined?.toFixed?.(2) ?? computedResult.rawCombined}%`,
      `Computed rounded combined: ${computedResult.roundedCombined}%`
    );
    
    if (statedCombinedFromLetter !== computedResult.roundedCombined) {
      debugTrace.push(
        `⚠️ Discrepancy: Letter states ${statedCombinedFromLetter}% but computed ${computedResult.roundedCombined}%`
      );
    }
  }

  return {
    ...computedResult,
    statedCombinedFromLetter,
    debugTrace
  };
};
