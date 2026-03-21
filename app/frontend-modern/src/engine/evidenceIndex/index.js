/**
 * Engine: evidenceIndex
 * Purpose: Build prioritized evidence rows for generated conditions using unified data and timeline context.
 * Inputs: claimDataUnified and generated condition rows.
 * Outputs: Array of normalized evidence entries with source/date/summary/priority.
 * Trigger conditions: Any silent unified-data update or condition-generation recompute.
 */
import { EVIDENCE_SOURCE_PRIORITY } from '../shared/claimEngineConfig.js';
import { conditionMatches } from '../shared/conditionNormalization.js';

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value) {
  return String(value || '').trim();
}

function normalizeDate(value) {
  const text = asText(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    if (/^\d{4}$/.test(text)) return `${text}-01-01`;
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function confidenceFromCondition(condition = {}) {
  const level = asText(condition?.confidence).toLowerCase();
  if (level === 'high' || level === 'medium' || level === 'low') return level;
  const score = Number(condition?.confidenceScore || 0);
  if (score >= 85) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

function buildRowsFromCondition(condition = {}) {
  const confidence = confidenceFromCondition(condition);
  const rows = [];
  const mapper = {
    STR: 'str',
    Treatment: 'treatment',
    Service: 'service',
    'Rating Decision': 'ratingDecision',
  };

  Object.entries(mapper).forEach(([source, key]) => {
    asList(condition?.evidence?.[key]).forEach((item) => {
      rows.push({
        source,
        sourceType: source,
        date: null,
        conditionName: asText(condition?.conditionName),
        summary: asText(item),
        evidence: asText(item),
        confidence,
      });
    });
  });

  return rows;
}

function buildDerivedRows(claimDataUnified = {}, conditionName = '', confidence = 'medium') {
  const rows = [];
  const derived = claimDataUnified?.derivedSignals || {};

  asList(derived?.exposures).forEach((item) => {
    rows.push({
      source: 'Derived',
      sourceType: 'Derived',
      date: null,
      conditionName,
      summary: `Exposure signal: ${asText(item)}`,
      evidence: `Exposure signal: ${asText(item)}`,
      confidence,
    });
  });

  asList(derived?.worseningIndicators)
    .filter((item) => conditionMatches(item, conditionName))
    .forEach((item) => {
      rows.push({
        source: 'Derived',
        sourceType: 'Derived',
        date: null,
        conditionName,
        summary: `Worsening indicator: ${asText(item)}`,
        evidence: `Worsening indicator: ${asText(item)}`,
        confidence,
      });
    });

  asList(derived?.secondaryCandidates)
    .filter((pair) => conditionMatches(pair?.secondary, conditionName))
    .forEach((pair) => {
      rows.push({
        source: 'Derived',
        sourceType: 'Derived',
        date: null,
        conditionName,
        summary: `Secondary linkage: ${asText(pair?.primary)} -> ${asText(pair?.secondary)}`,
        evidence: `Secondary linkage: ${asText(pair?.primary)} -> ${asText(pair?.secondary)}`,
        confidence,
      });
    });

  return rows;
}

function buildTimelineRows(claimDataUnified = {}, conditionName = '', confidence = 'medium') {
  return asList(claimDataUnified?.timeline)
    .filter((event) => !event?.conditionName || conditionMatches(event?.conditionName, conditionName) || conditionMatches(event?.summary, conditionName))
    .map((event) => ({
      source: 'Derived',
      sourceType: 'Derived',
      date: normalizeDate(event?.date),
      conditionName,
      summary: `Timeline: ${asText(event?.summary)}`,
      evidence: `Timeline: ${asText(event?.summary)}`,
      confidence,
    }));
}

function dedupeRows(rows = []) {
  const seen = new Set();
  const deduped = [];

  rows.forEach((row) => {
    const key = `${row.conditionName}|${row.source}|${row.date || 'null'}|${row.summary}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(row);
  });

  return deduped;
}

function sortRows(rows = []) {
  return [...rows].sort((a, b) => {
    const dateA = a.date || '9999-12-31';
    const dateB = b.date || '9999-12-31';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const priA = EVIDENCE_SOURCE_PRIORITY[a.source] || 99;
    const priB = EVIDENCE_SOURCE_PRIORITY[b.source] || 99;
    if (priA !== priB) return priA - priB;
    return a.summary.localeCompare(b.summary);
  });
}

export function runEvidenceIndexEngine(claimDataUnified = {}, generatedConditions = []) {
  const rows = [];

  asList(generatedConditions).forEach((condition) => {
    const confidence = confidenceFromCondition(condition);
    rows.push(...buildRowsFromCondition(condition));
    rows.push(...buildDerivedRows(claimDataUnified, condition?.conditionName, confidence));
    rows.push(...buildTimelineRows(claimDataUnified, condition?.conditionName, confidence));

    asList(claimDataUnified?.str?.extractedFindings?.evidenceSnippets)
      .filter((snippet) => conditionMatches(snippet, condition?.conditionName))
      .forEach((snippet) => {
        rows.push({
          source: 'STR',
          sourceType: 'STR',
          date: null,
          conditionName: asText(condition?.conditionName),
          summary: `Evidence snippet: ${asText(snippet)}`,
          evidence: `Evidence snippet: ${asText(snippet)}`,
          confidence,
        });
      });

    asList(claimDataUnified?.currentTreatment?.extractedFindings?.evidenceSnippets)
      .filter((snippet) => conditionMatches(snippet, condition?.conditionName))
      .forEach((snippet) => {
        rows.push({
          source: 'Treatment',
          sourceType: 'Treatment',
          date: null,
          conditionName: asText(condition?.conditionName),
          summary: `Evidence snippet: ${asText(snippet)}`,
          evidence: `Evidence snippet: ${asText(snippet)}`,
          confidence,
        });
      });
  });

  return sortRows(dedupeRows(rows));
}
