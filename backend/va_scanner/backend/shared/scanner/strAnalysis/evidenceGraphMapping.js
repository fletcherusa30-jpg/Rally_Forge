/**
 * evidenceGraphMapping.js — Rally Forge STR Scanner v3.1
 *
 * Maps STR analysis output to Evidence Graph node format.
 * Each extracted element becomes a typed graph node with
 * attributes and relationships for ingestion into the Evidence Graph.
 *
 * Node types emitted:
 *   STREvent, STRSymptom, STRDiagnosis, STRMedication, STRTest,
 *   STRProfile, STRFunctionalImpact, STRDeployment, STRMentalHealth,
 *   STRServiceConnectionIndicator
 *
 * SAFETY NOTICE: Graph nodes are extracted information only.
 * No medical conclusions, no benefit determinations.
 */

let _nodeIdCounter = 0;
function nodeId(prefix) {
  return `${prefix}-${++_nodeIdCounter}`;
}

function baseNode(type, source, extra = {}) {
  return {
    id: nodeId(type.toLowerCase().replace(/[^a-z]/g, '-')),
    nodeType: type,
    source: 'STR',
    ...extra,
  };
}

// ── Event Nodes ───────────────────────────────────────────────────────────────

function mapEvents(events) {
  return (events || []).map(evt => baseNode('STREvent', 'STR', {
    sourceId: evt.id,
    attributes: {
      eventType: evt.eventType,
      description: evt.description,
      date: evt.date,
      facility: evt.facility,
      lineNumber: evt.lineNumber,
    },
    relationships: [
      ...(evt.associatedSymptoms || []).map(s => ({ type: 'HAS_SYMPTOM', targetId: s })),
      ...(evt.associatedDiagnoses || []).map(d => ({ type: 'HAS_DIAGNOSIS', targetId: d })),
    ],
  }));
}

// ── Symptom Nodes ─────────────────────────────────────────────────────────────

function mapSymptoms(symptoms) {
  return (symptoms || []).map(sym => baseNode('STRSymptom', 'STR', {
    sourceId: sym.id,
    attributes: {
      symptomType: sym.symptomType,
      bodyLocation: sym.bodyLocation,
      severity: sym.severity,
      date: sym.date,
      lineNumber: sym.lineNumber,
    },
    relationships: sym.contextEventId
      ? [{ type: 'RELATED_TO_EVENT', targetId: sym.contextEventId }]
      : [],
  }));
}

// ── Diagnosis Nodes ───────────────────────────────────────────────────────────

function mapDiagnoses(diagnoses) {
  return (diagnoses || []).map(dx => baseNode('STRDiagnosis', 'STR', {
    sourceId: dx.id,
    attributes: {
      diagnosisName: dx.diagnosisName,
      diagnosisType: dx.diagnosisType,
      date: dx.date,
      providerType: dx.providerType,
      lineNumber: dx.lineNumber,
    },
    relationships: dx.linkedEventId
      ? [{ type: 'RELATED_TO_EVENT', targetId: dx.linkedEventId }]
      : [],
  }));
}

// ── Medication Nodes ──────────────────────────────────────────────────────────

function mapMedications(medications) {
  return (medications || []).map(med => baseNode('STRMedication', 'STR', {
    sourceId: med.id,
    attributes: {
      medicationName: med.medicationName,
      dosage: med.dosage,
      frequency: med.frequency,
      purpose: med.purpose,
      startDate: med.startDate,
      stopDate: med.stopDate,
      lineNumber: med.lineNumber,
    },
    relationships: [],
  }));
}

// ── Test Nodes ────────────────────────────────────────────────────────────────

function mapTests(tests) {
  return (tests || []).map(t => baseNode('STRTest', 'STR', {
    sourceId: t.id,
    attributes: {
      testType: t.testType,
      date: t.date,
      findingsSummary: t.findingsSummary,
      impressionSummary: t.impressionSummary,
      relatedCondition: t.relatedCondition,
      lineNumber: t.lineNumber,
    },
    relationships: [],
  }));
}

// ── Profile Nodes ─────────────────────────────────────────────────────────────

function mapProfiles(profiles) {
  return (profiles || []).map(p => baseNode('STRProfile', 'STR', {
    sourceId: p.id,
    attributes: {
      profileType: p.profileType,
      limitations: p.limitations,
      startDate: p.startDate,
      endDate: p.endDate,
      lodStatus: p.lodStatus,
      relatedCondition: p.relatedCondition,
      lineNumber: p.lineNumber,
    },
    relationships: [],
  }));
}

// ── Functional Impact Nodes ───────────────────────────────────────────────────

function mapFunctionalImpact(impacts) {
  return (impacts || []).map(fi => baseNode('STRFunctionalImpact', 'STR', {
    sourceId: fi.id,
    attributes: {
      description: fi.functionalImpactDescription,
      relatedCondition: fi.relatedCondition,
      date: fi.date,
      lineNumber: fi.lineNumber,
    },
    relationships: [],
  }));
}

// ── Deployment Nodes ──────────────────────────────────────────────────────────

function mapDeploymentIndicators(indicators) {
  return (indicators || []).map(dep => baseNode('STRDeployment', 'STR', {
    sourceId: dep.id,
    attributes: {
      indicatorType: dep.indicatorType,
      theaterOfOperations: dep.theaterOfOperations,
      exposureStatement: dep.exposureStatement,
      date: dep.date,
      lineNumber: dep.lineNumber,
    },
    relationships: [],
  }));
}

// ── Mental Health Nodes ───────────────────────────────────────────────────────

function mapMentalHealthIndicators(indicators) {
  return (indicators || []).map(mh => baseNode('STRMentalHealth', 'STR', {
    sourceId: mh.id,
    attributes: {
      mentalHealthType: mh.mentalHealthType,
      symptoms: mh.symptoms,
      date: mh.date,
      lineNumber: mh.lineNumber,
    },
    relationships: (mh.linkedEventIds || []).map(id => ({ type: 'RELATED_TO_EVENT', targetId: id })),
  }));
}

// ── Service-Connection Indicator Nodes ───────────────────────────────────────

function mapServiceConnectionIndicators(indicators) {
  return (indicators || []).map(sci => baseNode('STRServiceConnectionIndicator', 'STR', {
    sourceId: sci.id,
    attributes: {
      phrase: sci.phrase,
      contextSnippet: sci.contextSnippet,
      date: sci.date,
      lineNumber: sci.lineNumber,
      note: sci.note,
    },
    relationships: [],
  }));
}

// ── Main: Build Evidence Graph Nodes ─────────────────────────────────────────

/**
 * Map all STR analysis fields to Evidence Graph node format.
 *
 * @param {Object} strAnalysis - Output from buildStrAnalysis()
 * @returns {Object[]} Array of graph nodes ready for ingestion
 */
export function buildEvidenceGraphNodes(strAnalysis) {
  _nodeIdCounter = 0; // reset for deterministic output within a scan

  return [
    ...mapEvents(strAnalysis.events),
    ...mapSymptoms(strAnalysis.symptoms),
    ...mapDiagnoses(strAnalysis.diagnoses),
    ...mapMedications(strAnalysis.medications),
    ...mapTests(strAnalysis.testsAndResults),
    ...mapProfiles(strAnalysis.profilesAndDutyLimits),
    ...mapFunctionalImpact(strAnalysis.functionalImpactStatements),
    ...mapDeploymentIndicators(strAnalysis.deploymentIndicators),
    ...mapMentalHealthIndicators(strAnalysis.mentalHealthIndicators),
    ...mapServiceConnectionIndicators(strAnalysis.serviceConnectionIndicators),
  ];
}
