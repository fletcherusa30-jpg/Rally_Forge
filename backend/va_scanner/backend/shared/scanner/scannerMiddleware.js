const ALLOWED_TYPES = new Set(["new", "increase", "continued"]);

export const SCANNER_SCHEMA_VERSIONS = Object.freeze({
  ocr: "2.0.0-advanced-preprocessing",
  dd214: "3.0.0-modernized-extraction",
  str: "3.0.0-nlp-enhanced",
  crossVerification: "2.0.0",
  ratingDecision: "4.2.0-cfr-compliant",
});

export const VA_SCANNER_LLM_PROMPT_GUARDRAILS = `Do not repeat any disability. If the same disability appears multiple times in
 the document, list it only once per unique percentage. Before returning your
 final JSON, check your list and remove all duplicates. You must validate your
 output before returning it.

Never infer or hallucinate disabilities. Only list conditions explicitly
present in the document.`;

const normalizeLineKey = (line) =>
  String(line || "")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^a-z0-9%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const collapseRepeatedWords = (value) =>
  String(value || "")
    .replace(/\b([A-Za-z][A-Za-z'\-]*)\s+\1\b/gi, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

const collapseRepeatedConditionPhrase = (value) => {
  let current = String(value || "").trim();

  for (let index = 0; index < 3; index += 1) {
    const next = current
      .replace(/^(.+?)\s+\1$/i, "$1")
      .replace(/\b([A-Za-z][A-Za-z'\-]*(?:\s+[A-Za-z][A-Za-z'\-]*){1,8})\s+\1\b/gi, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (next === current) {
      break;
    }

    current = next;
  }

  return current;
};

const collapseRepeatedFragments = (line) =>
  String(line || "")
    .replace(/\b([A-Za-z][A-Za-z'\-]*(?:\s+[A-Za-z][A-Za-z'\-]*){1,5})\s+\1\b/gi, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

const normalizeWhitespace = (value) =>
  String(value || "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const stripConditionNarrativeTail = (value) =>
  String(value || "")
    .replace(/\b(?:based on|secondary to|associated with|due to|as a result of|resulting from|claimed as)\b[\s\S]*$/i, "")
    .replace(/\b(?:effective|from)\b\s+[A-Za-z0-9,\/-]+[\s\S]*$/i, "")
    .replace(/\b(?:reconsideration|reconsidered)\b[\s\S]*$/i, "")
    .trim();

const normalizeConditionOutput = (value) =>
  collapseRepeatedConditionPhrase(
    collapseRepeatedWords(
      stripConditionNarrativeTail(String(value || ""))
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s*\|\s*/g, " ")
      .replace(/^\s*service connection for\s+/i, "")
      .replace(/^\s*entitlement to service connection for\s+/i, "")
      .replace(/\s*\(claimed as[^\)]*\)/gi, "")
      .replace(/\s*\([^\)]*$/g, "")
      .replace(/\s*\([^\)]*\)\s*$/g, "")
      .replace(/\bservice connection has been[\s\S]*$/i, "")
      .replace(/\bthe effective date of this grant[\s\S]*$/i, "")
      .replace(/\bwe have no record[\s\S]*$/i, "")
      .replace(/\bis denied\b[\s\S]*$/i, "")
      .replace(/\b(?:also|claimed)\s*$/i, "")
      .replace(/[;,:]+/g, " ")
      .replace(/[\-–—]+/g, "-")
      .replace(/\s{2,}/g, " ")
      .replace(/[\s\-–—:;,.]+$/g, "")
      .trim()
    )
  );

const normalizeConditionCompare = (value) =>
  normalizeConditionOutput(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b([a-z0-9]+)\s+\1\b/g, "$1")
    .trim();

const tokenizeCondition = (value) =>
  normalizeConditionCompare(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

const isNearDuplicateCondition = (left, right) => {
  const leftNorm = normalizeConditionCompare(left);
  const rightNorm = normalizeConditionCompare(right);
  if (!leftNorm || !rightNorm) {
    return false;
  }
  if (leftNorm === rightNorm) {
    return true;
  }
  if (leftNorm.includes(rightNorm) || rightNorm.includes(leftNorm)) {
    return true;
  }

  const leftTokens = tokenizeCondition(leftNorm);
  const rightTokens = tokenizeCondition(rightNorm);
  if (!leftTokens.length || !rightTokens.length) {
    return false;
  }

  const leftSet = new Set(leftTokens);
  const overlap = rightTokens.filter((token) => leftSet.has(token)).length;
  const denominator = Math.max(leftTokens.length, rightTokens.length);
  return overlap / denominator >= 0.8;
};

const ADMINISTRATIVE_DENIAL_TEXT_PATTERN =
  /\b(?:disagreement|appeal|appeals|appellate|decision|benefit|benefits|final|evidence|review|notice|rights?|within\s+one\s+year|one\s+year|va\s*form|send\s+us|file\s+(?:a\s+)?(?:claim|disagreement)|military\s+service\s+and\s+va|payment|records\s+request)\b/i;

const ACTION_VERB_PATTERN =
  /\b(?:is|are|was|were|will|would|should|must|can|may|have|has|had|be|become|becomes|becoming|submit|send|file|review|request|consider)\b/i;

const isLikelyDeniedConditionText = (value) => {
  const text = normalizeConditionOutput(value);
  if (!text) {
    return false;
  }
  if (text.length > 90) {
    return false;
  }
  if (ADMINISTRATIVE_DENIAL_TEXT_PATTERN.test(text)) {
    return false;
  }

  const tokens = text
    .replace(/[^a-z0-9\s\-()]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (!tokens.length || tokens.length > 7) {
    return false;
  }

  if (ACTION_VERB_PATTERN.test(text)) {
    return false;
  }

  return true;
};

const normalizePercentage = (value) => {
  const parsed = Number(String(value ?? "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }
  return parsed;
};

const normalizeType = (value) => {
  const type = String(value || "new").toLowerCase().trim();
  if (ALLOWED_TYPES.has(type)) {
    return type;
  }
  return "new";
};

const conditionQualityScore = (value) => {
  const text = normalizeConditionOutput(value);
  if (!text) {
    return -999;
  }

  const tokens = text.split(/\s+/).filter(Boolean).length;
  const openParens = (text.match(/\(/g) || []).length;
  const closeParens = (text.match(/\)/g) || []).length;

  let score = Math.min(text.length, 140) + tokens * 4;
  if (/\($/.test(text)) {
    score -= 40;
  }
  if (openParens !== closeParens) {
    score -= 20;
  }
  if (/\b(?:also|claimed)\s*$/i.test(text)) {
    score -= 20;
  }

  return score;
};

const shouldReplaceConditionLabel = (candidate, existing) =>
  conditionQualityScore(candidate) > conditionQualityScore(existing);

export const preprocessScannerText = (rawText) => {
  const normalized = normalizeWhitespace(rawText);
  if (!normalized) {
    return "";
  }

  const lines = normalized
    .split(/\n/)
    .map((line) => collapseRepeatedFragments(collapseRepeatedWords(line)).trim())
    .filter(Boolean);

  const dedupedLines = [];
  let previousKey = "";

  lines.forEach((line) => {
    const key = normalizeLineKey(line);
    if (!key) {
      return;
    }
    if (key === previousKey) {
      return;
    }
    previousKey = key;
    dedupedLines.push(line);
  });

  return dedupedLines.join("\n").trim();
};

const normalizeDiagnosticStrings = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values
    .map((value) => String(value || '').trim())
    .filter(Boolean)));
};

export const buildScannerDiagnostics = ({
  stage = 'scan',
  parserProfile = null,
  classifier = null,
  usedOcr = false,
  ocrProfile = null,
  ocrConfidence = null,
  ocrScannerVersion = null,
  ocrFallbackError = null,
  warnings = [],
  errors = [],
  signals = [],
} = {}) => ({
  stage: String(stage || 'scan'),
  parserProfile: parserProfile ? String(parserProfile) : null,
  classifier: classifier ? String(classifier) : null,
  usedOcr: Boolean(usedOcr),
  ocrProfile: ocrProfile ? String(ocrProfile) : null,
  ocrConfidence: Number.isFinite(Number(ocrConfidence)) ? Number(ocrConfidence) : null,
  ocrScannerVersion: ocrScannerVersion ? String(ocrScannerVersion) : null,
  ocrFallbackError: ocrFallbackError ? String(ocrFallbackError) : null,
  warnings: normalizeDiagnosticStrings(warnings),
  errors: normalizeDiagnosticStrings(errors),
  signals: normalizeDiagnosticStrings(signals),
});

export const buildExtractionMeta = ({
  scannerType,
  schemaVersion,
  confidence = 0,
  fieldsPopulated = 0,
  fieldsTotal = 0,
  extras = {},
} = {}) => ({
  scannerType: String(scannerType || "unknown"),
  scannerVersion: SCANNER_SCHEMA_VERSIONS[String(scannerType || "")] || String(schemaVersion || "1.0.0"),
  schemaVersion: String(schemaVersion || "1.0.0"),
  confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
  fieldsPopulated: Math.max(0, Number(fieldsPopulated) || 0),
  fieldsTotal: Math.max(0, Number(fieldsTotal) || 0),
  extractedAt: new Date().toISOString(),
  diagnostics: extras?.diagnostics && typeof extras.diagnostics === 'object' && !Array.isArray(extras.diagnostics)
    ? extras.diagnostics
    : undefined,
  ...extras,
});

const sanitizeServiceConnectedEntries = (entries) => {
  if (!Array.isArray(entries)) {
    return [];
  }

  const deduped = [];
  const seen = new Map();

  entries.forEach((entry) => {
    const condition = normalizeConditionOutput(entry?.condition);
    const percentage = normalizePercentage(entry?.percentage);
    if (!condition || percentage === null) {
      return;
    }

    const entryId = entry?.id ? String(entry.id).trim() : "";
    const key = entryId
      ? `id:${entryId}`
      : `${normalizeConditionCompare(condition)}|${percentage}`;
    if (!key) {
      return;
    }

    const candidate = {
      id: entryId || undefined,
      condition,
      percentage,
      effective_date: typeof entry?.effective_date === "string" ? entry.effective_date.trim() : "",
      type: normalizeType(entry?.type)
    };

    const exactIndex = seen.get(key);
    if (Number.isInteger(exactIndex)) {
      if (shouldReplaceConditionLabel(candidate.condition, deduped[exactIndex]?.condition || "")) {
        deduped[exactIndex] = candidate;
      }
      return;
    }

    const nearIndex = deduped.findIndex((existing) =>
      existing.percentage === percentage &&
      (normalizeConditionCompare(existing.condition) === normalizeConditionCompare(condition) ||
        isNearDuplicateCondition(existing.condition, condition))
    );

    if (nearIndex >= 0) {
      if (shouldReplaceConditionLabel(candidate.condition, deduped[nearIndex]?.condition || "")) {
        const previousKey = `${normalizeConditionCompare(deduped[nearIndex].condition)}|${deduped[nearIndex].percentage}`;
        deduped[nearIndex] = candidate;
        seen.delete(previousKey);
        seen.set(key, nearIndex);
      }
      return;
    }

    const index = deduped.push(candidate) - 1;
    seen.set(key, index);
  });

  return deduped;
};

const sanitizeDeniedEntries = (entries) => {
  if (!Array.isArray(entries)) {
    return [];
  }

  const deduped = [];
  const seen = new Set();

  entries.forEach((entry) => {
    const rawCondition = typeof entry === "string"
      ? entry
      : (entry?.condition || entry?.name || entry?.disability || "");
    const condition = normalizeConditionOutput(rawCondition);
    if (!condition) {
      return;
    }
    if (!isLikelyDeniedConditionText(condition)) {
      return;
    }

    const key = normalizeConditionCompare(condition);
    if (!key) {
      return;
    }

    const reason = typeof entry === "string"
      ? ""
      : String(entry?.reason || entry?.reason_for_denial || entry?.denial_reason || "").trim();

    const nearIndex = deduped.findIndex((existing) =>
      normalizeConditionCompare(existing.condition) === key ||
      isNearDuplicateCondition(existing.condition, condition)
    );

    if (nearIndex >= 0) {
      if (!deduped[nearIndex].reason && reason) {
        deduped[nearIndex].reason = reason;
      }
      return;
    }

    seen.add(key);

    deduped.push({
      condition,
      status: "denied",
      rating: "NSC",
      reason
    });
  });

  return deduped;
};

export const validateScannerOutput = (rawResult) => {
  const safeResult = rawResult && typeof rawResult === "object" ? rawResult : {};
  const rawServiceConnected =
    safeResult.serviceConnected ||
    safeResult.service_connected ||
    safeResult.sc ||
    [];
  const rawDenied =
    safeResult.denied ||
    safeResult.deniedConditions ||
    safeResult.denied_conditions ||
    safeResult.denials ||
    [];

  const serviceConnected = sanitizeServiceConnectedEntries(rawServiceConnected);
  const deniedCandidateRows = sanitizeDeniedEntries(rawDenied);
  const serviceConnectedKeys = new Set(
    serviceConnected
      .map((entry) => normalizeConditionCompare(entry?.condition))
      .filter(Boolean)
  );

  const denied = deniedCandidateRows.filter((entry) => {
    const key = normalizeConditionCompare(entry?.condition);
    if (!key) {
      return false;
    }
    return !serviceConnectedKeys.has(key);
  });

  const allConditions = [
    ...serviceConnected.map((entry) => ({
      ...entry,
      status: "service_connected"
    })),
    ...denied
  ];

  return {
    serviceConnected,
    denied,
    allConditions,
    service_connected: serviceConnected,
    deniedConditions: denied
  };
};

export const getDisabilityDedupKey = (condition, percentage, id) => {
  const normalizedId = id ? String(id).trim() : "";
  if (normalizedId) {
    return `id:${normalizedId}`;
  }

  const normalizedCondition = normalizeConditionCompare(condition);
  const normalizedPercentage = normalizePercentage(percentage);
  if (!normalizedCondition || normalizedPercentage === null) {
    return "";
  }
  return `${normalizedCondition}|${normalizedPercentage}`;
};

