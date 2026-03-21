/**
 * Current Treatment analysis orchestrator.
 */

import { extractCurrentTreatmentData } from './extractionLibrary.js';
import { buildCurrentTreatmentTimeline } from './timelineBuilder.js';
import { runCurrentTreatmentCrossValidation } from './crossValidation.js';
import { buildCurrentTreatmentEvidenceGraphNodes } from './evidenceGraphMapping.js';
import {
  CURRENT_TREATMENT_ANALYSIS_SCHEMA_VERSION,
  validateCurrentTreatmentAnalysisSchema,
  buildEmptyCurrentTreatmentAnalysis,
} from './schema.js';

function summarizeConfidence(items = []) {
  const total = Array.isArray(items) ? items.length : 0;
  if (!total) return { extractedCount: 0, explicitEvidenceCount: 0, confidence: 0 };
  const explicitEvidenceCount = items.filter((item) => item?.rawText || item?.lineNumber || item?.date).length;
  return {
    extractedCount: total,
    explicitEvidenceCount,
    confidence: Number((explicitEvidenceCount / total).toFixed(2)),
  };
}

export function buildCurrentTreatmentAnalysis(text, {
  includeEvidenceGraph = false,
  includeCrossValidation = true,
} = {}) {
  if (!text || !String(text).trim()) {
    return {
      ...buildEmptyCurrentTreatmentAnalysis(),
      schemaVersion: CURRENT_TREATMENT_ANALYSIS_SCHEMA_VERSION,
      validation: validateCurrentTreatmentAnalysisSchema(buildEmptyCurrentTreatmentAnalysis()),
    };
  }

  const extracted = extractCurrentTreatmentData(text);
  const timeline = buildCurrentTreatmentTimeline(extracted);
  const crossValidation = includeCrossValidation
    ? runCurrentTreatmentCrossValidation(extracted)
    : buildEmptyCurrentTreatmentAnalysis().crossValidation;

  const analysis = {
    ...extracted,
    timeline,
    crossValidation,
    schemaVersion: CURRENT_TREATMENT_ANALYSIS_SCHEMA_VERSION,
    extractionMode: 'deterministic-explicit-only',
    confidenceSummary: {
      currentConditions: summarizeConfidence(extracted.currentConditions),
      worseningConditions: summarizeConfidence(extracted.worseningConditions),
      functionalLimitations: summarizeConfidence(extracted.functionalLimitations),
      medications: summarizeConfidence(extracted.medications),
      treatments: summarizeConfidence(extracted.treatments),
      providers: summarizeConfidence(extracted.providers),
      testsAndResults: summarizeConfidence(extracted.testsAndResults),
      appointments: summarizeConfidence(extracted.appointments),
    },
    notes: 'For human review only. No medical advice or legal conclusions.',
  };

  if (includeEvidenceGraph) {
    analysis.evidenceGraphNodes = buildCurrentTreatmentEvidenceGraphNodes(analysis);
  }

  analysis.validation = validateCurrentTreatmentAnalysisSchema(analysis);
  return analysis;
}
