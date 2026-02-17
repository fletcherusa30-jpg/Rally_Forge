import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "../utils/errors.js";
import { validateScannerOutput } from "../engine/scanner/scannerMiddleware.js";
import { parseVADecisionScanner } from "../engine/scanner/vaDecisionScanner.js";
import { classifyScannerDocument } from "./scannerDocumentClassifier.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scannerOutputDir = path.resolve(__dirname, "../data/scanner-output");
const serviceConnectedPath = path.join(scannerOutputDir, "service_connected.json");
const deniedPath = path.join(scannerOutputDir, "denied.json");

const readJsonFile = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeWhitespace = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeScanInput = (value) =>
  String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();

const cleanCondition = (value) =>
  normalizeWhitespace(value)
    .replace(/^\s*(?:service connection for|entitlement to service connection for)\s+/i, "")
    .replace(/[\s\-–—:;,.]+$/g, "")
    .trim();

const toPercent = (value) => {
  const parsed = Number(String(value ?? "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }
  return parsed;
};

const isLikelyAdministrativeNoise = (condition) => {
  const text = normalizeWhitespace(condition).toLowerCase();
  if (!text) {
    return true;
  }

  if (text.length > 240) {
    return true;
  }

  return /(privacy act|respondent burden|notice of disagreement|va form|omb approved|rights to appeal|where to send|payment for travel|social security administration)/i.test(
    text
  );
};

const normalizeServiceConnectedRows = (rows) => {
  const normalized = [];
  const seen = new Set();

  rows.forEach((row) => {
    const condition = cleanCondition(row?.Condition || row?.condition || "");
    const percentage = toPercent(row?.Percent ?? row?.percentage);
    if (!condition || percentage === null) {
      return;
    }
    if (isLikelyAdministrativeNoise(condition)) {
      return;
    }

    const key = `${condition.toLowerCase()}|${percentage}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    normalized.push({
      condition,
      percentage,
      effective_date: "",
      type: "new"
    });
  });

  return normalized;
};

const normalizeDeniedRows = (rows) => {
  const normalized = [];
  const seen = new Set();

  rows.forEach((row) => {
    const condition = cleanCondition(row?.Condition || row?.condition || "");
    const reason = normalizeWhitespace(row?.Reason || row?.reason || row?.reason_for_denial || "");
    if (!condition || isLikelyAdministrativeNoise(condition)) {
      return;
    }

    const key = condition.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    normalized.push({
      condition,
      status: "denied",
      rating: "NSC",
      reason: reason || "Reason not found in extracted text."
    });
  });

  return normalized;
};

export const getLatestScannerOutput = async () => {
  const [serviceConnectedRows, deniedRows] = await Promise.all([
    readJsonFile(serviceConnectedPath),
    readJsonFile(deniedPath)
  ]);

  const validated = validateScannerOutput({
    serviceConnected: normalizeServiceConnectedRows(serviceConnectedRows),
    denied: normalizeDeniedRows(deniedRows)
  });

  return {
    serviceConnected: validated.serviceConnected,
    denied: validated.denied,
    allConditions: validated.allConditions,
    source: "scanner_output"
  };
};

export const scanTextWithScanner = async (text) => {
  const classification = classifyScannerDocument(text);
  const normalizedText = classification.normalizedText;

  if (!normalizedText) {
    throw new AppError("text is required", 400, "invalid_scanner_input");
  }

  if (!classification.isRatingDecision) {
    throw new AppError(
      "Scanner accepts rating decision narratives only. Route CFR/reference documents to authority processing.",
      422,
      "unsupported_scanner_document"
    );
  }

  const parsed = parseVADecisionScanner(normalizedText);
  const validated = validateScannerOutput(parsed);

  return {
    serviceConnected: validated.serviceConnected,
    denied: validated.denied,
    allConditions: validated.allConditions,
    source: "scanner_live"
  };
};
