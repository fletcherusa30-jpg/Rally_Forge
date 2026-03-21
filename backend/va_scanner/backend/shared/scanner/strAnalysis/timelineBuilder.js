/**
 * timelineBuilder.js — Rally Forge STR Scanner v3.1
 *
 * Builds chronological timelines from extracted STR data.
 * Produces:
 *   - global: all events ordered by date
 *   - byCondition: per-condition timelines
 *   - conditionPatterns: pattern summary (first/last mention, count, chronicity flags)
 *
 * SAFETY NOTICE: Output is for human review only. No medical conclusions.
 */

// ── Date Sorting Helper ───────────────────────────────────────────────────────

function compareDates(a, b) {
  if (!a.date && !b.date) return 0;
  if (!a.date) return 1;
  if (!b.date) return -1;
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

// ── Build a Single Timeline Entry ────────────────────────────────────────────

function buildEntry(item, category) {
  return {
    date: item.date || null,
    category,
    id: item.id || null,
    summary: buildSummary(item, category),
    lineNumber: item.lineNumber || null,
  };
}

function buildSummary(item, category) {
  switch (category) {
    case 'event':
      return `[${item.eventType || 'event'}] ${(item.description || item.rawText || '').slice(0, 120)}`;
    case 'symptom':
      return `[symptom:${item.symptomType}] ${item.bodyLocation ? `(${item.bodyLocation}) ` : ''}${(item.rawText || '').slice(0, 80)}`;
    case 'diagnosis':
      return `[${item.diagnosisType || 'diagnosis'}] ${item.diagnosisName || (item.rawText || '').slice(0, 80)}`;
    case 'medication':
      return `[medication] ${item.medicationName || ''}${item.dosage ? ` ${item.dosage}` : ''}`;
    case 'test':
      return `[${item.testType || 'test'}] ${item.findingsSummary ? item.findingsSummary.slice(0, 80) : (item.rawText || '').slice(0, 80)}`;
    case 'profile':
      return `[profile] ${item.profileType || ''} ${item.limitations || ''} ${item.lodStatus || ''}`.trim();
    case 'functionalImpact':
      return `[functional impact] ${item.functionalImpactDescription || ''}`;
    case 'deployment':
      return `[${item.indicatorType || 'deployment'}] ${item.theaterOfOperations || ''} ${item.exposureStatement?.slice(0, 80) || ''}`.trim();
    case 'mentalHealth':
      return `[${item.mentalHealthType || 'mentalHealth'}] ${item.rawText?.slice(0, 80) || ''}`;
    case 'serviceConnectionIndicator':
      return `[sc-indicator] ${item.phrase}`;
    default:
      return (item.rawText || '').slice(0, 80);
  }
}

// ── Condition Keyword Normalization ──────────────────────────────────────────

const CONDITION_KEYWORDS = [
  'back', 'lumbar', 'spine', 'knee', 'shoulder', 'hip', 'ankle', 'neck',
  'hearing', 'tinnitus', 'vision', 'ptsd', 'depression', 'anxiety',
  'headache', 'migraine', 'sleep', 'fatigue', 'pain',
  'fracture', 'sprain', 'strain', 'concussion', 'traumatic brain',
  'respiratory', 'asthma', 'gi', 'gastric', 'diabetes',
];

function assignConditionGroup(item) {
  const text = [item.description, item.rawText, item.diagnosisName, item.symptomType, item.functionalImpactDescription]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const kw of CONDITION_KEYWORDS) {
    if (text.includes(kw)) return kw;
  }
  return 'general';
}

// ── Main: Build Global Timeline ───────────────────────────────────────────────

