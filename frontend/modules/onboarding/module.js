import { postOnboarding } from "../../js/api.js";
import {
  getOnboardingResult,
  setOnboardingResult,
  setVeteranId,
  getRatingNarrative,
  setRatingNarrative,
  clearRatingNarrative,
  getRatingCalc,
  setRatingCalc
} from "../../js/state.js";
import { createStepIndicator, updateStepIndicator } from "../common/module.js";
import { parseVADecisionScanner } from "./vaDecisionScanner.js";
import { getDisabilityDedupKey, validateScannerOutput } from "./scannerMiddleware.js";
import {
  buildEffectiveRatingsFromConditions,
  getCombinedRating,
  getCombinedRatingRaw
} from "../../js/vaCombinedRating.js";
import {
  scanVaDecisionLetter,
  buildCombinedRatingResultFromConditions,
  canonicalizeName
} from "../../js/vaRatingEngine.js";

const STEPS = 4;
const MAX_NARRATIVE_BYTES = 5 * 1024 * 1024;

const isDebugEnabled = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("rfDebug") === "1" || params.get("debug") === "1") {
    return true;
  }

  try {
    return localStorage.getItem("rallyforge:debug") === "1";
  } catch (error) {
    return false;
  }
};

const cleanConditionText = (condition) =>
  String(condition || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s*\|\s*/g, " ")
    .replace(/^\s*service connection for\s+/i, "")
    .replace(/\.\s*service connection for[\s\S]*$/i, "")
    .replace(/\bservice connection has been[\s\S]*$/i, "")
    .replace(/\bhas been established as directly related to military service[\s\S]*$/i, "")
    .replace(/\bthe effective date of this grant[\s\S]*$/i, "")
    .replace(/\bwe have no record[\s\S]*$/i, "")
    .replace(/\bis denied\b[\s\S]*$/i, "")
    .replace(/\bif you or someone you know\b[\s\S]*$/i, "")
    .replace(/\(\s*claimed(?:\s+as)?[\s\S]*$/i, "")
    .replace(/\(\s*$/g, "")
    .replace(/\b([A-Za-z][A-Za-z'\-]*)\s+\1\b/gi, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s\-–—:;,.]+$/g, "")
    .trim();

const normalizeDeniedReason = (reason) =>
  String(reason || "")
    .replace(/\s+/g, " ")
    .replace(/[.;:,!?]+$/g, "")
    .trim();

const getBestDeniedReason = (entry) => {
  const primary = normalizeDeniedReason(entry?.reason_for_denial);
  if (primary) {
    return primary;
  }

  const fallback = normalizeDeniedReason(entry?.reason);
  if (fallback) {
    return fallback;
  }

  return normalizeDeniedReason(entry?.denial_reason);
};

const dedupeServiceConnectedByConditionAndPercent = (scanResult) => {
  if (!scanResult || !Array.isArray(scanResult.service_connected)) {
    return;
  }

  const seenPair = new Set();
  const pairDeduped = scanResult.service_connected.filter((entry) => {
    const percent = Number(entry?.percentage);
    const normalizedPercent = Number.isFinite(percent) ? percent : 0;
    const cleanedCondition = cleanConditionText(entry?.condition);
    const pairKey = getDisabilityDedupKey(cleanedCondition, normalizedPercent, entry?.id);
    if (!pairKey) {
      return false;
    }

    if (seenPair.has(pairKey)) {
      return false;
    }
    seenPair.add(pairKey);

    entry.condition = cleanedCondition || entry?.condition || "";
    entry.percentage = normalizedPercent;
    return true;
  });

  scanResult.service_connected = pairDeduped;
};

const normalizeRenderConditionKey = (condition) =>
  canonicalizeName(cleanConditionText(condition))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenizeRenderConditionKey = (condition) =>
  normalizeRenderConditionKey(condition)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

const areNearDuplicateRenderConditions = (leftCondition, rightCondition) => {
  const left = normalizeRenderConditionKey(leftCondition);
  const right = normalizeRenderConditionKey(rightCondition);
  if (!left || !right) {
    return false;
  }
  if (left === right) {
    return true;
  }
  if (left.includes(right) || right.includes(left)) {
    return true;
  }

  const leftTokens = tokenizeRenderConditionKey(left);
  const rightTokens = tokenizeRenderConditionKey(right);
  if (!leftTokens.length || !rightTokens.length) {
    return false;
  }

  const leftSet = new Set(leftTokens);
  const overlap = rightTokens.filter((token) => leftSet.has(token)).length;
  const denominator = Math.max(leftTokens.length, rightTokens.length);
  return overlap / denominator >= 0.8;
};

const getRenderEntryQuality = (entry) => {
  const condition = cleanConditionText(entry?.condition || "");
  if (!condition) {
    return -999;
  }

  const normalized = normalizeRenderConditionKey(condition);
  const tokenCount = normalized.split(" ").filter(Boolean).length;
  const openParens = (condition.match(/\(/g) || []).length;
  const closeParens = (condition.match(/\)/g) || []).length;
  let score = Math.min(condition.length, 140) + tokenCount * 4;

  if (/\($/.test(condition)) {
    score -= 40;
  }
  if (openParens !== closeParens) {
    score -= 20;
  }
  if (/\b(?:also|claimed)\s*$/i.test(condition)) {
    score -= 20;
  }

  return score;
};

const getRenderStatusKey = (entry) => {
  const status = normalizeStatus(entry?.status);
  if (status === "denied" || status === "nsc") {
    return "denied";
  }

  const percent = getConditionPercent(entry);
  if (Number.isFinite(percent)) {
    return `sc:${percent}`;
  }

  return status || "unknown";
};


const forceUniqueRenderedEntries = (entries) => {
  if (!Array.isArray(entries)) {
    return [];
  }

  const seen = new Map();
  const unique = [];

  entries.forEach((entry) => {
    const condition = cleanConditionText(entry?.condition || "");
    if (!condition) {
      return;
    }

    const statusKey = getRenderStatusKey(entry);
    const renderKey = normalizeRenderConditionKey(condition);
    if (!renderKey) {
      return;
    }

    const key = `${statusKey}|${renderKey}`;
    const exactIndex = seen.get(key);
    if (Number.isInteger(exactIndex)) {
      const currentQuality = getRenderEntryQuality(entry);
      const existingQuality = getRenderEntryQuality(unique[exactIndex]);
      if (currentQuality > existingQuality) {
        unique[exactIndex] = {
          ...entry,
          condition
        };
      }
      return;
    }

    const nearIndex = unique.findIndex((existing) =>
      getRenderStatusKey(existing) === statusKey &&
      areNearDuplicateRenderConditions(existing?.condition, condition)
    );

    if (nearIndex >= 0) {
      const currentQuality = getRenderEntryQuality(entry);
      const existingQuality = getRenderEntryQuality(unique[nearIndex]);
      if (currentQuality > existingQuality) {
        const previousKey = `${statusKey}|${normalizeRenderConditionKey(unique[nearIndex]?.condition || "")}`;
        unique[nearIndex] = {
          ...entry,
          condition
        };
        seen.delete(previousKey);
        seen.set(key, nearIndex);
      }
      return;
    }

    const index = unique.push({
      ...entry,
      condition
    }) - 1;
    seen.set(key, index);
  });

  return unique;
};

const filterUniqueConditionsForRender = (entries) => {
  if (!Array.isArray(entries)) {
    return [];
  }

  return forceUniqueRenderedEntries(entries);
};

const normalizeSortName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const getConditionPercent = (entry) => {
  const percent = Number(entry?.percentage ?? entry?.percent);
  return Number.isFinite(percent) ? percent : null;
};

const isServiceConnectedStatus = (entry) => {
  const status = normalizeStatus(entry?.status);
  const rating = normalizeStatus(entry?.rating);
  if (status === "denied" || status === "nsc") {
    return false;
  }
  if (rating === "nsc" || rating === "denied") {
    return false;
  }
  return status === "service_connected" || status === "sc" || status === "";
};

const stableSortConditions = (entries) => {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const leftEntry = left.entry;
      const rightEntry = right.entry;

      const leftIsSC = isServiceConnectedStatus(leftEntry) && getConditionPercent(leftEntry) !== null;
      const rightIsSC = isServiceConnectedStatus(rightEntry) && getConditionPercent(rightEntry) !== null;

      if (leftIsSC !== rightIsSC) {
        return leftIsSC ? -1 : 1;
      }

      if (leftIsSC && rightIsSC) {
        const leftPercent = getConditionPercent(leftEntry) ?? 0;
        const rightPercent = getConditionPercent(rightEntry) ?? 0;
        if (leftPercent !== rightPercent) {
          return rightPercent - leftPercent;
        }

        const leftName = normalizeSortName(leftEntry?.canonicalName ?? leftEntry?.condition ?? leftEntry?.name);
        const rightName = normalizeSortName(rightEntry?.canonicalName ?? rightEntry?.condition ?? rightEntry?.name);
        const nameCompare = leftName.localeCompare(rightName, undefined, { sensitivity: "base" });
        if (nameCompare !== 0) {
          return nameCompare;
        }
      } else {
        const leftName = normalizeSortName(leftEntry?.canonicalName ?? leftEntry?.condition ?? leftEntry?.name);
        const rightName = normalizeSortName(rightEntry?.canonicalName ?? rightEntry?.condition ?? rightEntry?.name);
        const nameCompare = leftName.localeCompare(rightName, undefined, { sensitivity: "base" });
        if (nameCompare !== 0) {
          return nameCompare;
        }
      }

      return left.index - right.index;
    })
    .map(({ entry }) => entry);
};

const sortServiceConnectedByPercentDesc = (scanResult) => {
  if (!scanResult || !Array.isArray(scanResult.service_connected)) {
    return;
  }

  dedupeServiceConnectedByConditionAndPercent(scanResult);

  scanResult.service_connected = stableSortConditions(
    scanResult.service_connected.map((entry) => ({
      ...entry,
      status: "service_connected"
    }))
  ).map(({ status, ...entry }) => entry);
};

const materializeScanResultFromCombinedResult = (combinedResult) => {
  const serviceConnected = (combinedResult?.scConditions || []).map((condition) => ({
    id: condition.id,
    condition: condition.name,
    canonicalName: condition.canonicalName,
    percentage: Number(condition.percent) || 0,
    status: "service_connected",
    effective_date: condition.effectiveDate || "",
    type: "new"
  }));

  const denied = (combinedResult?.deniedConditions || []).map((condition) => ({
    id: condition.id,
    condition: condition.name,
    canonicalName: condition.canonicalName,
    status: "denied",
    rating: "NSC",
    reason_for_denial: condition.denialReason || "",
    reason: condition.denialReason || ""
  }));

  const allConditions = [
    ...serviceConnected.map((entry) => ({
      ...entry,
      status: "service_connected"
    })),
    ...denied
  ];

  return {
    serviceConnected,
    service_connected: serviceConnected,
    denied,
    deniedConditions: denied,
    allConditions,
    combinedResult
  };
};

const buildCombinedResultFromScanResult = (scanResult) => {
  const serviceConnected = Array.isArray(scanResult?.serviceConnected)
    ? scanResult.serviceConnected
    : [];
  const deniedConditions = Array.isArray(scanResult?.denied)
    ? scanResult.denied
    : [];

  const conditions = [
    ...serviceConnected.map((entry) => ({
      name: entry?.condition || "",
      status: "SC",
      percent: Number(entry?.percentage),
      effectiveDate: entry?.effective_date || null
    })),
    ...deniedConditions.map((entry) => ({
      name: entry?.condition || "",
      status: "Denied",
      percent: null,
      denialReason: entry?.reason_for_denial || entry?.reason || null
    }))
  ];

  return buildCombinedRatingResultFromConditions(conditions, { useBilateralFactor: true });
};

const sanitizeScanResult = (scanResult) => {
  if (!scanResult || typeof scanResult !== "object") {
    return scanResult;
  }

  if (scanResult.combinedResult) {
    const materialized = materializeScanResultFromCombinedResult(scanResult.combinedResult);
    scanResult.serviceConnected = materialized.serviceConnected;
    scanResult.service_connected = materialized.service_connected;
    scanResult.denied = materialized.denied;
    scanResult.deniedConditions = materialized.deniedConditions;
    scanResult.allConditions = sortConditionsForDisplay(materialized.allConditions);
    return scanResult;
  }

  const validated = validateScannerOutput(scanResult);
  const base = {
    serviceConnected: Array.isArray(validated.serviceConnected)
      ? [...validated.serviceConnected]
      : [],
    denied: Array.isArray(validated.denied)
      ? [...validated.denied]
      : []
  };

  const combinedResult = buildCombinedResultFromScanResult(base);
  const materialized = materializeScanResultFromCombinedResult(combinedResult);

  scanResult.serviceConnected = materialized.serviceConnected;
  scanResult.service_connected = materialized.service_connected;
  scanResult.denied = materialized.denied;
  scanResult.deniedConditions = materialized.deniedConditions;
  scanResult.allConditions = sortConditionsForDisplay(materialized.allConditions);
  scanResult.combinedResult = combinedResult;

  return scanResult;
};

const runVADecisionScan = (fullText) => {
  const combinedResult = scanVaDecisionLetter(fullText, {
    parseVADecisionScanner,
    useBilateralFactor: true
  });
  const scanResult = materializeScanResultFromCombinedResult(combinedResult);
  return sanitizeScanResult(scanResult);
};

const fetchScannerOutput = async () => {
  try {
    const response = await fetch("/api/scanner/latest");
    if (!response.ok) {
      return null;
    }
    const payload = await response.json().catch(() => null);
    const data = payload?.data;
    if (!data) {
      return null;
    }
    const hasService = Array.isArray(data.serviceConnected) && data.serviceConnected.length;
    const hasDenied = Array.isArray(data.denied) && data.denied.length;
    if (!hasService && !hasDenied) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const fetchScannerScanText = async (text) => {
  try {
    const response = await fetch("/api/scanner/scan-text", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    const data = payload?.data;
    if (!data) {
      return null;
    }

    const hasService = Array.isArray(data.serviceConnected) && data.serviceConnected.length;
    const hasDenied = Array.isArray(data.denied) && data.denied.length;
    if (!hasService && !hasDenied) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
};

const detectAuthorityDocumentText = (text) => {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return false;
  }

  const hasTitle38Cfr = /\btitle\s+38\s+of\s+the\s+code\s+of\s+federal\s+regulations\b/i.test(normalized);
  const partHeaders = (normalized.match(/\bPART\s+[0-9]{1,2}\b/gim) || []).length;
  const subpartHeaders = (normalized.match(/\bSubpart\s+[A-Z0-9]+\b/gim) || []).length;
  const sectionMarkers = (normalized.match(/(?:^|\s)§\s*[0-9]+\.[0-9A-Za-z\-]+/gim) || []).length;

  if ((partHeaders >= 2 && subpartHeaders >= 1) || (hasTitle38Cfr && sectionMarkers >= 3)) {
    return true;
  }

  return false;
};

const fetchAuthorityAnalyzeText = async (text) => {
  try {
    const response = await fetch("/api/authority/analyze-text", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    return payload?.data || null;
  } catch {
    return null;
  }
};

const buildAuthorityScanResult = (authorityData) => {
  const summary = authorityData?.summary || {};
  return {
    source: authorityData?.source || "authority_live",
    documentType: authorityData?.documentType || "authority_document",
    serviceConnected: [],
    service_connected: [],
    denied: [],
    deniedConditions: [],
    allConditions: [],
    authorityResult: authorityData,
    error: `Authority document indexed: ${summary.sections || 0} sections, ${summary.citations || 0} citations.`
  };
};

const processNarrativeText = async (text) => {
  const normalized = String(text || "");

  if (detectAuthorityDocumentText(normalized)) {
    const authorityData = await fetchAuthorityAnalyzeText(normalized);
    if (authorityData) {
      return buildAuthorityScanResult(authorityData);
    }
  }

  let scanResult = runVADecisionScan(normalized);

  if (!Array.isArray(scanResult?.serviceConnected) || !scanResult.serviceConnected.length) {
    const scannerData = await fetchScannerScanText(normalized) || await fetchScannerOutput();
    if (scannerData) {
      scanResult = sanitizeScanResult({
        serviceConnected: scannerData.serviceConnected,
        denied: scannerData.denied
      });
      if (scanResult?.combinedResult) {
        scanResult.combinedResult.source = scannerData?.source || "scanner_output";
      }
    }
  }

  return scanResult;
};

const sortConditionsForDisplay = (entries) => stableSortConditions(entries);

const buildDeniedReasonPanel = (deniedEntries) => {
  if (!Array.isArray(deniedEntries) || !deniedEntries.length) {
    return null;
  }

  const panel = document.createElement("div");
  panel.className = "rating-denied-reason-panel";

  const title = document.createElement("div");
  title.className = "rating-denied-reason-title";
  title.textContent = "Denial reasons";
  panel.appendChild(title);

  const list = document.createElement("ol");
  list.className = "rating-denied-reason-list";

  deniedEntries.forEach((entry, index) => {
    const condition = String(entry?.condition || "").trim();
    const rating = String(entry?.rating || "NSC").trim() || "NSC";
    const reasonText = getBestDeniedReason(entry);
    const displayReason = reasonText || "Reason not found in extracted text.";

    const item = document.createElement("li");
    item.className = "rating-denied-reason-item";
    item.setAttribute("data-denied-reason-index", String(index + 1));

    const conditionLine = document.createElement("div");
    conditionLine.textContent = condition ? `${condition} — ${rating}` : `Denied — ${rating}`;

    const reasonLine = document.createElement("div");
    reasonLine.textContent = `Denial reason: ${displayReason}`;

    item.appendChild(conditionLine);
    item.appendChild(reasonLine);
    list.appendChild(item);
  });

  panel.appendChild(list);
  return panel;
};

const buildValidationPanel = (warnings) => {
  if (!Array.isArray(warnings) || !warnings.length) {
    return null;
  }

  const panel = document.createElement("div");
  panel.className = "rating-validation-panel";

  const title = document.createElement("div");
  title.className = "rating-validation-title";
  title.textContent = "Validation warnings";
  panel.appendChild(title);

  const list = document.createElement("ul");
  list.className = "rating-validation-list";

  warnings.forEach((warning) => {
    const item = document.createElement("li");
    item.textContent = String(warning || "").trim();
    list.appendChild(item);
  });

  panel.appendChild(list);
  return panel;
};


const getWizardRoot = () => document.querySelector("[data-onboarding]");

const getWizardSteps = (root) => Array.from(root?.querySelectorAll?.(".step") || []);

const getWizardIndex = (root) => {
  const steps = getWizardSteps(root);
  const activeIndex = steps.findIndex((step) => step.classList.contains("active"));
  return activeIndex === -1 ? 0 : activeIndex;
};

const setWizardIndex = (root, index) => {
  const steps = getWizardSteps(root);
  if (!steps.length) {
    return;
  }

  const nextIndex = Math.min(steps.length - 1, Math.max(0, index));
  steps.forEach((step, stepIndex) => {
    step.classList.toggle("active", stepIndex === nextIndex);
  });

  root.classList.toggle("is-rating-fullscreen", nextIndex === 1);

  const bar = root.querySelector("[data-step-bar]");
  const label = root.querySelector("[data-step-label]");
  const percent = ((nextIndex + 1) / steps.length) * 100;
  if (bar) {
    bar.style.width = `${percent}%`;
  }
  if (label) {
    label.textContent = `Step ${nextIndex + 1} of ${steps.length}`;
  }

  const prev = root.querySelector("[data-prev]");
  const next = root.querySelector("[data-next]");
  const submit = root.querySelector("[data-submit]");
  if (prev) {
    prev.disabled = nextIndex === 0;
  }
  if (next) {
    next.style.display = nextIndex === steps.length - 1 ? "none" : "inline-flex";
  }
  if (submit) {
    submit.style.display = nextIndex === steps.length - 1 ? "inline-flex" : "none";
  }
};

const ensureGlobalWizardNav = () => {
  if (window.RFOnboardingNav) {
    return;
  }

  window.RFOnboardingNav = {
    next: () => {
      const root = getWizardRoot();
      if (!root) {
        return;
      }
      const status = root.querySelector("[data-status]");
      if (status) {
        status.textContent = "Next clicked.";
      }
      setWizardIndex(root, getWizardIndex(root) + 1);
    },
    prev: () => {
      const root = getWizardRoot();
      if (!root) {
        return;
      }
      const status = root.querySelector("[data-status]");
      if (status) {
        status.textContent = "Back clicked.";
      }
      setWizardIndex(root, getWizardIndex(root) - 1);
    }
  };
};

ensureGlobalWizardNav();

const computeCombinedRatingRaw = (entries, combinedResult) =>
  Number.isFinite(combinedResult?.rawCombined)
    ? combinedResult.rawCombined
    : getCombinedRatingRaw(buildEffectiveRatingsFromConditions(entries));

const formatCombinedPercent = (value) => {
  const safeValue = Number.isFinite(value) ? value : 0;
  const fixed = safeValue.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
};

const buildCombinedRatingPanel = (serviceConnected, combinedResult) => {
  if (!Array.isArray(serviceConnected) || !serviceConnected.length) {
    return null;
  }

  const rawCombined = computeCombinedRatingRaw(serviceConnected, combinedResult);
  const roundedCombined = Number.isFinite(combinedResult?.roundedCombined)
    ? combinedResult.roundedCombined
    : getCombinedRating(buildEffectiveRatingsFromConditions(serviceConnected));

  const panel = document.createElement("div");
  panel.className = "rating-combined-panel";
  panel.innerHTML = `
    <div class="rating-combined-title">Service-connected combined rating</div>
    <div class="rating-combined-values">
      <div class="rating-combined-row">
        <span class="rating-combined-label">Raw combined</span>
        <span class="rating-combined-number">${formatCombinedPercent(rawCombined)}%</span>
      </div>
      <div class="rating-combined-row">
        <span class="rating-combined-label">Rounded combined</span>
        <span class="rating-combined-number">${roundedCombined}%</span>
      </div>
    </div>
  `;

  return panel;
};

const renderRatingScanResult = (root, scanResult) => {
  const tools = root?.querySelector?.("[data-rating-tools]");
  if (!tools) {
    return;
  }

  const disabilities = tools.querySelector("[data-rating-disabilities]");
  if (!disabilities) {
    return;
  }

  disabilities.innerHTML = "";
  sanitizeScanResult(scanResult);

  const serviceConnected = Array.isArray(scanResult?.serviceConnected)
    ? scanResult.serviceConnected
    : [];
  const allConditions = sortConditionsForDisplay(
    Array.isArray(scanResult?.allConditions)
      ? scanResult.allConditions
      : serviceConnected
  );

  const isAuthoritySource = String(scanResult?.source || "").startsWith("authority");
  if (isAuthoritySource) {
    const summary = scanResult?.authorityResult?.summary || {};
    const panel = document.createElement("div");
    panel.className = "rating-empty";
    panel.textContent = `Authority reference indexed (${summary.sections || 0} sections, ${summary.citations || 0} citations). Rating scanner is disabled for this document type.`;
    disabilities.appendChild(panel);
    return;
  }

  if (!allConditions.length) {
    const empty = document.createElement("div");
    empty.className = "rating-empty";
    empty.textContent = "No service-connected disabilities found.";
    disabilities.appendChild(empty);
    return;
  }

  const editList = document.createElement("div");
  editList.className = "rating-edit-list";

  let serviceConnectedIndex = 0;

  allConditions.forEach((entry, index) => {
    const isDenied = String(entry?.status || "").toLowerCase() === "denied";
    const row = document.createElement("div");
    row.className = "rating-edit-row";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = String(entry?.condition || "");
    nameInput.setAttribute("aria-label", `Disability ${index + 1} name`);

    const percentInput = document.createElement("input");
    percentInput.type = isDenied ? "text" : "number";
    if (!isDenied) {
      percentInput.min = "0";
      percentInput.max = "100";
      percentInput.step = "10";
      const parsedPercent = Number(entry?.percentage);
      percentInput.value = Number.isFinite(parsedPercent) ? String(parsedPercent) : "0";
      percentInput.setAttribute("aria-label", `Disability ${index + 1} percent`);
    } else {
      percentInput.value = String(entry?.rating || "NSC");
      percentInput.setAttribute("aria-label", `Disability ${index + 1} rating`);
      percentInput.readOnly = true;
    }

    if (isDenied) {
      nameInput.disabled = true;
      percentInput.disabled = true;
      row.classList.add("rating-denied-row", "denied-row");
    }

    const removeButton = document.createElement("button");
    if (isDenied) {
      removeButton.type = "button";
      removeButton.className = "ghost rating-edit-remove";
      removeButton.textContent = "Denied";
      removeButton.disabled = true;
      removeButton.setAttribute("aria-label", `Denied disability ${index + 1}`);
    } else {
      const editableIndex = serviceConnectedIndex;
      serviceConnectedIndex += 1;
      removeButton.type = "button";
      removeButton.className = "ghost rating-edit-remove";
      removeButton.textContent = "Remove";
      removeButton.setAttribute("aria-label", `Remove disability ${index + 1}`);

      nameInput.addEventListener("input", (event) => {
        scanResult.serviceConnected[editableIndex].condition = event.target.value;
        scanResult.service_connected = scanResult.serviceConnected;
        sanitizeScanResult(scanResult);
        const currentNarrative = getRatingNarrative();
        if (currentNarrative) {
          setRatingNarrative({
            ...currentNarrative,
            scanResult
          });
        }
      });

      percentInput.addEventListener("input", (event) => {
        const rawValue = Number(event.target.value);
        const safePercent = Number.isFinite(rawValue) ? Math.min(100, Math.max(0, rawValue)) : 0;
        scanResult.serviceConnected[editableIndex].percentage = safePercent;
        scanResult.service_connected = scanResult.serviceConnected;
        sanitizeScanResult(scanResult);
        const currentNarrative = getRatingNarrative();
        if (currentNarrative) {
          setRatingNarrative({
            ...currentNarrative,
            scanResult
          });
        }
      });

      removeButton.addEventListener("click", () => {
        scanResult.serviceConnected = scanResult.serviceConnected.filter((_, rowIndex) => rowIndex !== editableIndex);
        scanResult.service_connected = scanResult.serviceConnected;
        sanitizeScanResult(scanResult);
        const currentNarrative = getRatingNarrative();
        if (currentNarrative) {
          setRatingNarrative({
            ...currentNarrative,
            scanResult
          });
        }
        renderRatingScanResult(root, scanResult);
      });
    }

    row.appendChild(nameInput);
    row.appendChild(percentInput);
    row.appendChild(removeButton);
    editList.appendChild(row);
  });

  disabilities.appendChild(editList);

  const combinedPanel = buildCombinedRatingPanel(serviceConnected, scanResult?.combinedResult);
  if (combinedPanel) {
    disabilities.appendChild(combinedPanel);
  }

  const deniedOnly = allConditions.filter((entry) => String(entry?.status || "").toLowerCase() === "denied");
  const deniedPanel = buildDeniedReasonPanel(deniedOnly);
  if (deniedPanel) {
    disabilities.appendChild(deniedPanel);
  }

  const warningsPanel = buildValidationPanel(scanResult?.combinedResult?.validationWarnings);
  if (warningsPanel) {
    disabilities.appendChild(warningsPanel);
  }

};

// Deprecated compatibility path: legacy global listener kept to avoid breaking
// existing onboarding flows. All extraction is delegated to the authoritative
// VA Decision Scanner module via runVADecisionScan.
const ensureGlobalRatingScanner = () => {
  if (window.__rfRatingScannerAttached) {
    return;
  }
  window.__rfRatingScannerAttached = true;

  document.addEventListener(
    "change",
    (event) => {
      const input = event.target?.closest?.("[data-rating-upload]");
      if (!input) {
        return;
      }
      if (input.dataset.rfScopedScanner === "true") {
        return;
      }

      const root = getWizardRoot();
      const tools = root?.querySelector?.("[data-rating-tools]");
      const fileStatus = tools?.querySelector?.("[data-rating-file]");

      const file = input.files?.[0];
      if (!file) {
        return;
      }

      if (file.size > MAX_NARRATIVE_BYTES) {
        if (fileStatus) {
          fileStatus.textContent = "File too large. Please upload a file under 5 MB.";
        }
        const scanResult = { error: "No rating data found in the document." };
        setRatingNarrative({
          name: file.name,
          type: file.type,
          size: file.size,
          scanResult
        });
        renderRatingScanResult(root, scanResult);
        return;
      }

      if (fileStatus) {
        fileStatus.textContent = "Reading document...";
      }

      const handleText = async (text) => {
        const scanResult = await processNarrativeText(text);

        setRatingNarrative({
          name: file.name,
          type: file.type,
          size: file.size,
          scanResult
        });
        if (fileStatus) {
          const isAuthoritySource = String(scanResult?.source || "").startsWith("authority");
          const isScannerSource =
            scanResult?.combinedResult?.source === "scanner_output"
            || scanResult?.combinedResult?.source === "scanner_live";
          const suffix = isAuthoritySource
            ? " — AUTHORITY INDEXED"
            : isScannerSource
              ? " — INTEGRATED SCANNER"
              : "";
          fileStatus.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)${suffix}`;
        }
        renderRatingScanResult(root, scanResult);
      };

      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        extractPdfText(file)
          .then((text) => handleText(text))
          .catch((error) => {
            const scanResult = { error: error?.message || "No rating data found in the document." };
            setRatingNarrative({
              name: file.name,
              type: file.type,
              size: file.size,
              scanResult
            });
            if (fileStatus) {
              fileStatus.textContent = error?.message || "Unable to read PDF.";
            }
            renderRatingScanResult(root, scanResult);
          });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        handleText(typeof reader.result === "string" ? reader.result : "");
      };
      reader.onerror = () => {
        const scanResult = { error: "No rating data found in the document." };
        setRatingNarrative({
          name: file.name,
          type: file.type,
          size: file.size,
          scanResult
        });
        if (fileStatus) {
          fileStatus.textContent = "Unable to read file.";
        }
        renderRatingScanResult(root, scanResult);
      };
      reader.readAsText(file);
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      const remove = event.target?.closest?.("[data-rating-remove]");
      if (!remove) {
        return;
      }
      const root = getWizardRoot();
      const tools = root?.querySelector?.("[data-rating-tools]");
      const fileStatus = tools?.querySelector?.("[data-rating-file]");
      const input = tools?.querySelector?.("[data-rating-upload]");

      clearRatingNarrative();
      if (input) {
        input.value = "";
      }
      if (fileStatus) {
        fileStatus.textContent = "Upload a narrative (PDF/text, max 5 MB).";
      }
      renderRatingScanResult(root, { error: "No rating data found in the document." });
    },
    true
  );
};

// Keep legacy global scanner path active as a fallback so rating uploads
// continue to work even if module init order changes.
ensureGlobalRatingScanner();

let sharedBranches = [];
let sharedComponents = [];
let sharedTheaters = [];
let sharedStates = [];
let sharedAwards = [];

const loadSharedData = async () => {
  if (sharedBranches.length || sharedStates.length || sharedAwards.length) {
    return;
  }

  try {
    const [branchesModule, statesModule, awardsModule] = await Promise.all([
      import("../../../packages/shared-data/src/constants/branches.js"),
      import("../../../packages/shared-data/src/constants/states.js"),
      import("../../../packages/shared-data/src/constants/awardsList.js")
    ]);

    sharedBranches = branchesModule.BRANCHES || [];
    sharedComponents = branchesModule.COMPONENTS || [];
    sharedTheaters = branchesModule.THEATERS || [];
    sharedStates = statesModule.STATES || [];
    sharedAwards = awardsModule.AWARDS_LIST || [];
    return;
  } catch (error) {
    console.warn("Shared data import failed, using fallback constants.", error);
  }

  sharedBranches = ["Army", "Navy", "Air Force", "Marine Corps", "Coast Guard", "Space Force"];
  sharedComponents = ["Active Duty", "Reserve", "National Guard"];
  sharedTheaters = ["CONUS", "Europe", "Pacific", "Middle East", "Africa", "Global"];
  sharedStates = [
    "Alabama",
    "Alaska",
    "Arizona",
    "Arkansas",
    "California",
    "Colorado",
    "Connecticut",
    "Delaware",
    "Florida",
    "Georgia",
    "Hawaii",
    "Idaho",
    "Illinois",
    "Indiana",
    "Iowa",
    "Kansas",
    "Kentucky",
    "Louisiana",
    "Maine",
    "Maryland",
    "Massachusetts",
    "Michigan",
    "Minnesota",
    "Mississippi",
    "Missouri",
    "Montana",
    "Nebraska",
    "Nevada",
    "New Hampshire",
    "New Jersey",
    "New Mexico",
    "New York",
    "North Carolina",
    "North Dakota",
    "Ohio",
    "Oklahoma",
    "Oregon",
    "Pennsylvania",
    "Rhode Island",
    "South Carolina",
    "South Dakota",
    "Tennessee",
    "Texas",
    "Utah",
    "Vermont",
    "Virginia",
    "Washington",
    "West Virginia",
    "Wisconsin",
    "Wyoming",
    "District of Columbia",
    "American Samoa",
    "Guam",
    "Northern Mariana Islands",
    "Puerto Rico",
    "U.S. Virgin Islands"
  ];
  sharedAwards = [
    { id: "CIB", name: "Combat Infantryman Badge", category: "combat_award" },
    { id: "CAB", name: "Combat Action Badge", category: "combat_award" },
    { id: "CMB", name: "Combat Medical Badge", category: "combat_award" },
    { id: "CAR", name: "Combat Action Ribbon", category: "combat_award" },
    { id: "AFCAM", name: "Air Force Combat Action Medal", category: "combat_award" },
    { id: "BSM_V", name: "Bronze Star Medal with V", category: "valor_award" },
    { id: "ARCOM_V", name: "Army Commendation Medal with V", category: "valor_award" },
    { id: "NAVCOM_V", name: "Navy/USMC Commendation Medal with V", category: "valor_award" },
    { id: "AFCOM_V", name: "Air Force Commendation Medal with V", category: "valor_award" },
    { id: "AM_V", name: "Air Medal with V", category: "valor_award" },
    { id: "PH", name: "Purple Heart", category: "medical_related_award" },
    { id: "ICM", name: "Iraq Campaign Medal", category: "campaign_medal" },
    { id: "ACM", name: "Afghanistan Campaign Medal", category: "campaign_medal" },
    { id: "GWOTEM", name: "Global War on Terrorism Expeditionary Medal", category: "campaign_medal" },
    { id: "SASM", name: "Southwest Asia Service Medal", category: "campaign_medal" },
    { id: "KLM_SA", name: "Kuwait Liberation Medal (Saudi Arabia)", category: "campaign_medal" },
    { id: "KLM_KU", name: "Kuwait Liberation Medal (Kuwait)", category: "campaign_medal" },
    { id: "VSM", name: "Vietnam Service Medal", category: "campaign_medal" },
    { id: "AFEM", name: "Armed Forces Expeditionary Medal", category: "campaign_medal" },
    { id: "KCM", name: "Kosovo Campaign Medal", category: "campaign_medal" },
    { id: "IRCM", name: "Inherent Resolve Campaign Medal", category: "campaign_medal" },
    { id: "EFCM", name: "Enduring Freedom Campaign Medal", category: "campaign_medal" },
    { id: "PARACHUTIST_BADGE", name: "Parachutist Badge", category: "hazardous_duty_badge" },
    { id: "AIR_ASSAULT_BADGE", name: "Air Assault Badge", category: "hazardous_duty_badge" },
    { id: "EOD_BADGE", name: "Explosive Ordnance Disposal Badge", category: "hazardous_duty_badge" },
    { id: "DIVER_BADGE", name: "Diver Badge", category: "hazardous_duty_badge" },
    { id: "FLIGHT_CREW_WINGS", name: "Flight Crew Wings", category: "hazardous_duty_badge" },
    { id: "SPECIAL_FORCES_TAB", name: "Special Forces Tab", category: "hazardous_duty_badge" },
    { id: "RANGER_TAB", name: "Ranger Tab", category: "hazardous_duty_badge" },
    { id: "SAPPER_TAB", name: "Sapper Tab", category: "hazardous_duty_badge" },
    { id: "PATHFINDER_BADGE", name: "Pathfinder Badge", category: "hazardous_duty_badge" },
    { id: "AVIATION_BADGES", name: "Aviation Badges (Wings)", category: "hazardous_duty_badge" },
    { id: "AFSM", name: "Armed Forces Service Medal", category: "service_medal" },
    { id: "HSM", name: "Humanitarian Service Medal", category: "service_medal" },
    { id: "OSR", name: "Overseas Service Ribbon", category: "service_medal" },
    { id: "SSDR", name: "Sea Service Deployment Ribbon", category: "service_medal" },
    { id: "NATO_MEDAL", name: "NATO Medal", category: "service_medal" },
    { id: "AM", name: "Air Medal", category: "medical_related_award" },
    { id: "DFC", name: "Distinguished Flying Cross", category: "medical_related_award" },
    { id: "WIA", name: "Wounded in Action", category: "medical_related_award" },
    { id: "POWM", name: "Prisoner of War Medal", category: "high_honor_award" },
    { id: "MOH", name: "Medal of Honor", category: "high_honor_award" },
    { id: "SILVER_STAR", name: "Silver Star", category: "high_honor_award" },
    { id: "DSC", name: "Distinguished Service Cross", category: "high_honor_award" },
    { id: "NAVY_CROSS", name: "Navy Cross", category: "high_honor_award" },
    { id: "AIR_FORCE_CROSS", name: "Air Force Cross", category: "high_honor_award" },
    { id: "BSM", name: "Bronze Star Medal", category: "high_honor_award" },
    { id: "PUC", name: "Presidential Unit Citation", category: "unit_award" },
    { id: "JMUA", name: "Joint Meritorious Unit Award", category: "unit_award" },
    { id: "NUC", name: "Navy Unit Commendation", category: "unit_award" },
    { id: "VUA", name: "Army Valorous Unit Award", category: "unit_award" },
    { id: "MUC", name: "Meritorious Unit Commendation", category: "unit_award" },
    { id: "AFOUA_V", name: "Air Force Outstanding Unit Award (V)", category: "unit_award" },
    { id: "CGUC", name: "Coast Guard Unit Commendation", category: "unit_award" },
    { id: "NDOSM", name: "Nuclear Deterrence Operations Service Medal", category: "rare_award" },
    { id: "ARCTIC_SERVICE_RIBBON", name: "Arctic Service Ribbon", category: "rare_award" },
    { id: "ANTARCTICA_SERVICE_MEDAL", name: "Antarctica Service Medal", category: "rare_award" },
    { id: "NWPB", name: "Nuclear Weapons Personnel Badge", category: "rare_award" },
    { id: "RWB", name: "Radiation Worker Badge", category: "rare_award" }
  ];
};

const loadPdfJs = async () => {
  if (window.pdfjsLib) {
    return window.pdfjsLib;
  }

  await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.min.mjs");
  if (!window.pdfjsLib) {
    throw new Error("Unable to load PDF parser.");
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs";
  return window.pdfjsLib;
};

const buildPdfLinesFromContent = (content) => {
  const items = Array.isArray(content?.items) ? content.items : [];
  const glyphs = items
    .map((item) => {
      const transform = Array.isArray(item.transform) ? item.transform : [];
      const x = Number(transform[4] ?? 0);
      const y = Number(transform[5] ?? 0);
      return {
        str: String(item.str || "").replace(/\s+/g, " ").trim(),
        x,
        y
      };
    })
    .filter((g) => g.str);

  // Sort top-to-bottom, then left-to-right
  glyphs.sort((a, b) => (b.y - a.y) || (a.x - b.x));

  const lineTolerance = 2.5;
  const lines = [];
  let current = null;

  const flush = () => {
    if (!current || !current.parts.length) {
      return;
    }
    current.parts.sort((a, b) => a.x - b.x);
    let line = "";
    let lastX = null;
    current.parts.forEach((part) => {
      if (!part.str) {
        return;
      }
      if (lastX !== null && part.x - lastX > 8) {
        line += " ";
      } else if (line && !line.endsWith(" ")) {
        line += " ";
      }
      line += part.str;
      lastX = part.x;
    });
    const normalized = line.replace(/\s{2,}/g, " ").trim();
    if (normalized) {
      lines.push(normalized);
    }
  };

  glyphs.forEach((glyph) => {
    if (!current) {
      current = { y: glyph.y, parts: [glyph] };
      return;
    }

    if (Math.abs(glyph.y - current.y) <= lineTolerance) {
      current.parts.push(glyph);
      return;
    }

    flush();
    current = { y: glyph.y, parts: [glyph] };
  });
  flush();

  return lines;
};

const extractPdfText = async (file) => {
  const pdfjsLib = await loadPdfJs();
  const data = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const lines = [];

  for (let pageIndex = 1; pageIndex <= doc.numPages; pageIndex += 1) {
    const page = await doc.getPage(pageIndex);
    const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
    lines.push(...buildPdfLinesFromContent(content), "");
  }

  return lines.join("\n").trim();
};

const ensureDebugPanel = (root) => {
  if (!isDebugEnabled()) {
    return null;
  }

  let panel = root.querySelector("[data-debug-panel]");
  if (panel) {
    return panel;
  }

  panel = document.createElement("div");
  panel.setAttribute("data-debug-panel", "");
  panel.style.cssText = "margin-top:16px;padding:12px;border:1px dashed #c4b7f2;border-radius:12px;background:#fff6f0;font-family:'Space Grotesk','Trebuchet MS',sans-serif;font-size:12px;color:#3a3e53;";
  root.appendChild(panel);
  return panel;
};

const updateDebugPanel = (root, form, stepIndex, isValid) => {
  const panel = ensureDebugPanel(root);
  if (!panel) {
    return;
  }

  const branch = getNamedValue(form, "branch");
  const component = getNamedValue(form, "component");
  const state = getNamedValue(form, "stateOfResidence");
  const combat = form.querySelector("input[name='combatSelfReported']:checked")?.value || "";
  const periods = Array.from(form.querySelectorAll(".service-period")).length;

  panel.innerHTML = `
    <div><strong>Debug:</strong> step ${stepIndex + 1}/${STEPS} | valid=${isValid}</div>
    <div>branch=${branch || "(empty)"} | component=${component || "(empty)"}</div>
    <div>periods=${periods} | combat=${combat || "(empty)"}</div>
    <div>state=${state || "(empty)"}</div>
  `;
};

const initRatingTools = (root) => {
  const tools = root.querySelector("[data-rating-tools]");
  if (!tools) {
    return;
  }

  const modeTabs = Array.from(tools.querySelectorAll("[data-rating-mode]"));
  const modePanels = Array.from(tools.querySelectorAll("[data-rating-panel]"));

  const setMode = (mode) => {
    modeTabs.forEach((tab) => {
      const isActive = tab.getAttribute("data-rating-mode") === mode;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    modePanels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.getAttribute("data-rating-panel") === mode);
    });
  };

  if (modeTabs.length && modePanels.length) {
    setMode("scanner");
    modeTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        setMode(tab.getAttribute("data-rating-mode"));
      });
    });
  }

  const uploadInput = tools.querySelector("[data-rating-upload]");
  if (uploadInput) {
    uploadInput.dataset.rfScopedScanner = "true";
  }
  const fileStatus = tools.querySelector("[data-rating-file]");
  const removeButton = tools.querySelector("[data-rating-remove]");
  const disabilities = tools.querySelector("[data-rating-disabilities]");
  let list = tools.querySelector("[data-rating-list]");
  let addButton = tools.querySelector("[data-rating-add]");
  if (!list) {
    list = root.querySelector("[data-rating-list]");
  }
  if (!addButton) {
    addButton = root.querySelector("[data-rating-add]");
  }
  const leftTableBody = tools.querySelector("#left-cr-table tbody");
  const rightTableBody = tools.querySelector("#right-cr-table tbody");
  const leftNewConditionInput = tools.querySelector("#left-new-condition");
  const rightNewConditionInput = tools.querySelector("#right-new-condition");
  const leftAddButton = tools.querySelector("#left-add-btn");
  const rightAddButton = tools.querySelector("#right-add-btn");
  const leftTotalEl = tools.querySelector("#cr-total-left");
  const rightTotalEl = tools.querySelector("#cr-total-right");
  const combinedEl = tools.querySelector("[data-rating-combined]");
  const toggleButton = tools.querySelector("[data-rating-toggle]");
  const content = tools.querySelector("[data-rating-content]");
  const hasDualPanels = Boolean(leftTableBody && rightTableBody);

  const ratingState = getRatingCalc();
  const persistedConditions = Array.isArray(ratingState?.conditions) ? ratingState.conditions : [];
  let conditions = persistedConditions
    .map((entry, index) => ({
      id: Number.isFinite(Number(entry?.id)) ? Number(entry.id) : index + 1,
      name: String(entry?.name || ""),
      percent: String(entry?.percent ?? "10"),
      side: ["left", "right", "none"].includes(entry?.side) ? entry.side : "none",
      panel: entry?.panel === "right" ? "right" : "left"
    }));
  let nextConditionId = conditions.reduce((maxValue, entry) => Math.max(maxValue, Number(entry?.id) || 0), 0) + 1;
  let parsedResult = null;

  const normalizePercent = (value) => {
    const parsed = Number(String(value || "").replace(/[^\d]/g, ""));
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.max(0, Math.min(100, parsed));
  };

  const normalizeSide = (value) => (["left", "right", "none"].includes(value) ? value : "none");


  const collectRowsForCalculation = () => {
    if (!hasDualPanels) {
      return conditions.map((entry) => ({
        id: entry.id,
        name: entry.name,
        percent: normalizePercent(entry.percent),
        side: normalizeSide(entry.side)
      }));
    }

    const rows = [];
    [leftTableBody, rightTableBody].forEach((tbody) => {
      if (!tbody) {
        return;
      }

      tbody.querySelectorAll("tr[data-contention-id]").forEach((row) => {
        const id = Number(row.getAttribute("data-contention-id"));
        const conditionInput = row.querySelector(".cr-condition-input");
        const percentSelect = row.querySelector(".cr-percent-select");
        const sideSelect = row.querySelector(".cr-side-select");

        rows.push({
          id,
          name: conditionInput?.value || "",
          percent: normalizePercent(percentSelect?.value),
          side: normalizeSide(sideSelect?.value)
        });
      });
    });

    return rows;
  };

  const computeCombinedWithBilateral = (rows) => {
    const effectiveRatings = buildEffectiveRatingsFromConditions(
      rows.map((entry) => ({
        condition: entry.name,
        percentage: entry.percent,
        side: entry.side
      }))
    );
    return getCombinedRating(effectiveRatings);
  };

  const persistRatingState = (combined) => {
    const normalizedConditions = conditions.map((entry) => ({
      id: entry.id,
      name: String(entry.name || ""),
      percent: String(normalizePercent(entry.percent)),
      side: normalizeSide(entry.side),
      panel: entry.panel === "right" ? "right" : "left"
    }));

    setRatingCalc({ conditions: normalizedConditions, combined, updatedAt: new Date().toISOString() });
  };

  const updateCombined = () => {
    const rows = collectRowsForCalculation();
    const combined = computeCombinedWithBilateral(rows);

    if (combinedEl) {
      combinedEl.textContent = `${combined}%`;
    }

    if (leftTotalEl) {
      leftTotalEl.textContent = `Combined Rating: ${combined}%`;
    }

    if (rightTotalEl) {
      rightTotalEl.textContent = `Combined Rating: ${combined}%`;
    }

    persistRatingState(combined);
  };

  const buildPercentOptions = (selectedPercent) => {
    const selected = normalizePercent(selectedPercent);
    return Array.from({ length: 11 }, (_, index) => index * 10)
      .map((percent) => `<option value="${percent}" ${percent === selected ? "selected" : ""}>${percent}%</option>`)
      .join("");
  };

  const buildSideOptions = (selectedSide) => {
    const safeSide = normalizeSide(selectedSide);
    return `
      <option value="none" ${safeSide === "none" ? "selected" : ""}>None</option>
      <option value="left" ${safeSide === "left" ? "selected" : ""}>Left</option>
      <option value="right" ${safeSide === "right" ? "selected" : ""}>Right</option>
    `;
  };

  const addContentionRow = (targetTableId, condition = "", percent = 10, side = "none") => {
    const panel = targetTableId === "right-cr-table" ? "right" : "left";
    conditions = [
      ...conditions,
      {
        id: nextConditionId,
        name: String(condition || ""),
        percent: String(normalizePercent(percent)),
        side: normalizeSide(side),
        panel
      }
    ];
    nextConditionId += 1;
  };

  const renderContentionTables = () => {
    if (!hasDualPanels) {
      if (!list) {
        return;
      }

      if (!conditions.length) {
        addContentionRow("left-cr-table", "", 10, "none");
      }

      list.innerHTML = "";
      conditions.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "rating-row";
        row.setAttribute("data-contention-id", String(entry.id));
        row.innerHTML = `
          <input type="text" class="cr-condition-input" placeholder="Condition name" value="${String(entry.name || "").replace(/"/g, "&quot;")}" />
          <select class="cr-percent-select">${buildPercentOptions(entry.percent)}</select>
          <button type="button" class="ghost cr-row-delete">Delete</button>
        `;
        list.appendChild(row);
      });

      if (!list.children.length) {
        addContentionRow("left-cr-table", "", 10, "none");
        const fallbackEntry = conditions[conditions.length - 1];
        const row = document.createElement("div");
        row.className = "rating-row";
        row.setAttribute("data-contention-id", String(fallbackEntry.id));
        row.innerHTML = `
          <input type="text" class="cr-condition-input" placeholder="Condition name" value="${String(fallbackEntry.name || "").replace(/"/g, "&quot;")}" />
          <select class="cr-percent-select">${buildPercentOptions(fallbackEntry.percent)}</select>
          <button type="button" class="ghost cr-row-delete">Delete</button>
        `;
        list.appendChild(row);
      }

      updateCombined();
      return;
    }

    leftTableBody.innerHTML = "";
    rightTableBody.innerHTML = "";

    conditions.forEach((entry) => {
      const row = document.createElement("tr");
      row.className = "rating-row";
      row.setAttribute("data-contention-id", String(entry.id));
      row.innerHTML = `
        <td>
          <input
            type="text"
            class="cr-condition-input"
            value="${String(entry.name || "").replace(/"/g, "&quot;")}"
            placeholder="Condition name"
          />
        </td>
        <td>
          <select class="cr-percent-select">${buildPercentOptions(entry.percent)}</select>
        </td>
        <td>
          <select class="cr-side-select">${buildSideOptions(entry.side)}</select>
        </td>
        <td>
          <button type="button" class="ghost cr-row-delete">Delete</button>
        </td>
      `;

      if (entry.panel === "right") {
        rightTableBody.appendChild(row);
      } else {
        leftTableBody.appendChild(row);
      }
    });

    updateCombined();
  };

  const renderParsed = () => {
    if (!disabilities) {
      return;
    }

    disabilities.innerHTML = "";
    sanitizeScanResult(parsedResult);

    const serviceConnected = Array.isArray(parsedResult?.serviceConnected)
      ? parsedResult.serviceConnected
      : [];
    const deniedConditions = Array.isArray(parsedResult?.denied)
      ? parsedResult.denied
      : [];

    const allConditions = sortConditionsForDisplay(
      Array.isArray(parsedResult?.allConditions)
        ? parsedResult.allConditions
        : [
          ...serviceConnected.map((entry) => ({
            ...entry,
            status: "service_connected"
          })),
          ...deniedConditions
        ]
    );

    const filteredConditions = filterUniqueConditionsForRender(allConditions);

    if (!filteredConditions.length) {
      const empty = document.createElement("div");
      empty.className = "rating-empty";
      empty.textContent = "No service-connected disabilities found.";
      disabilities.appendChild(empty);
      return;
    }

    const editList = document.createElement("div");
    editList.className = "rating-edit-list";

    let serviceConnectedIndex = 0;

    filteredConditions.forEach((entry, index) => {
      const isDenied = String(entry?.status || "").toLowerCase() === "denied";
      const row = document.createElement("div");
      row.className = `rating-edit-row${isDenied ? " rating-denied-row denied-row" : ""}`;
      if (!isDenied) {
        row.setAttribute("data-disability-row", String(serviceConnectedIndex));
      }

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = String(entry?.condition || "");
      if (!isDenied) {
        nameInput.setAttribute("data-disability-name", String(serviceConnectedIndex));
      } else {
        nameInput.disabled = true;
      }
      nameInput.setAttribute("aria-label", `Disability ${index + 1} name`);

      const percentInput = document.createElement("input");
      percentInput.type = isDenied ? "text" : "number";
      if (!isDenied) {
        percentInput.min = "0";
        percentInput.max = "100";
        percentInput.step = "10";
      }
      const parsedPercent = Number(entry?.percentage);
      percentInput.value = isDenied
        ? String(entry?.rating || "NSC")
        : (Number.isFinite(parsedPercent) ? String(parsedPercent) : "0");
      if (!isDenied) {
        percentInput.setAttribute("data-disability-percent", String(serviceConnectedIndex));
      } else {
        percentInput.disabled = true;
        percentInput.readOnly = true;
      }
      percentInput.setAttribute("aria-label", isDenied ? `Disability ${index + 1} rating` : `Disability ${index + 1} percent`);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "ghost rating-edit-remove";
      if (!isDenied) {
        removeButton.textContent = "Remove";
        removeButton.setAttribute("data-disability-remove", String(serviceConnectedIndex));
        removeButton.setAttribute("aria-label", `Remove disability ${index + 1}`);
      } else {
        removeButton.textContent = "Denied";
        removeButton.disabled = true;
        removeButton.setAttribute("aria-label", `Denied disability ${index + 1}`);
      }

      row.appendChild(nameInput);
      row.appendChild(percentInput);
      row.appendChild(removeButton);

      if (!isDenied) {
        serviceConnectedIndex += 1;
      }

      editList.appendChild(row);
    });

    disabilities.appendChild(editList);

    const deniedOnly = allConditions.filter((entry) => String(entry?.status || "").toLowerCase() === "denied");
    const deniedPanel = buildDeniedReasonPanel(deniedOnly);
    if (deniedPanel) {
      disabilities.appendChild(deniedPanel);
    }
  };

  if (disabilities) {
    const persistParsedNarrative = () => {
      const currentNarrative = getRatingNarrative();
      if (currentNarrative) {
        setRatingNarrative({
          ...currentNarrative,
          scanResult: parsedResult
        });
      }
    };

    const removeDisabilityByIndex = (index) => {
      if (!Number.isInteger(index) || !parsedResult.serviceConnected[index]) {
        return;
      }

      parsedResult.serviceConnected = parsedResult.serviceConnected.filter((_, rowIndex) => rowIndex !== index);
      parsedResult.service_connected = parsedResult.serviceConnected;
      sanitizeScanResult(parsedResult);
      persistParsedNarrative();
      renderParsed();
    };

    disabilities.addEventListener("input", (event) => {
      if (!parsedResult || !Array.isArray(parsedResult.serviceConnected)) {
        return;
      }

      const nameInput = event.target.closest("[data-disability-name]");
      if (nameInput) {
        const index = Number(nameInput.getAttribute("data-disability-name"));
        if (Number.isInteger(index) && parsedResult.serviceConnected[index]) {
          parsedResult.serviceConnected[index].condition = nameInput.value;
          parsedResult.service_connected = parsedResult.serviceConnected;
          sanitizeScanResult(parsedResult);
        }
      }

      const percentInput = event.target.closest("[data-disability-percent]");
      if (percentInput) {
        const index = Number(percentInput.getAttribute("data-disability-percent"));
        if (Number.isInteger(index) && parsedResult.serviceConnected[index]) {
          const rawValue = Number(percentInput.value);
          const safePercent = Number.isFinite(rawValue) ? Math.min(100, Math.max(0, rawValue)) : 0;
          parsedResult.serviceConnected[index].percentage = safePercent;
          parsedResult.service_connected = parsedResult.serviceConnected;
          sanitizeScanResult(parsedResult);
        }
      }

      const removeButton = event.target.closest("[data-disability-remove]");
      if (removeButton) {
        const index = Number(removeButton.getAttribute("data-disability-remove"));
        removeDisabilityByIndex(index);
        return;
      }

      persistParsedNarrative();
    });

    disabilities.addEventListener("click", (event) => {
      if (!parsedResult || !Array.isArray(parsedResult.serviceConnected)) {
        return;
      }

      const removeButton = event.target.closest("[data-disability-remove]");
      if (!removeButton) {
        return;
      }

      const index = Number(removeButton.getAttribute("data-disability-remove"));
      removeDisabilityByIndex(index);
    });
  }

  const hydrateNarrative = () => {
    const narrative = getRatingNarrative();
    if (!narrative) {
      if (fileStatus) {
        fileStatus.textContent = "Upload a narrative (PDF/text, max 5 MB).";
      }
      parsedResult = null;
      renderParsed();
      return;
    }

    if (fileStatus) {
      fileStatus.textContent = `${narrative.name || "Narrative"} (${Math.round((narrative.size || 0) / 1024)} KB)`;
    }
    parsedResult = narrative.scanResult || null;
    sanitizeScanResult(parsedResult);
    if (parsedResult && narrative.scanResult) {
      setRatingNarrative({
        ...narrative,
        scanResult: parsedResult
      });
    }
    const serviceConnected = Array.isArray(parsedResult?.serviceConnected)
      ? parsedResult.serviceConnected
      : [];
    if (!persistedConditions.length && serviceConnected.length) {
      conditions = [];
      serviceConnected.forEach((entry) => {
        const conditionName = String(entry?.condition || "");
        const inferredPanel = hasDualPanels && /\bright\b/i.test(conditionName) ? "right-cr-table" : "left-cr-table";
        const inferredSide = /\bleft\b/i.test(conditionName)
          ? "left"
          : /\bright\b/i.test(conditionName)
            ? "right"
            : "none";

        addContentionRow(inferredPanel, conditionName, entry?.percentage || 10, inferredSide);
      });
      renderContentionTables();
    }
    renderParsed();
  };

  const handleTableInputChange = (event) => {
    const row = event.target.closest("[data-contention-id]");
    if (!row) {
      return;
    }

    const id = Number(row.getAttribute("data-contention-id"));
    const condition = conditions.find((entry) => entry.id === id);
    if (!condition) {
      return;
    }

    if (event.target.matches(".cr-condition-input")) {
      condition.name = event.target.value;
    }

    if (event.target.matches(".cr-percent-select")) {
      condition.percent = String(normalizePercent(event.target.value));
    }

    if (event.target.matches(".cr-side-select")) {
      condition.side = normalizeSide(event.target.value);
    }

    if (!hasDualPanels) {
      condition.side = "none";
    }

    updateCombined();
  };

  const handleTableDelete = (event) => {
    const deleteButton = event.target.closest(".cr-row-delete");
    if (!deleteButton) {
      return;
    }

    const row = deleteButton.closest("[data-contention-id]");
    if (!row) {
      return;
    }

    const id = Number(row.getAttribute("data-contention-id"));
    conditions = conditions.filter((entry) => entry.id !== id);
    row.remove();
    updateCombined();
  };

  if (hasDualPanels) {
    [leftTableBody, rightTableBody].forEach((tbody) => {
      if (!tbody) {
        return;
      }
      tbody.addEventListener("input", handleTableInputChange);
      tbody.addEventListener("change", handleTableInputChange);
      tbody.addEventListener("click", handleTableDelete);
    });
  } else if (list) {
    list.addEventListener("input", handleTableInputChange);
    list.addEventListener("change", handleTableInputChange);
    list.addEventListener("click", handleTableDelete);
  }

  if (uploadInput) {
    uploadInput.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      if (file.size > MAX_NARRATIVE_BYTES) {
        if (fileStatus) {
          fileStatus.textContent = "File too large. Please upload a file under 5 MB.";
        }
        return;
      }

      if (file.type === "application/pdf") {
        fileStatus.textContent = "Reading PDF...";
        extractPdfText(file)
          .then(async (text) => {
            const scanResult = await processNarrativeText(text);
            setRatingNarrative({
              name: file.name,
              type: file.type,
              size: file.size,
              scanResult
            });
            if (fileStatus) {
              const isAuthoritySource = String(scanResult?.source || "").startsWith("authority");
              fileStatus.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)${isAuthoritySource ? " — AUTHORITY INDEXED" : ""}`;
            }
            hydrateNarrative();
          })
          .catch((error) => {
            setRatingNarrative({
              name: file.name,
              type: file.type,
              size: file.size,
              scanResult: { error: error?.message || "No rating data found in the document." }
            });
            if (fileStatus) {
              fileStatus.textContent = error?.message || "Unable to read PDF.";
            }
            hydrateNarrative();
          });
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        const scanResult = await processNarrativeText(text);
        setRatingNarrative({
          name: file.name,
          type: file.type,
          size: file.size,
          scanResult
        });
        if (fileStatus) {
          const isAuthoritySource = String(scanResult?.source || "").startsWith("authority");
          fileStatus.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)${isAuthoritySource ? " — AUTHORITY INDEXED" : ""}`;
        }
        hydrateNarrative();
      };
      reader.onerror = () => {
        setRatingNarrative({
          name: file.name,
          type: file.type,
          size: file.size,
          scanResult: { error: "No rating data found in the document." }
        });
        hydrateNarrative();
      };

      reader.readAsText(file);
    });

    if (fileStatus && uploadInput) {
      fileStatus.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadInput.click();
      });
    }
  }

  if (removeButton) {
    removeButton.addEventListener("click", () => {
      clearRatingNarrative();
      if (uploadInput) {
        uploadInput.value = "";
      }
      hydrateNarrative();
    });
  }

  const handleAddContention = (targetTableId, inputElement) => {
    const condition = inputElement?.value?.trim?.() || "";
    addContentionRow(targetTableId, condition, 10, "none");
    if (inputElement) {
      inputElement.value = "";
    }
    renderContentionTables();

    if (!hasDualPanels && list) {
      const lastRow = list.querySelector(".rating-row:last-child .cr-condition-input");
      if (lastRow) {
        lastRow.focus();
      }
    }
  };

  if (leftAddButton && leftNewConditionInput) {
    leftAddButton.addEventListener("click", () => handleAddContention("left-cr-table", leftNewConditionInput));
  }

  if (rightAddButton && rightNewConditionInput) {
    rightAddButton.addEventListener("click", () => handleAddContention("right-cr-table", rightNewConditionInput));
  }

  if (addButton && !hasDualPanels) {
    addButton.addEventListener("click", (event) => {
      event.preventDefault();
      handleAddContention("left-cr-table", null);
    });

    addButton.onclick = (event) => {
      event.preventDefault();
      handleAddContention("left-cr-table", null);
    };
  }

  if (!hasDualPanels) {
    window.RFAddContention = () => handleAddContention("left-cr-table", null);
  }

  if (tools) {
    tools.addEventListener("click", (event) => {
      const add = event.target.closest("[data-rating-add]");
      if (!add || hasDualPanels) {
        return;
      }
      event.preventDefault();
      handleAddContention("left-cr-table", null);
    });
  }

  if (toggleButton && content) {
    toggleButton.addEventListener("click", () => {
      const isCollapsed = content.classList.toggle("is-collapsed");
      toggleButton.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
      toggleButton.textContent = isCollapsed ? "Expand" : "Collapse";
    });
  }

  if (!conditions.length) {
    addContentionRow("left-cr-table", "", 10, "none");
  }

  renderContentionTables();
  hydrateNarrative();

  if (!hasDualPanels && list && !list.children.length) {
    addContentionRow("left-cr-table", "", 10, "none");
    renderContentionTables();
  }

  if (!hasDualPanels && list && !list.children.length) {
    requestAnimationFrame(() => {
      if (list && !list.children.length) {
        addContentionRow("left-cr-table", "", 10, "none");
        renderContentionTables();
      }
    });
  }
};

const createPeriodRow = (period = {}) => {
  const wrapper = document.createElement("div");
  wrapper.className = "service-period";

  wrapper.innerHTML = `
    <div class="period-header">
      <div class="period-title">Service period</div>
      <div class="period-actions">
        <label class="present-toggle">
          <input type="checkbox" data-present />
          <span>Present</span>
        </label>
        <button type="button" class="ghost" data-remove>Remove</button>
      </div>
    </div>
    <div class="period-fields">
      <label>
        Start date
        <input type="date" name="startDate" required value="${period.startDate || ""}" />
      </label>
      <label>
        End date
        <input type="date" name="endDate" value="${period.endDate || ""}" />
      </label>
      <label>
        Theater
        <select name="theater"></select>
      </label>
    </div>
  `;

  const theaterSelect = wrapper.querySelector("select[name='theater']");
  theaterSelect.innerHTML = "<option value=\"\">Select</option>";
  sharedTheaters.forEach((theater) => {
    const option = document.createElement("option");
    option.value = theater;
    option.textContent = theater;
    theaterSelect.appendChild(option);
  });
  theaterSelect.value = period.theater || "";

  const presentToggle = wrapper.querySelector("[data-present]");
  const endDateInput = wrapper.querySelector("input[name='endDate']");
  const isPresent = period.endDate === undefined ? false : !period.endDate;
  presentToggle.checked = isPresent;
  endDateInput.disabled = isPresent;
  if (isPresent) {
    endDateInput.value = "";
  }

  return wrapper;
};

const updatePeriodLabels = (container) => {
  Array.from(container.querySelectorAll(".service-period")).forEach((row, index) => {
    const title = row.querySelector(".period-title");
    if (title) {
      title.textContent = `Service period ${index + 1}`;
    }
  });
};

const populateSelect = (select, options) => {
  select.innerHTML = "<option value=\"\">Select</option>";
  options.forEach((option) => {
    const el = document.createElement("option");
    el.value = option;
    el.textContent = option;
    select.appendChild(el);
  });
};

const getNamedValue = (form, name) => {
  const field = form.elements.namedItem(name);
  if (!field) {
    return "";
  }
  return typeof field.value === "string" ? field.value : "";
};

const getSelectedAwards = (form) => {
  return Array.from(form.querySelectorAll("[data-selected-award]"))
    .map((chip) => chip.getAttribute("data-selected-award"))
    .filter(Boolean);
};

const renderSelectedAwards = (form, awardIds) => {
  const container = form.querySelector("[data-awards-selected]");
  if (!container) {
    return;
  }

  const uniqueAwardIds = Array.from(new Set((awardIds || []).filter(Boolean)));
  container.innerHTML = "";

  if (!uniqueAwardIds.length) {
    const empty = document.createElement("span");
    empty.className = "awards-empty";
    empty.textContent = "No awards added yet.";
    container.appendChild(empty);
    return;
  }

  uniqueAwardIds.forEach((awardId) => {
    const chip = document.createElement("span");
    chip.className = "awards-chip";
    chip.setAttribute("data-selected-award", awardId);

    const name = sharedAwards.find((award) => award.id === awardId)?.name || awardId;
    chip.innerHTML = `
      <span>${name}</span>
      <button type="button" aria-label="Remove ${name}" data-awards-remove data-award-id="${awardId}">×</button>
    `;
    container.appendChild(chip);
  });
};

const getFormData = (form) => {
  const periods = Array.from(form.querySelectorAll(".service-period")).map((row) => ({
    startDate: row.querySelector("input[name='startDate']").value,
    endDate: row.querySelector("[data-present]")?.checked
      ? null
      : row.querySelector("input[name='endDate']").value || null,
    theater: row.querySelector("select[name='theater']").value || null
  }));

  return {
    branch: getNamedValue(form, "branch"),
    component: getNamedValue(form, "component"),
    servicePeriods: periods,
    combatSelfReported: form.querySelector("input[name='combatSelfReported']:checked")?.value || "",
    disabilityRatingKnown: false,
    disabilityRatingPercent: null,
    stateOfResidence: getNamedValue(form, "stateOfResidence"),
    awards: (() => {
      const selectedAwards = getSelectedAwards(form);
      if (selectedAwards.length) {
        return selectedAwards;
      }
      const selectedValue = getNamedValue(form, "awards");
      return selectedValue ? [selectedValue] : [];
    })()
  };
};

const setError = (form, field, message) => {
  const el = form.querySelector(`[data-error-for='${field}']`);
  if (el) {
    el.textContent = message || "";
  }

  const input = form.querySelector(`[name='${field}']`);
  if (input) {
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }
};

const focusFirstError = (form) => {
  const error = form.querySelector(".error:not(:empty)");
  if (!error) {
    return;
  }

  const field = error.getAttribute("data-error-for");
  const input = form.querySelector(`[name='${field}']`);
  if (input) {
    input.focus();
  }
};

const validateStep = (form, stepIndex) => {
  let valid = true;

  if (stepIndex === 0) {
    const branchValue = getNamedValue(form, "branch");
    const componentValue = getNamedValue(form, "component");

    if (!branchValue) {
      setError(form, "branch", "Select a branch.");
      valid = false;
    } else {
      setError(form, "branch", "");
    }

    if (!componentValue) {
      setError(form, "component", "Select a component.");
      valid = false;
    } else {
      setError(form, "component", "");
    }
  }

  if (stepIndex === 0) {
    const periods = Array.from(form.querySelectorAll(".service-period"));
    const hasPeriod = periods.every((row) => row.querySelector("input[name='startDate']").value);
    periods.forEach((row) => {
      const startInput = row.querySelector("input[name='startDate']");
      const isMissing = !startInput?.value;
      row.classList.toggle("is-invalid", isMissing);
      if (startInput) {
        startInput.setAttribute("aria-invalid", isMissing ? "true" : "false");
      }
    });
    if (!periods.length || !hasPeriod) {
      setError(form, "servicePeriods", "Add at least one service period with a start date.");
      valid = false;
    } else {
      setError(form, "servicePeriods", "");
    }
  }

  if (stepIndex === 0) {
    const selected = form.querySelector("input[name='combatSelfReported']:checked");
    if (!selected) {
      setError(form, "combatSelfReported", "");
    } else {
      setError(form, "combatSelfReported", "");
    }
  }

  if (stepIndex === 2) {
    if (!getNamedValue(form, "stateOfResidence")) {
      setError(form, "stateOfResidence", "Select a state or territory.");
      valid = false;
    } else {
      setError(form, "stateOfResidence", "");
    }
  }

  return valid;
};

const updateButtons = (root, stepIndex, isValid) => {
  root.querySelector("[data-prev]").disabled = stepIndex === 0;
  root.querySelector("[data-next]").style.display = stepIndex === STEPS - 1 ? "none" : "inline-flex";
  root.querySelector("[data-submit]").style.display = stepIndex === STEPS - 1 ? "inline-flex" : "none";
  root.querySelector("[data-next]").disabled = false;
};

const showStep = (root, stepIndex, form, indicator) => {
  console.log(`[showStep] Showing step ${stepIndex}`);
  root.querySelectorAll(".step").forEach((step, index) => {
    const wasActive = step.classList.contains("active");
    const willBeActive = index === stepIndex;
    step.classList.toggle("active", willBeActive);
    if (wasActive !== willBeActive) {
      console.log(`[showStep] Step ${index} (data-step="${step.dataset.step}"): ${wasActive ? "active" : "inactive"} → ${willBeActive ? "active" : "inactive"}`);
    }
  });

  if (indicator) {
    updateStepIndicator(indicator, stepIndex);
  }

  const isValid = validateStep(form, stepIndex);
  updateButtons(root, stepIndex, isValid);
  updateDebugPanel(root, form, stepIndex, isValid);
};

const getStepErrors = (form, stepIndex) => {
  const errors = [];
  if (stepIndex === 0) {
    if (!getNamedValue(form, "branch")) {
      errors.push("Select a branch.");
    }
    if (!getNamedValue(form, "component")) {
      errors.push("Select a component.");
    }
    const periods = Array.from(form.querySelectorAll(".service-period"));
    const hasPeriod = periods.every((row) => row.querySelector("input[name='startDate']")?.value);
    if (!periods.length || !hasPeriod) {
      errors.push("Add at least one service period with a start date.");
    }
    const selected = form.querySelector("input[name='combatSelfReported']:checked");
    if (!selected) {
      errors.push("Select a combat service option.");
    }
  }
  if (stepIndex === 2 && !getNamedValue(form, "stateOfResidence")) {
    errors.push("Select a state or territory.");
  }
  return errors;
};

const buildSummary = (root, payload) => {
  const summary = root.querySelector("[data-summary]");
  const periods = payload.servicePeriods
    .map((period) => `${period.startDate} to ${period.endDate || "Present"}${period.theater ? ` (${period.theater})` : ""}`)
    .join("\n");
  const awardLabels = (payload.awards || [])
    .map((awardId) => sharedAwards.find((award) => award.id === awardId)?.name || awardId)
    .join(", ");
  summary.innerHTML = `
    <div class="summary-row"><strong>Branch:</strong> ${payload.branch}</div>
    <div class="summary-row"><strong>Component:</strong> ${payload.component}</div>
    <div class="summary-row"><strong>Service periods:</strong></div>
    <pre>${periods}</pre>
    <div class="summary-row"><strong>Combat self-report:</strong> ${payload.combatSelfReported}</div>
    <div class="summary-row"><strong>Disability rating:</strong> ${payload.disabilityRatingKnown ? payload.disabilityRatingPercent + "%" : "Not sure"}</div>
    <div class="summary-row"><strong>State of residence:</strong> ${payload.stateOfResidence}</div>
    <div class="summary-row"><strong>Awards:</strong> ${awardLabels || "None selected"}</div>
  `;
};

const validateAllSteps = (form) => {
  for (let stepIndex = 0; stepIndex < STEPS - 1; stepIndex += 1) {
    if (!validateStep(form, stepIndex)) {
      return stepIndex;
    }
  }

  return -1;
};

const formatSubmitError = (error) => {
  if (!error) {
    return "Unable to submit onboarding.";
  }

  const details = Array.isArray(error.details) ? error.details : [];
  if (details.length) {
    return `${error.message || "Unable to submit onboarding."} ${details.join(", ")}`;
  }

  return error.message || "Unable to submit onboarding.";
};

const persistDraft = (form) => {
  setOnboardingResult(getFormData(form));
};

const hydrateDraft = (form, draft) => {
  if (!draft) {
    return;
  }

  const branchField = form.elements.namedItem("branch");
  const componentField = form.elements.namedItem("component");
  const stateField = form.elements.namedItem("stateOfResidence");

  if (branchField) {
    branchField.value = draft.branch || "";
  }
  if (componentField) {
    componentField.value = draft.component || "";
  }
  if (stateField) {
    stateField.value = draft.stateOfResidence || "";
  }

  const awardsField = form.elements.namedItem("awards");
  const draftAwards = Array.isArray(draft.awards)
    ? draft.awards
    : (typeof draft.awards === "string" && draft.awards ? [draft.awards] : []);
  if (awardsField && draftAwards.length) {
    awardsField.value = draftAwards[0] || "";
  }
  renderSelectedAwards(form, draftAwards);

  if (draft.combatSelfReported) {
    const combat = form.querySelector(`input[name='combatSelfReported'][value='${draft.combatSelfReported}']`);
    if (combat) {
      combat.checked = true;
    }
  }

  const container = form.querySelector("#service-periods");
  container.innerHTML = "";
  (draft.servicePeriods || []).forEach((period) => {
    container.appendChild(createPeriodRow(period));
  });
};


const awardCategoryLabels = {
  combat_award: "Combat awards",
  valor_award: "Valor awards",
  campaign_medal: "Campaign medals",
  hazardous_duty_badge: "Hazardous duty badges",
  service_medal: "Service medals",
  medical_related_award: "Medical-related awards",
  high_honor_award: "High honor awards",
  unit_award: "Unit awards",
  rare_award: "Rare awards"
};

const populateAwards = (select) => {
  select.innerHTML = "";
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = "Select an award";
  select.appendChild(placeholderOption);

  const groups = new Map();

  sharedAwards.forEach((award) => {
    if (!groups.has(award.category)) {
      const label = awardCategoryLabels[award.category] || award.category;
      const group = document.createElement("optgroup");
      group.label = label;
      groups.set(award.category, group);
    }
    const option = document.createElement("option");
    option.value = award.id;
    option.textContent = award.name;
    groups.get(award.category).appendChild(option);
  });

  groups.forEach((group) => select.appendChild(group));
};


export const init = async () => {
  const root = document.querySelector("[data-onboarding]");
  if (!root) {
    return;
  }

  const form = root.querySelector("#onboarding-form");
  const status = root.querySelector("[data-status]");
  const progressContainer = root.querySelector("[data-progress-container]");

  const indicator = progressContainer ? createStepIndicator(STEPS) : null;
  if (progressContainer && indicator) {
    progressContainer.appendChild(indicator);
  }

  try {
    await loadSharedData();
  } catch (error) {
    status.textContent = error?.message || "Unable to load shared data. Refresh the page.";
    return;
  }

  const draft = getOnboardingResult();

  const branchSelect = form.elements.namedItem("branch");
  const componentSelect = form.elements.namedItem("component");
  const stateSelect = form.elements.namedItem("stateOfResidence");
  const awardsSelect = form.elements.namedItem("awards");

  if (branchSelect) {
    populateSelect(branchSelect, sharedBranches);
  }
  if (componentSelect) {
    populateSelect(componentSelect, sharedComponents);
  }
  if (stateSelect) {
    populateSelect(stateSelect, sharedStates);
  }
  if (awardsSelect) {
    populateAwards(awardsSelect);
  }

  const periodsContainer = form.querySelector("#service-periods");
  const addPeriodButton = form.querySelector("[data-add-period]");
  const awardsAddButton = form.querySelector("[data-awards-add]");
  const awardsSelectedContainer = form.querySelector("[data-awards-selected]");

  if (periodsContainer) {
    if (draft) {
      hydrateDraft(form, draft);
    }
    if (!draft?.servicePeriods?.length) {
      periodsContainer.appendChild(createPeriodRow());
    }
    updatePeriodLabels(periodsContainer);
  }

  if (!draft) {
    renderSelectedAwards(form, []);
  }

  let currentStep = 0;
  showStep(root, currentStep, form, indicator);

  const goNext = () => {
    try {
      console.log(`[goNext] Current step: ${currentStep}`);
      status.textContent = "Next clicked.";
      const isValid = validateStep(form, currentStep);
      console.log(`[goNext] Step ${currentStep} valid:`, isValid);
      if (!isValid) {
        updateButtons(root, currentStep, false);
        focusFirstError(form);
        const details = getStepErrors(form, currentStep);
        status.textContent = details.length
          ? details.join(" ")
          : "Complete the highlighted fields to continue.";
        console.log(`[goNext] Validation failed:`, details);
        return;
      }

      if (currentStep === STEPS - 2) {
        buildSummary(root, getFormData(form));
      }

      const nextStep = Math.min(STEPS - 1, currentStep + 1);
      console.log(`[goNext] Moving from step ${currentStep} to step ${nextStep}`);
      currentStep = nextStep;
      showStep(root, currentStep, form, indicator);
      status.textContent = `Showing step ${currentStep + 1} of ${STEPS}.`;
    } catch (error) {
      console.error("goNext failed", error);
      status.textContent = error?.message || "Next failed. Check console.";
    }
  };

  const goPrev = () => {
    try {
      status.textContent = "Back clicked.";
      currentStep = Math.max(0, currentStep - 1);
      showStep(root, currentStep, form, indicator);
      status.textContent = `Showing step ${currentStep + 1} of ${STEPS}.`;
    } catch (error) {
      console.error("goPrev failed", error);
      status.textContent = error?.message || "Back failed. Check console.";
    }
  };

  window.RFOnboardingNav = {
    next: () => goNext(),
    prev: () => goPrev()
  };

  document.addEventListener(
    "click",
    (event) => {
      const hit = event.target.closest?.("[data-next],[data-prev]");
      if (hit) {
        const label = hit.matches("[data-next]") ? "Next" : "Back";
        console.debug("Wizard click captured", { label, currentStep });
      }
    },
    true
  );

  form.addEventListener("click", (event) => {
    try {
      const nextButton = event.target.closest("[data-next]");
      if (nextButton) {
        event.preventDefault();
        goNext();
        return;
      }

      const prevButton = event.target.closest("[data-prev]");
      if (prevButton) {
        event.preventDefault();
        goPrev();
      }
    } catch (error) {
      console.error("Navigation error", error);
      status.textContent = error?.message || "Navigation error. Please refresh.";
    }
  });

  try {
    initRatingTools(root);
  } catch (error) {
    console.error("Rating tools init failed", error);
    status.textContent = error?.message || "Rating tools failed to initialize.";
  }

  if (addPeriodButton && periodsContainer) {
    addPeriodButton.addEventListener("click", () => {
      periodsContainer.appendChild(createPeriodRow());
      updatePeriodLabels(periodsContainer);
      persistDraft(form);
    });
  }

  if (periodsContainer) {
    periodsContainer.addEventListener("click", (event) => {
      if (event.target.matches("[data-remove]")) {
        event.target.closest(".service-period").remove();
        updatePeriodLabels(periodsContainer);
        persistDraft(form);
        showStep(root, currentStep, form, indicator);
      }
    });
  }

  if (awardsAddButton && awardsSelect) {
    awardsAddButton.addEventListener("click", () => {
      const selectedAwardId = awardsSelect.value;
      if (!selectedAwardId) {
        return;
      }
      const nextAwards = [...getSelectedAwards(form), selectedAwardId];
      renderSelectedAwards(form, nextAwards);
      awardsSelect.value = "";
      persistDraft(form);
      showStep(root, currentStep, form, indicator);
    });
  }

  if (awardsSelectedContainer) {
    awardsSelectedContainer.addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-awards-remove]");
      if (!removeButton) {
        return;
      }

      const awardId = removeButton.getAttribute("data-award-id");
      const nextAwards = getSelectedAwards(form).filter((id) => id !== awardId);
      renderSelectedAwards(form, nextAwards);
      persistDraft(form);
      showStep(root, currentStep, form, indicator);
    });
  }

  if (periodsContainer) {
    periodsContainer.addEventListener("change", (event) => {
      if (event.target.matches("[data-present]")) {
        const row = event.target.closest(".service-period");
        const endDateInput = row?.querySelector("input[name='endDate']");
        if (endDateInput) {
          endDateInput.disabled = event.target.checked;
          if (event.target.checked) {
            endDateInput.value = "";
          }
        }
      }
    });
  }

  form.addEventListener("input", () => {
    persistDraft(form);
    showStep(root, currentStep, form, indicator);
  });

  form.addEventListener("change", () => {
    persistDraft(form);
    showStep(root, currentStep, form, indicator);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const invalidStep = validateAllSteps(form);
    if (invalidStep !== -1) {
      currentStep = invalidStep;
      showStep(root, currentStep, form, indicator);
      focusFirstError(form);
      status.textContent = "Complete the required fields before submitting.";
      return;
    }

    const payload = getFormData(form);
    buildSummary(root, payload);
    setOnboardingResult(payload);

    status.textContent = "Submitting your onboarding details...";

    try {
      const response = await postOnboarding(payload);
      setVeteranId(response.veteranId);
      setOnboardingResult(payload);
      status.textContent = "Onboarding complete. Redirecting...";
      window.location.hash = "#/results";
      setTimeout(() => {
        if (window.location.hash !== "#/results") {
          window.location.hash = "#/results";
        }
      }, 500);
    } catch (error) {
      status.textContent = formatSubmitError(error);
    }
  });
};
