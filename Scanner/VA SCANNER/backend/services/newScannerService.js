import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "../../../backend/utils/errors.js";
import { validateScannerOutput } from "../shared/scanner/scannerMiddleware.js";
import { classifyScannerDocument } from "./scannerDocumentClassifier.js";
// NOTE: benefitScan is a frontend utility - using scanVaDecision from engine instead
// import { benefitScan } from "../../frontend/utils/benefitScan.js";
import { validateScannerResults, getAIStatus } from "./aiScannerService.js";
import { scanVaDecision } from "../../engine/vaSuperScanner.js";

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

export const getLatestNewScannerOutput = async () => {
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
    source: "new_scanner_output"
  };
};

export const scanTextWithNewScanner = async (text) => {
  const classification = classifyScannerDocument(text);
  const normalizedText = classification.normalizedText;

  if (!normalizedText) {
    throw new AppError("Text is required", 400, "invalid_scanner_input");
  }

  // Check if it's a VA Rating Decision (using classifier)
  if (classification.isRatingDecision) {
    // Process as VA Rating Decision using vaSuperScanner engine
    console.log('[Scanner] Processing VA Rating Decision');
    let scanResult;
    try {
      scanResult = scanVaDecision(normalizedText);
    } catch (error) {
      console.error('[Scanner] scanVaDecision failed:', error.message);
      throw new AppError("Scanner failed to process decision text", 500, "scanner_failure");
    }
    
    // Transform to API format with ALL extraction categories
    const serviceConnected = (scanResult.serviceConnected || []).map(cond => ({
      condition: cond.condition,
      percentage: cond.percentage ?? (Number(String(cond.rating ?? "").replace(/[^\d]/g, "")) || 0),
      effective_date: cond.effectiveDate || cond.dateString || '',
      laterality: cond.laterality || null,
      combinedRating: scanResult.metadata?.combinedRating || null,
      type: 'new'
    }));

    const denied = (scanResult.denied || []).map(cond => ({
      condition: cond.condition,
      status: 'denied',
      rating: 'NSC',
      reason: cond.reason || 'Not specified'
    }));

    const validated = validateScannerOutput({
      serviceConnected,
      denied
    });

    // Build initial results
    const initialResults = {
      documentType: 'VA Rating Decision',
      
      // Service-Connected Conditions
      serviceConnected: validated.serviceConnected,
      
      // Denied Conditions
      denied: validated.denied,
      
      // All Conditions Combined
      allConditions: validated.allConditions,
      
      // Metadata
      metadata: scanResult.metadata || {},
      
      // Ancillary Benefits
      ancillaryBenefits: scanResult.ancillaryBenefits?.benefits || [],
      ancillaryBenefitsGranted: scanResult.ancillaryBenefits?.granted || [],
      ancillaryBenefitsDenied: scanResult.ancillaryBenefits?.denied || [],
      ancillaryBenefitsReferenced: scanResult.ancillaryBenefits?.referenced || [],
      
      // Special Monthly Compensation
      smc: {
        explicit: scanResult.specialMonthlyCompensation?.explicit || [],
        inferred: scanResult.specialMonthlyCompensation?.inferred || [],
        eligibilityIndicators: scanResult.specialMonthlyCompensation?.eligibilityIndicators || [],
        assessment: scanResult.specialMonthlyCompensation?.assessment || {}
      },
      
      // Dependents
      dependents: {
        added: scanResult.dependents?.added || [],
        removed: scanResult.dependents?.removed || [],
        totalCount: scanResult.dependents?.totalCount || 0,
        familyStatus: scanResult.dependents?.familyStatus || null
      },
      
      // Payments
      payments: scanResult.payments?.allPayments || [],
      paymentSummary: scanResult.payments?.summary || {},
      
      // Evidence
      evidence: scanResult.evidence?.items || [],
      evidenceSummary: scanResult.evidence?.summary || {},
      evidenceByType: scanResult.evidence?.byType || {},
      
      // Extraction Summary
      extractionSummary: scanResult.extractionSummary || {},
      
      // Source
      source: "vaSuperScanner_engine"
    };

    // Apply AI validation and enhancement
    const aiValidation = await validateScannerResults(normalizedText, initialResults);
    const aiStatus = getAIStatus();

    // Return results with AI metadata
    return {
      ...aiValidation.validated,
      aiValidation: {
        enhanced: aiValidation.aiEnhanced,
        confidence: aiValidation.confidence,
        suggestions: aiValidation.suggestions,
        model: aiValidation.aiModel || null,
        status: aiStatus
      }
    };
  }
  
  // Document type not recognized
  throw new AppError(
    "Please upload a valid VA Rating Decision letter",
    422,
    "unsupported_scanner_document"
  );
};

