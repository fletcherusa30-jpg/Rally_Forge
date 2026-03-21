/**
 * index.js — Rally Forge STR Analysis Subsystem v3.1
 *
 * Orchestrates all STR analysis modules into a single strAnalysis output.
 * Parses the raw text produced by the STR scanner and produces the complete
 * structured strAnalysis section for downstream consumption.
 *
 * SAFETY NOTICE: Output is for human review only. No medical conclusions,
 * no diagnoses, no treatment recommendations.
 */

import {
  extractEvents,
  extractSymptoms,
  extractDiagnoses,
  extractMedications,
  extractTestsAndResults,
  extractProfilesAndDutyLimits,
  extractFunctionalImpact,
  extractDeploymentIndicators,
  extractMentalHealthIndicators,
  extractServiceConnectionIndicators,
  detectMissingInformationIndicators,
  resetIdCounter,
} from './extractionLibrary.js';

import { buildGlobalTimeline, buildConditionTimelines, buildConditionPatterns } from './timelineBuilder.js';
import { runCrossValidation } from './crossValidation.js';
import { buildEvidenceGraphNodes } from './evidenceGraphMapping.js';
import { buildEmptyStrAnalysis, validateStrAnalysisSchema, STR_SCHEMA_VERSION } from './strSchema.js';

function buildSectionConfidence(sectionItems = []) {
  const total = Array.isArray(sectionItems) ? sectionItems.length : 0;
  if (!total) {
    return {
      extractedCount: 0,
      explicitEvidenceCount: 0,
      confidence: 0,
    };
  }

  const explicitEvidenceCount = sectionItems.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    return Boolean(item.rawText || item.lineNumber || item.date || item.startDate);
  }).length;

  return {
    extractedCount: total,
    explicitEvidenceCount,
    confidence: Number((explicitEvidenceCount / total).toFixed(2)),
  };
}

/**
 * Build the complete strAnalysis object from raw preprocessed text.
 *
 * @param {string} text - Preprocessed STR text (plain text, not HTML)
 * @param {Object} [options]
 * @param {boolean} [options.includeEvidenceGraph=false] - Include graph nodes
 * @param {boolean} [options.includeCrossValidation=true] - Include cross-validation
 * @returns {Object} strAnalysis
 */
export function buildStrAnalysis(text, { includeEvidenceGraph = false, includeCrossValidation = true } = {}) {
  const empty = buildEmptyStrAnalysis();

  if (!text || typeof text !== 'string' || text.trim().length < 20) {
    return empty;
  }

  // Reset ID counters for deterministic output
  resetIdCounter();

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  // ── Extraction Phase ────────────────────────────────────────────────────────
  const events = extractEvents(lines);
  const symptoms = extractSymptoms(lines);
  const diagnoses = extractDiagnoses(lines);
  const medications = extractMedications(lines);
  const testsAndResults = extractTestsAndResults(lines);
  const profilesAndDutyLimits = extractProfilesAndDutyLimits(lines);
  const functionalImpactStatements = extractFunctionalImpact(lines);
  const deploymentIndicators = extractDeploymentIndicators(lines);
  const mentalHealthIndicators = extractMentalHealthIndicators(lines);
  const serviceConnectionIndicators = extractServiceConnectionIndicators(lines);
  const missingInformationIndicators = detectMissingInformationIndicators(lines);

  // ── Partial assembly (needed for timeline and pattern builders) ─────────────
  const partial = {
    events,
    symptoms,
    diagnoses,
    medications,
    testsAndResults,
    profilesAndDutyLimits,
    functionalImpactStatements,
    deploymentIndicators,
    mentalHealthIndicators,
    serviceConnectionIndicators,
    missingInformationIndicators,
    conditionPatterns: [],
    timelines: { global: [], byCondition: {} },
  };

  // ── Timeline Phase ──────────────────────────────────────────────────────────
  const conditionPatterns = buildConditionPatterns(partial);
  partial.conditionPatterns = conditionPatterns;

  const global = buildGlobalTimeline(partial);
  const byCondition = buildConditionTimelines(partial);

  // ── Full Assembly ───────────────────────────────────────────────────────────
  const strAnalysis = {
    ...partial,
    conditionPatterns,
    timelines: { global, byCondition },
    schemaVersion: STR_SCHEMA_VERSION,
    extractionMode: 'deterministic-explicit-only',
    confidenceSummary: {
      events: buildSectionConfidence(events),
      symptoms: buildSectionConfidence(symptoms),
      diagnoses: buildSectionConfidence(diagnoses),
      medications: buildSectionConfidence(medications),
      testsAndResults: buildSectionConfidence(testsAndResults),
      profilesAndDutyLimits: buildSectionConfidence(profilesAndDutyLimits),
      functionalImpactStatements: buildSectionConfidence(functionalImpactStatements),
      deploymentIndicators: buildSectionConfidence(deploymentIndicators),
      mentalHealthIndicators: buildSectionConfidence(mentalHealthIndicators),
      serviceConnectionIndicators: buildSectionConfidence(serviceConnectionIndicators),
    },
    notes: empty.notes,
  };

  // ── Optional: Cross-Validation ──────────────────────────────────────────────
  if (includeCrossValidation) {
    strAnalysis.crossValidation = runCrossValidation(strAnalysis);
  }

  // ── Optional: Evidence Graph Nodes ─────────────────────────────────────────
  if (includeEvidenceGraph) {
    strAnalysis.evidenceGraphNodes = buildEvidenceGraphNodes(strAnalysis);
  }

  // ── Schema Validation ───────────────────────────────────────────────────────
  const schemaCheck = validateStrAnalysisSchema(strAnalysis);
  strAnalysis.schemaValid = schemaCheck.valid;
  strAnalysis.schemaMissingKeys = schemaCheck.missingKeys;

  return strAnalysis;
}

export { buildEvidenceGraphNodes } from './evidenceGraphMapping.js';
export { buildGlobalTimeline, buildConditionTimelines, buildConditionPatterns } from './timelineBuilder.js';
export { runCrossValidation } from './crossValidation.js';
export { validateStrAnalysisSchema, buildEmptyStrAnalysis, STR_SCHEMA_VERSION } from './strSchema.js';
