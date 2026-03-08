import { preprocessScannerText, validateScannerOutput } from "./scannerMiddleware.js";

const EMPTY_RESULT = {
  serviceConnected: [],
  denied: [],
  allConditions: [],
  service_connected: [],
  deniedConditions: []
};

/**
 * Authoritative VA Decision Scanner.
 * Input: full plain-text decision letter.
 * Output: strict JSON with `service_connected` and `denied` arrays,
 * or an empty structured result when no data is found.
 */

const DATE_PATTERN =
  /([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;

const MONTH_INDEX = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12
};

const normalizeWhitespace = (value) =>
  String(value || "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
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

const normalizeCondition = (value) =>
  collapseRepeatedConditionPhrase(
    String(value || "")
      .replace(/^[\s\-–—:;,.]+/, "")
      .replace(/\s*\|\s*/g, " ")
      .replace(/\s*\bservice connection for\b\s*/i, "")
      .replace(/\s*\(claimed as[^\)]*\)/gi, "")
      .replace(/\s*\([^\)]*$/g, "")
      .replace(/\s*\([^\)]*\)\s*$/g, "")
      .replace(/\.\s*service connection for\b[\s\S]*$/i, "")
      .replace(/\bservice connection has been[\s\S]*$/i, "")
      .replace(/\bthe effective date of this grant[\s\S]*$/i, "")
      .replace(/\bwe have no record[\s\S]*$/i, "")
      .replace(/\bis denied\b[\s\S]*$/i, "")
      .replace(/\brights to appeal\b[\s\S]*$/i, "")
      .replace(/\b(disability evaluation|evaluation)\b/gi, "")
      .replace(/\b(?:also|claimed)\s*$/i, "")
      .replace(/^(for|to|of|your)\s+/i, "")
      .replace(/\b([A-Za-z][A-Za-z'\-]*)\s+\1\b/gi, "$1")
      .replace(/[\s\-–—:;,.]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  );

const normalizeConditionComparison = (value) =>
  normalizeCondition(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b([a-z0-9]+)\s+\1\b/g, "$1")
    .trim();

const normalizeName = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

const normalizeConditionIdentity = (value) =>
  String(value || "")
    .replace(/^[\s\-–—:;,.]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const extractDecisionSectionText = (text) => {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return "";
  }

  const upper = normalized.toUpperCase();
  const reasonsIndex = upper.indexOf("REASONS FOR DECISION");

  let startIndex = -1;
  const decisionHeaderRegex = /^\s*DECISION\s*$/gim;
  let decisionHeaderMatch;

  while ((decisionHeaderMatch = decisionHeaderRegex.exec(normalized)) !== null) {
    if (reasonsIndex !== -1 && decisionHeaderMatch.index < reasonsIndex) {
      startIndex = decisionHeaderMatch.index;
    }
  }

  if (startIndex === -1) {
    const headerMatch = normalized.match(/^\s*DECISION\s*$/im);
    startIndex = headerMatch ? headerMatch.index : upper.indexOf("DECISION");
  }

  if (startIndex === -1) {
    return "";
  }

  const endMarkers = [
    "REASONS FOR DECISION",
    "REASONS",
    "EVIDENCE",
    "FINDINGS",
    "CONCLUSION",
    "ORDER",
    "INTRODUCTION",
    "APPLICABLE LAWS",
    "REFERENCES"
  ];

  let endIndex = normalized.length;
  for (const marker of endMarkers) {
    const markerIndex = upper.indexOf(marker, startIndex + 1);
    if (markerIndex !== -1 && markerIndex < endIndex) {
      endIndex = markerIndex;
    }
  }

  return normalized.slice(startIndex, endIndex).trim();
};

const stripConditionNarrativeTail = (value) =>
  String(value || "")
    .replace(/\bif you or someone you know\b[\s\S]*$/i, "")
    .replace(/\b(?:based on|secondary to|associated with|due to|as a result of|resulting from|claimed as)\b[\s\S]*$/i, "")
    .replace(/\b(?:effective|from)\b\s+[A-Za-z0-9,\/-]+[\s\S]*$/i, "")
    .replace(/\b(?:reconsideration|reconsidered)\b[\s\S]*$/i, "")
    .trim();

const hashString = (value) => {
  let hash = 5381;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const normalizePercent = (value) => {
  const parsed = Number(String(value || "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (parsed < 0 || parsed > 100) {
    return null;
  }
  return parsed;
};

const mergeConditions = (serviceConnected, deniedConditions) => {
  const finalList = [];
  const seenServiceConnected = new Set();

  (serviceConnected || []).forEach((entry) => {
    const key = normalizeName(entry?.condition);
    if (key) {
      seenServiceConnected.add(key);
    }
    finalList.push({
      ...entry,
      status: entry?.status || "service_connected"
    });
  });

  (deniedConditions || []).forEach((entry) => {
    const key = normalizeName(entry?.condition);
    if (key && seenServiceConnected.has(key)) {
      return;
    }
    finalList.push({
      ...entry,
      status: "denied",
      rating: "NSC"
    });
  });

  return finalList;
};

const toIsoDate = (rawDate) => {
  const value = String(rawDate || "").trim();
  if (!value) {
    return "";
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return value;
  }

  const monthNameMatch = value.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (monthNameMatch) {
    const month = MONTH_INDEX[monthNameMatch[1].toLowerCase()];
    const day = Number(monthNameMatch[2]);
    const year = Number(monthNameMatch[3]);
    if (month && day >= 1 && day <= 31) {
      return `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const slashOrDashMatch = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slashOrDashMatch) {
    const month = Number(slashOrDashMatch[1]);
    const day = Number(slashOrDashMatch[2]);
    let year = Number(slashOrDashMatch[3]);
    if (year < 100) {
      year += year >= 50 ? 1900 : 2000;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return "";
};

const classifyType = (text) => {
  const lowered = String(text || "").toLowerCase();
  if (/(increase|increased|raised|higher evaluation)/.test(lowered)) {
    return "increase";
  }
  if (/(continue|continued|confirm|confirmed|remain(s)? at)/.test(lowered)) {
    return "continued";
  }
  return "new";
};

const collectParagraphs = (text) => {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }

  const byBlankLine = normalized
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\n+/g, " ").trim())
    .filter(Boolean);

  const source = byBlankLine.length >= 2
    ? byBlankLine
    : normalized
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const splitByMarkers = source.flatMap((part) =>
    part
      .split(
        /(?=(?:\b\d+\.\s*)?(?:Service connection for|Entitlement to service connection for))/gi
      )
      .map((segment) => segment.trim())
      .filter(Boolean)
  );

  return splitByMarkers.length ? splitByMarkers : source;
};

const extractEffectiveDate = (text) => {
  const effectiveMatch = String(text || "").match(/(?:effective|from)\s+([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  return effectiveMatch ? toIsoDate(effectiveMatch[1]) : "";
};

const extractStagedRatings = (text) => {
  const stages = [];
  const stagePattern = /(\d{1,3})\s*(?:%|percent)[\s\S]{0,80}?(?:effective|from)\s+([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi;
  let match;
  while ((match = stagePattern.exec(String(text || ""))) !== null) {
    const percentage = normalizePercent(match[1]);
    if (percentage === null) {
      continue;
    }
    stages.push({
      percentage,
      effective_date: toIsoDate(match[2])
    });
  }
  return stages;
};

const reasonKeywordPattern =
  /(because|due to|no nexus|not related|not incurred|not caused|not aggravated|no diagnosis|clinically diagnosed|no record|insufficient evidence|does not show|lack of|not shown in service|not found in service|began in (?:military )?service|incurred in or caused by service|caused by service|secondary to|proximately due to|no evidence|without evidence|no chronic|no continuity|not established|less likely than not)/i;

const denialCuePattern =
  /\b(denied|not|no|fails to show|less likely than not|insufficient|not related|not incurred|not aggravated|not shown|no evidence|without evidence|no nexus)\b/i;

const grantCuePattern = /\b(granted|awarded|established|assigned|increased|continued|confirmed)\b/i;

const isGenericDenialText = (value) =>
  /\b(?:service connection|entitlement to)[^.!?]{0,120}\bdenied\b/i.test(String(value || "")) &&
  !reasonKeywordPattern.test(String(value || ""));

const isRegulatoryOnlyText = (value) =>
  /(\b38\s*cfr\b|c\.f\.r\.|\bu\.s\.c\b|§)/i.test(String(value || "")) &&
  !reasonKeywordPattern.test(String(value || ""));

/**
 * Normalize a denial reason by collapsing whitespace and ensuring proper formatting.
 */
const normalizeDenialReason = (reason) => {
  if (!reason) return "";
  return String(reason)
    .replace(/\r/g, "\n")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const extractReasonSentence = (text) => {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "Reason not found in extracted text.";
  }

  // Try to extract the full "denied because" statement with complete text
  const deniedBecauseMatch = cleaned.match(
    /denied because\s+(.+?)(?=\s*(?:\d+\.\s+Service connection for\b|REFERENCES?:|EVIDENCE:|APPLICABLE LAWS?:|$))/i
  );
  if (deniedBecauseMatch) {
    const reason = deniedBecauseMatch[1]
      .trim()
      .split(/\b(?:REFERENCES?:|EVIDENCE:|APPLICABLE LAWS?:|Title\s+38\b)/i)[0]
      .trim();

    const wordCount = reason ? reason.split(/\s+/).filter(Boolean).length : 0;
    if (reason.length > 25 && wordCount >= 5 && !isRegulatoryOnlyText(reason)) {
      // Return the full reason, ensuring it ends with a period
      return reason.endsWith(".") ? reason : `${reason}.`;
    }
  }

  const clinicalMatch = cleaned.match(
    /(denied because the\s+medical evidence[^.!?]*clinically diagnosed[^.!?]*)(?:[.!?]|$)/i
  );
  if (clinicalMatch) {
    const clause = clinicalMatch[1].trim();
    return /[.!?]$/.test(clause) ? clause : `${clause}.`;
  }

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const reasonSentence = sentences.find((sentence) =>
    (reasonKeywordPattern.test(sentence) || denialCuePattern.test(sentence)) &&
    !isGenericDenialText(sentence) &&
    !isRegulatoryOnlyText(sentence) &&
    !/(references?:|title\s+38\b|code of federal regulations)/i.test(sentence) &&
    !grantCuePattern.test(sentence)
  );
  if (reasonSentence) {
    return reasonSentence;
  }

  const fallbackSentence = sentences.find((sentence) =>
    denialCuePattern.test(sentence) &&
    !isGenericDenialText(sentence) &&
    !isRegulatoryOnlyText(sentence) &&
    !/(references?:|title\s+38\b|code of federal regulations)/i.test(sentence) &&
    !grantCuePattern.test(sentence)
  );
  if (fallbackSentence) {
    return fallbackSentence;
  }

  return "Reason not found in extracted text.";
};

const findNearbyReason = (paragraphs, denialIndex) => {
  const candidates = [];
  // Capture up to 4 paragraphs following the denial to get complete explanations
  for (let offset = 0; offset <= 4; offset += 1) {
    const para = paragraphs[denialIndex + offset];
    if (para) {
      candidates.push(para);
    }
  }

  // Look for a paragraph containing reason keywords
  const reasonParagraph = candidates.find((paragraph) => reasonKeywordPattern.test(paragraph));
  
  // Use the reason paragraph if found, otherwise join all candidates for context
  const fullReason = reasonParagraph || candidates.join(" ");
  
  // Normalize the full text to handle line breaks and extra whitespace
  const normalized = normalizeDenialReason(fullReason);
  return extractReasonSentence(normalized);
};

const findReasonForCondition = (paragraphs, condition) => {
  if (!Array.isArray(paragraphs)) {
    return "";
  }

  const normalizedCondition = normalizeConditionComparison(condition);
  if (!normalizedCondition) {
    return "";
  }

  const conditionParagraph = paragraphs.find((paragraph) => {
    const normalizedParagraph = normalizeConditionComparison(paragraph);
    return normalizedParagraph.includes(normalizedCondition) && reasonKeywordPattern.test(paragraph);
  });

  return conditionParagraph || "";
};

const extractServiceConnected = (paragraphs, fullText = "") => {
  const serviceConnected = [];

  const isLikelyNoise = (condition) => {
    const lowered = String(condition || "").toLowerCase();
    return (
      !lowered ||
      lowered.includes("denied") ||
      lowered.includes("rights to appeal") ||
      lowered.includes("file number") ||
      lowered.includes("notice of disagreement") ||
      lowered.includes("payment")
    );
  };

  const pushServiceConnected = ({ condition, percentage, effective_date, type }) => {
    const rawCondition = normalizeConditionIdentity(condition);
    const cleanedCondition = stripConditionNarrativeTail(rawCondition);
    const normalizedCondition = normalizeCondition(cleanedCondition);
    const normalizedPercentage = normalizePercent(percentage);
    if (!normalizedCondition || normalizedPercentage === null || isLikelyNoise(normalizedCondition)) {
      return;
    }

    const normalizedType = ["new", "increase", "continued"].includes(type) ? type : "new";
    const normalizedDate = toIsoDate(effective_date);
    serviceConnected.push({
      condition: normalizedCondition,
      percentage: normalizedPercentage,
      effective_date: normalizedDate,
      type: normalizedType
    });
  };

  const patterns = [
    {
      regex:
        /service connection for\s+([^\.\n]+?)\s+(?:is|was)?\s*(granted|awarded|established)(?:[\s\S]{0,220}?)?(?:with\s+an\s+evaluation\s+of|evaluation\s+of|at|to)\s+(\d{1,3})\s*(?:%|percent)\b/i,
      extract: (match) => ({ condition: match[1], percentage: match[3] })
    },
    {
      regex:
        /service connection for\s+([^\.\n]+?)\s+is\s+granted[\s\S]{0,200}?(\d{1,3})\s*(?:%|percent)\b/i,
      extract: (match) => ({ condition: match[1], percentage: match[2] })
    },
    {
      regex:
        /service connection for\s+([^\.\n]+?)\s+(?:is|was)?\s*granted[\s\S]{0,200}?noncompensable\s+evaluation\b/i,
      extract: (match) => ({ condition: match[1], percentage: 0 })
    },
    {
      regex:
        /evaluation for\s+([^\.\n]+?)\s+(?:is|was)?\s*(increased|continued|confirmed)\s+to\s+(\d{1,3})\s*(?:%|percent)\b/i,
      extract: (match) => ({ condition: match[1], percentage: match[3] })
    },
    {
      regex: /([^\.\n]+?)\s+(?:is|was)?\s*(?:evaluated|rated)\s+at\s+(\d{1,3})\s*(?:%|percent)\b/i,
      extract: (match) => ({ condition: match[1], percentage: match[2] })
    },
    {
      regex: /^\s*(.+?)\s+(?:service\s*connected|sc)\s+(\d{1,3})\s*%/i,
      extract: (match) => ({ condition: match[1], percentage: match[2] })
    }
  ];

  paragraphs.forEach((paragraph) => {
    const context = String(paragraph || "").replace(/\s+/g, " ").trim();
    if (!/(service connection|evaluation|assigned|rated|percent|%)/i.test(context)) {
      return;
    }
    if (/\bdenied\b/i.test(context) && !/\b(granted|awarded|established|assigned|increased|continued|confirmed)\b/i.test(context)) {
      return;
    }

    for (const pattern of patterns) {
      const match = context.match(pattern.regex);
      if (!match) {
        continue;
      }

      const extracted = pattern.extract(match);
      const condition = extracted?.condition || "";
      const percentage = extracted?.percentage;

      const type = classifyType(context);
      const stagedRatings = extractStagedRatings(context);
      if (stagedRatings.length) {
        stagedRatings.forEach((stage) => {
          pushServiceConnected({
            condition,
            percentage: stage.percentage,
            effective_date: stage.effective_date,
            type
          });
        });
        break;
      }

      pushServiceConnected({
        condition,
        percentage,
        effective_date: extractEffectiveDate(context),
        type
      });
      break;
    }
  });

  if (fullText) {
    const normalized = normalizeWhitespace(fullText).replace(/\n/g, " ");
    const grantPattern = /service connection for\s+([^\.]+?)\s+is\s+granted\s+with\s+an\s+evaluation\s+of\s+(\d{1,3})\s*(?:%|percent)\b/gi;
    let match;

    while ((match = grantPattern.exec(normalized)) !== null) {
      const condition = match[1];
      const percentage = match[2];
      const sliceStart = Math.max(0, match.index - 40);
      const sliceEnd = Math.min(normalized.length, match.index + 240);
      const context = normalized.slice(sliceStart, sliceEnd);

      pushServiceConnected({
        condition,
        percentage,
        effective_date: extractEffectiveDate(context),
        type: classifyType(context)
      });
    }

    const grantAnchorPattern = /service connection for\s+([^\.]+?)\s+is\s+granted\b/gi;
    while ((match = grantAnchorPattern.exec(normalized)) !== null) {
      const condition = match[1];
      const nextAnchor = normalized.indexOf("service connection for", match.index + 1);
      const sliceEnd = nextAnchor > -1 ? nextAnchor : Math.min(normalized.length, match.index + 320);
      const context = normalized.slice(match.index, sliceEnd);
      const percentMatch = context.match(/evaluation\s+of\s+(\d{1,3})\s*(?:%|percent)\b/i);
      if (!percentMatch) {
        continue;
      }

      pushServiceConnected({
        condition,
        percentage: percentMatch[1],
        effective_date: extractEffectiveDate(context),
        type: classifyType(context)
      });
    }
  }

  return serviceConnected;
};

const DENIED_SECTION_HEADER_PATTERN = /^(?:not service connected|denied|conditions not service connected|decision:\s*denied)\b/i;

const NON_DENIED_SECTION_HEADER_PATTERN =
  /^(?:service connected|service connection granted|reasons? for decision|evidence|favorable findings|decision|order|conclusion|applicable laws?|references)\b/i;

const ADMINISTRATIVE_DENIAL_TEXT_PATTERN =
  /\b(?:disagreement|appeal|appeals|appellate|decision|benefit|benefits|final|evidence|review|notice|rights?|within\s+one\s+year|one\s+year|va\s*form|send\s+us|file\s+(?:a\s+)?(?:claim|disagreement)|military\s+service\s+and\s+va|payment|records\s+request)\b/i;

const ACTION_VERB_PATTERN =
  /\b(?:is|are|was|were|will|would|should|must|can|may|have|has|had|be|become|becomes|becoming|submit|send|file|review|request|consider)\b/i;

const isLikelyDeniedConditionText = (value) => {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return false;
  }
  if (text.length > 90) {
    return false;
  }
  if (/\d{1,3}\s*(?:%|percent)\b/i.test(text)) {
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

const cleanDeniedLine = (line) =>
  String(line || "")
    .replace(/^\s*(?:[-*•]+|\d+[\).:-])\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const extractDeniedFromSectionLine = (line) => {
  const text = cleanDeniedLine(line);
  if (!text) {
    return { condition: "", reason: "" };
  }

  if (ADMINISTRATIVE_DENIAL_TEXT_PATTERN.test(text)) {
    return { condition: "", reason: "" };
  }

  const deniedMatch =
    text.match(/(?:entitlement to\s+)?service connection for\s+(.+?)\s+(?:is|was|remains)?\s*denied\b/i) ||
    text.match(/^(.+?)\s+(?:is|was|remains)?\s*denied\b/i);

  if (deniedMatch) {
    return {
      condition: deniedMatch[1],
      reason: extractReasonSentence(text)
    };
  }

  const reasonHintIndex = text.search(/\b(?:because|due to|no nexus|not related|not incurred|not caused|insufficient|lack of)\b/i);
  if (reasonHintIndex > 0) {
    const conditionPart = text.slice(0, reasonHintIndex).replace(/[\s:;,.\-]+$/g, "").trim();
    if (!isLikelyDeniedConditionText(conditionPart)) {
      return { condition: "", reason: "" };
    }
    return {
      condition: conditionPart,
      reason: extractReasonSentence(text)
    };
  }

  if (isLikelyDeniedConditionText(text)) {
    return {
      condition: text,
      reason: "Reason not found in extracted text."
    };
  }

  return { condition: "", reason: "" };
};

const extractDeniedSectionEntries = (fullText) => {
  const lines = normalizeWhitespace(fullText)
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const entries = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!DENIED_SECTION_HEADER_PATTERN.test(line)) {
      continue;
    }

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const candidate = lines[cursor];
      if (DENIED_SECTION_HEADER_PATTERN.test(candidate)) {
        break;
      }
      if (NON_DENIED_SECTION_HEADER_PATTERN.test(candidate)) {
        break;
      }

      const extracted = extractDeniedFromSectionLine(candidate);
      if (!extracted.condition) {
        continue;
      }

      entries.push({
        condition: extracted.condition,
        reason_for_denial: extracted.reason
      });
    }
  }

  return entries;
};

const parseDeniedConditions = (text) => {
  const deniedSections = [
    "NOT SERVICE CONNECTED",
    "DENIED",
    "CONDITIONS NOT SERVICE CONNECTED",
    "DECISION: DENIED"
  ];

  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }

  const results = [];

  deniedSections.forEach((section) => {
    const regex = new RegExp(
      `${section}[\\s\\S]*?(?=SERVICE CONNECTED|EVIDENCE|REASONS|DECISION|$)`,
      "i"
    );
    const match = normalized.match(regex);
    if (!match) {
      return;
    }

    const lines = match[0]
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    lines.forEach((line) => {
      if (DENIED_SECTION_HEADER_PATTERN.test(line)) {
        return;
      }
      if (!/denied|not service connected/i.test(line)) {
        return;
      }

      const deniedMatch =
        line.match(/service connection for\s+(.+?)\s+(?:is|was|remains)?\s*denied\b/i) ||
        line.match(/^(.+?)\s+(?:is|was|remains)?\s*denied\b/i);

      const rawCondition = deniedMatch
        ? deniedMatch[1]
        : line.replace(/denied|not service connected/gi, "").trim();
      const condition = normalizeCondition(rawCondition);
      if (!condition || !isLikelyDeniedConditionText(condition)) {
        return;
      }

      // DO NOT extract reason here - let extractDenied handle it from "denied because" sections
      // Just add the condition to the list
      results.push({
        condition,
        status: "denied",
        rating: "NSC",
        reason: "" // Empty - will be filled by extractDenied
      });
    });
  });

  return results;
};

const buildDeniedReasonLookup = (fullText) => {
  const normalized = normalizeWhitespace(fullText);
  if (!normalized) {
    return new Map();
  }

  // Join lines to handle text split across lines  
  const joined = normalized.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  
  const map = new Map();
  
  const pattern = /service connection for\s+([^.]+?)\s+is\s+denied\s+because\s+([\s\S]{20,700}?)(?=\s+\d+\.\s+Service connection for|\s+REFERENCES?:|\s+EVIDENCE:|\s+APPLICABLE LAWS?:|$)/gi;

  let match;
  while ((match = pattern.exec(joined)) !== null) {
    let rawCondition = match[1].trim();
    let detail = match[2].trim();
    
    detail = detail
      .replace(/\s+/g, " ")
      .split(/\b(?:REFERENCES?:|EVIDENCE:|APPLICABLE LAWS?:|Title\s+38\b)/i)[0]
      .replace(/\s+\d+\.\s+Service connection for\b[\s\S]*$/i, "")
      .replace(/\s+$/, "")
      .trim();

    if (detail && !/[.!?]$/.test(detail)) {
      detail = `${detail}.`;
    }
    
    // Clean up the condition - it might have extra text
    // Remove content after "Service connection" keywords
    rawCondition = rawCondition.replace(/\bservice connection.*$/i, '').trim();
    
    // Normalize condition 
    const condition = normalizeCondition(rawCondition);
    const key = normalizeConditionComparison(condition);
    
    // Only accept substantial reasons (minimum 20 characters)
    if (!key || !detail || detail.length < 15) {
      continue;
    }

    // Check if we already have this condition (avoid duplicates)
    if (map.has(key)) {
      continue;
    }

    // Format the complete denial reason - this is the FULL sentence from the PDF
    const sentence = `Service connection for ${condition} is denied because ${detail}`;
    map.set(key, sentence);
  }

  return map;
};

const escapeRegexLiteral = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isWeakDeniedReason = (value) => {
  const text = normalizeDenialReason(value);
  if (!text || text === "Reason not found in extracted text.") {
    return true;
  }
  if (text.length < 35) {
    return true;
  }
  if (/denied because the\.?$/i.test(text)) {
    return true;
  }
  if (!/[a-z]{4,}\s+[a-z]{4,}/i.test(text)) {
    return true;
  }
  return false;
};

const extractConditionSpecificDeniedClause = (sourceText, condition) => {
  const normalizedSource = normalizeWhitespace(sourceText).replace(/\n/g, " ").replace(/\s+/g, " ");
  const escapedCondition = escapeRegexLiteral(condition).replace(/\s+/g, "\\s+");

  const simpleSentencePattern = new RegExp(
    `service connection for\\s+${escapedCondition}\\s+is\\s+denied\\s+because\\s+([^\\.]{10,500}\\.)`,
    "i"
  );
  const simpleSentenceMatch = normalizedSource.match(simpleSentencePattern);
  if (simpleSentenceMatch && simpleSentenceMatch[1]) {
    const simpleClause = simpleSentenceMatch[1].replace(/\s+/g, " ").trim();
    if (simpleClause.length >= 20 && !/^the\.?$/i.test(simpleClause)) {
      return simpleClause.replace(/[.!?]+$/g, "").trim();
    }
  }

  const pattern = new RegExp(
    `service connection for\\s+${escapedCondition}\\s+is\\s+denied\\s+because\\s+([\\s\\S]{20,700}?)(?=\\s+\\d+\\.\\s+Service connection for|\\s+REFERENCES?:|\\s+EVIDENCE:|\\s+APPLICABLE LAWS?:|$)`,
    "i"
  );

  const match = normalizedSource.match(pattern);
  if (!match || !match[1]) {
    return "";
  }

  let clause = match[1]
    .replace(/\s+/g, " ")
    .split(/\b(?:REFERENCES?:|EVIDENCE:|APPLICABLE LAWS?:|Title\s+38\b)/i)[0]
    .trim();

  if (!clause) {
    return "";
  }

  clause = clause.replace(/[.!?]+$/g, "").trim();
  return clause;
};

const formatDeniedReason = (condition, clauseOrSentence) => {
  const text = normalizeDenialReason(clauseOrSentence);
  if (!text) {
    return "Reason not found in extracted text.";
  }
  if (text === "Reason not found in extracted text.") {
    return text;
  }
  if (/^service connection for\b/i.test(text)) {
    return /[.!?]$/.test(text) ? text : `${text}.`;
  }
  const clause = text.replace(/^because\s+/i, "").replace(/[.!?]+$/g, "").trim();
  if (!clause) {
    return "Reason not found in extracted text.";
  }
  return `Service connection for ${condition} is denied because ${clause}.`;
};

const extractDenied = (paragraphs, fullText = "") => {
  const denied = [];
  const seen = new Set();
  const reasonLookup = buildDeniedReasonLookup(fullText);
  const denyPatterns = [
    /(entitlement to\s+)?service connection for\s+(.+?)\s+(?:is|was|remains)?\s*denied\b/i,
    /denial of\s+(?:entitlement to\s+)?service connection for\s+(.+?)(?:\.|$)/i,
    /entitlement to\s+(?:an\s+)?(?:increased|higher)?\s*evaluation\s+for\s+(.+?)\s+(?:is|was|remains)?\s*denied\b/i,
    /we\s+denied\s+service\s+connection\s+for\s+(.+?)\s+because\s+(.+?)(?:\.|$)/i,
    /for\s+(.+?)\s+(?:is|was|remains)?\s*denied\b/i,
    /^(.+?)\s+(?:is|was|remains)?\s*denied\b/i
  ];

  const pushDenied = (rawCondition, reason, reasonParagraphs = []) => {
    const condition = normalizeCondition(rawCondition);
    if (!condition) {
      return;
    }
    if (!isLikelyDeniedConditionText(condition)) {
      return;
    }

    const key = condition.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    const comparisonKey = normalizeConditionComparison(condition);

    const recoverConditionSpecificReason = () => {
      const recoveredClause = extractConditionSpecificDeniedClause(fullText, condition);
      if (!recoveredClause) {
        return "";
      }
      return formatDeniedReason(condition, recoveredClause);
    };
    
    // PRIORITY 1: Use explicit "denied because" lookup from full text
    // This is the most reliable source - extracted from Rating Narrative section
    const lookupReason = reasonLookup.get(comparisonKey);
    if (lookupReason && lookupReason.length > 15) {
      // Found a complete reason in the lookup - use it directly
      let fullReason = formatDeniedReason(condition, lookupReason);
      if (isWeakDeniedReason(fullReason)) {
        const recovered = recoverConditionSpecificReason();
        if (recovered) {
          fullReason = recovered;
        }
      }
      denied.push({
        condition,
        reason_for_denial: fullReason
      });
      return;
    }

    // PRIORITY 2: Extract from nearby paragraphs if provided
    if (reason && reason.length > 20) {
      let extractedReason = extractReasonSentence(normalizeDenialReason(reason));
      extractedReason = formatDeniedReason(condition, extractedReason);
      if (isWeakDeniedReason(extractedReason)) {
        const recovered = recoverConditionSpecificReason();
        if (recovered) {
          extractedReason = recovered;
        }
      }
      if (extractedReason && extractedReason !== "Reason not found in extracted text.") {
        denied.push({
          condition,
          reason_for_denial: extractedReason
        });
        return;
      }
    }
    
    // PRIORITY 3: Search all paragraphs for reason matching this condition
    const inferred = findReasonForCondition(reasonParagraphs, condition);
    if (inferred && inferred.length > 20) {
      let inferredReason = extractReasonSentence(normalizeDenialReason(inferred));
      inferredReason = formatDeniedReason(condition, inferredReason);
      if (isWeakDeniedReason(inferredReason)) {
        const recovered = recoverConditionSpecificReason();
        if (recovered) {
          inferredReason = recovered;
        }
      }
      if (inferredReason && inferredReason !== "Reason not found in extracted text.") {
        denied.push({
          condition,
          reason_for_denial: inferredReason
        });
        return;
      }
    }

    // FALLBACK: If no reason found, still include the condition
    const recovered = recoverConditionSpecificReason();
    denied.push({
      condition,
      reason_for_denial: recovered || "Reason not found in extracted text."
    });
  };

  const sectionEntries = extractDeniedSectionEntries(fullText);
  sectionEntries.forEach((entry) => {
    pushDenied(entry?.condition, entry?.reason_for_denial || "", paragraphs);
  });

  paragraphs.forEach((paragraph, index) => {
    const context = String(paragraph || "").replace(/\s+/g, " ").trim();
    if (!/denied/i.test(context)) {
      return;
    }

    const match = denyPatterns
      .map((pattern) => context.match(pattern))
      .find(Boolean);
    if (!match) {
      return;
    }

    const isWeDenied = /^\s*we\s+denied\b/i.test(match[0]);
    const rawCondition = isWeDenied ? match[1] : (match[2] || match[1]);
    const reason = isWeDenied ? (match[2] || "") : findNearbyReason(paragraphs, index);
    pushDenied(rawCondition, reason, paragraphs);
  });

  return denied;
};

const scanRatingNarrative = (fullText) => {
  try {
    const preprocessedText = preprocessScannerText(fullText);
    if (!preprocessedText) {
      return { ...EMPTY_RESULT };
    }

    const decisionText = extractDecisionSectionText(preprocessedText) || preprocessedText;
    const decisionParagraphs = collectParagraphs(decisionText);
    if (!decisionParagraphs.length) {
      return { ...EMPTY_RESULT };
    }

    const fullParagraphs = collectParagraphs(preprocessedText);

    const serviceConnected = extractServiceConnected(decisionParagraphs, preprocessedText);
    const deniedFromParagraphs = extractDenied(fullParagraphs, preprocessedText);
    // Note: deniedFromSections removed - extractDenied should handle all denied conditions
    // with full "denied because" reasons from the Rating Narrative section
    const deniedConditions = deniedFromParagraphs;

    const validated = validateScannerOutput({
      serviceConnected,
      denied: deniedConditions
    });

    return {
      ...validated,
      allConditions: mergeConditions(validated.serviceConnected, validated.denied)
    };
  } catch {
    return { ...EMPTY_RESULT };
  }
};

export const parseVADecisionScanner = (fullText) => scanRatingNarrative(fullText);

export { parseDeniedConditions, normalizeName, mergeConditions, scanRatingNarrative };

export default parseVADecisionScanner;