export function buildGlobalTimeline(strData) {
  const entries = [];

  const push = (arr, cat) => (arr || []).forEach(item => entries.push(buildEntry(item, cat)));

  push(strData.events, 'event');
  push(strData.symptoms, 'symptom');
  push(strData.diagnoses, 'diagnosis');
  push(strData.medications, 'medication');
  push(strData.testsAndResults, 'test');
  push(strData.profilesAndDutyLimits, 'profile');
  push(strData.functionalImpactStatements, 'functionalImpact');
  push(strData.deploymentIndicators, 'deployment');
  push(strData.mentalHealthIndicators, 'mentalHealth');
  push(strData.serviceConnectionIndicators, 'serviceConnectionIndicator');

  return entries.sort(compareDates);
}

// ── Build Per-Condition Timelines ─────────────────────────────────────────────

export function buildConditionTimelines(strData) {
  const byCondition = {};

  const allItems = [
    ...((strData.events || []).map(i => ({ ...i, _cat: 'event' }))),
    ...((strData.symptoms || []).map(i => ({ ...i, _cat: 'symptom' }))),
    ...((strData.diagnoses || []).map(i => ({ ...i, _cat: 'diagnosis' }))),
    ...((strData.medications || []).map(i => ({ ...i, _cat: 'medication' }))),
    ...((strData.testsAndResults || []).map(i => ({ ...i, _cat: 'test' }))),
    ...((strData.profilesAndDutyLimits || []).map(i => ({ ...i, _cat: 'profile' }))),
    ...((strData.functionalImpactStatements || []).map(i => ({ ...i, _cat: 'functionalImpact' }))),
    ...((strData.mentalHealthIndicators || []).map(i => ({ ...i, _cat: 'mentalHealth' }))),
  ];

  for (const item of allItems) {
    const group = assignConditionGroup(item);
    if (!byCondition[group]) byCondition[group] = [];
    byCondition[group].push(buildEntry(item, item._cat));
  }

  // Sort each group
  for (const key of Object.keys(byCondition)) {
    byCondition[key].sort(compareDates);
  }

  return byCondition;
}

// ── Build Condition Patterns ───────────────────────────────────────────────────

export function buildConditionPatterns(strData) {
  const allItems = [
    ...((strData.events || []).map(i => ({ ...i, _cat: 'event' }))),
    ...((strData.symptoms || []).map(i => ({ ...i, _cat: 'symptom' }))),
    ...((strData.diagnoses || []).map(i => ({ ...i, _cat: 'diagnosis' }))),
  ];

  const groups = {};
  for (const item of allItems) {
    const group = assignConditionGroup(item);
    if (!groups[group]) groups[group] = [];
    groups[group].push(item);
  }

  return Object.entries(groups).map(([conditionName, items]) => {
    const datedItems = items.filter(i => i.date).sort(compareDates);
    const firstMentionDate = datedItems.length > 0 ? datedItems[0].date : null;
    const lastMentionDate = datedItems.length > 0 ? datedItems[datedItems.length - 1].date : null;
    const hasChronicity = items.some(i => /chronic|recurrent|persistent|ongoing/i.test(i.rawText || ''));

    // Calculate approximate span in months
    let spanMonths = null;
    if (firstMentionDate && lastMentionDate && firstMentionDate !== lastMentionDate) {
      const d1 = new Date(firstMentionDate);
      const d2 = new Date(lastMentionDate);
      spanMonths = Math.round((d2 - d1) / (1000 * 60 * 60 * 24 * 30));
    }

    return {
      conditionName,
      firstMentionDate,
      lastMentionDate,
      numberOfMentions: items.length,
      spanMonths,
      hasChronicityIndicator: hasChronicity,
      patternSummary: buildPatternSummary(conditionName, items.length, firstMentionDate, lastMentionDate, hasChronicity),
    };
  }).sort((a, b) => b.numberOfMentions - a.numberOfMentions);
}

function buildPatternSummary(name, count, first, last, chronic) {
  const parts = [`${count} reference(s) to "${name}"`];
  if (first) parts.push(`first: ${first}`);
  if (last && last !== first) parts.push(`last: ${last}`);
  if (chronic) parts.push('chronicity indicator present');
  return parts.join('; ');
}
