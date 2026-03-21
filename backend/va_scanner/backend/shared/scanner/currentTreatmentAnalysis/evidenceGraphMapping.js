/**
 * Map current treatment analysis to Evidence Graph-friendly nodes.
 */

function toNode(type, item, index) {
  return {
    id: `${type}-${index + 1}`,
    type,
    value: item?.value || null,
    date: item?.date || null,
    lineNumber: item?.lineNumber || null,
  };
}

export function buildCurrentTreatmentEvidenceGraphNodes(analysis) {
  return [
    ...(analysis.currentConditions || []).map((v, i) => toNode('CurrentCondition', v, i)),
    ...(analysis.worseningConditions || []).map((v, i) => toNode('CurrentWorseningIndicator', v, i)),
    ...(analysis.functionalLimitations || []).map((v, i) => toNode('CurrentFunctionalLimitation', v, i)),
    ...(analysis.medications || []).map((v, i) => toNode('CurrentMedication', v, i)),
    ...(analysis.treatments || []).map((v, i) => toNode('CurrentTreatment', v, i)),
    ...(analysis.providers || []).map((v, i) => toNode('CurrentProviderReference', v, i)),
    ...(analysis.testsAndResults || []).map((v, i) => toNode('CurrentTestResult', v, i)),
    ...(analysis.appointments || []).map((v, i) => toNode('CurrentAppointment', v, i)),
  ];
}
