/**
 * Timeline builder for current treatment analysis.
 */

function compareDates(a, b) {
  const da = a?.date || '9999-99-99';
  const db = b?.date || '9999-99-99';
  if (da < db) return -1;
  if (da > db) return 1;
  return 0;
}

function toTimelineItem(type, entry) {
  return {
    type,
    date: entry?.date || null,
    value: entry?.value || null,
    lineNumber: entry?.lineNumber || null,
  };
}

export function buildCurrentTreatmentTimeline(data) {
  const global = [
    ...(data.currentConditions || []).map((v) => toTimelineItem('condition', v)),
    ...(data.worseningConditions || []).map((v) => toTimelineItem('worsening', v)),
    ...(data.medications || []).map((v) => toTimelineItem('medication', v)),
    ...(data.treatments || []).map((v) => toTimelineItem('treatment', v)),
    ...(data.testsAndResults || []).map((v) => toTimelineItem('test', v)),
    ...(data.appointments || []).map((v) => toTimelineItem('appointment', v)),
  ].sort(compareDates);

  const byCondition = {};
  for (const condition of data.currentConditions || []) {
    const key = String(condition.value || 'unspecified').toLowerCase();
    if (!byCondition[key]) byCondition[key] = [];
    byCondition[key].push(toTimelineItem('condition', condition));
  }

  return { global, byCondition };
}
