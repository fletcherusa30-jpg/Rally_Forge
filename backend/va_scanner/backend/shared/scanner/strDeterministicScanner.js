/**
 * Deterministic STR scanner for required grouped arrays.
 * Now includes structured strAnalysis via the strAnalysis subsystem (v3.1).
 * No AI inference, no diagnosis rewriting. No medical conclusions.
 */

import { buildExtractionMeta, preprocessScannerText } from './scannerMiddleware.js';
import { validateSTRSchema } from './schemaValidators.js';
import { buildStrAnalysis } from './strAnalysis/index.js';

function toIsoDate(y, m, d) {
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1940 || year > 2035 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDateFromLine(line) {
  const ymd = line.match(/\b(20\d{2}|19\d{2})[\/-](\d{1,2})[\/-](\d{1,2})\b/);
  if (ymd) return toIsoDate(ymd[1], ymd[2], ymd[3]);

  const mdy = line.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2}|19\d{2})\b/);
  if (mdy) return toIsoDate(mdy[3], mdy[1], mdy[2]);

  return null;
}

function uniquePush(arr, keySet, entry, key) {
  if (keySet.has(key)) return;
  keySet.add(key);
  arr.push(entry);
}

function extractEntries(lines, patterns, mapper) {
  const results = [];
  const seen = new Set();

  lines.forEach((line, idx) => {
    patterns.forEach((pattern) => {
      const m = line.match(pattern);
      if (!m) return;
      const date = parseDateFromLine(line);
      const entry = mapper({ line, match: m, date, lineNumber: idx + 1 });
      if (!entry) return;
      const key = `${entry.type || 'entry'}|${entry.rawText || line}|${entry.date || ''}`.toLowerCase();
      uniquePush(results, seen, entry, key);
    });
  });

  return results;
}

const diagnosisPatterns = [
  /\b(?:diagnosis|assessment|impression|problem\s+list)\s*[:\-]\s*(.+)$/i,
  /\b(?:dx)\s*[:\-]\s*(.+)$/i,
];

const symptomPatterns = [
  /\b(?:complains?\s+of|reports?|symptoms?)\s*[:\-]?\s*(.+)$/i,
  /\b(?:pain|headache|fatigue|numbness|insomnia|anxiety|depression)\b/i,
];

const treatmentPatterns = [
  /\b(?:treated\s+with|treatment\s*[:\-]|plan\s*[:\-])\s*(.+)$/i,
  /\b(?:physical\s+therapy|pt\b|injection|follow-?up|rehab|counseling)\b/i,
];

const medicationPatterns = [
  /\b(?:medications?|rx|prescribed|started\s+on)\s*[:\-]?\s*(.+)$/i,
  /\b(?:sertraline|fluoxetine|ibuprofen|naproxen|gabapentin|tramadol|acetaminophen|albuterol|omeprazole)\b/i,
];

const dutyPatterns = [
  /\b(?:profile|duty\s+limitation|limited\s+duty|no\s+running|light\s+duty|quarters?)\b/i,
];

const lodPatterns = [
  /\b(?:lod|line\s+of\s+duty|in\s+line\s+of\s+duty)\b/i,
];

const exposurePatterns = [
  /\b(?:burn\s+pit|toxic|chemical|solvent|asbestos|radiation|smoke\s+exposure|oil\s+fire|particulate)\b/i,
  /\b(?:iraq|afghanistan|kuwait|somalia|kosovo|syria|vietnam|korea\s+dmz)\b/i,
];

const injuryPatterns = [
  /\b(?:injury|sprain|strain|fracture|contusion|laceration|trauma|wound)\b/i,
];

const surgeryPatterns = [
  /\b(?:surgery|surgical|operative\s+report|arthroscopy|repair|fusion|debridement)\b/i,
];

const mentalHealthPatterns = [
  /\b(?:ptsd|depression|anxiety|panic|adjustment\s+disorder|behavioral\s+health|mental\s+health)\b/i,
];

export function scanSTRDeterministic(rawText) {
  const text = preprocessScannerText(rawText);
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);

  const medicalEvents = [];
  const injuries = [];
  const chronicConditions = [];
  const mentalHealthFlags = [];
  const exposureEvents = [];
  const dutyLimitations = [];
  const surgeries = [];
  const medications = [];

  const medEventSet = new Set();
  const injurySet = new Set();
  const chronicSet = new Set();
  const mhSet = new Set();
  const exposureSet = new Set();
  const dutySet = new Set();
  const surgerySet = new Set();
  const medicationSet = new Set();

  lines.forEach((line, idx) => {
    const date = parseDateFromLine(line);
    const lineNumber = idx + 1;

    diagnosisPatterns.forEach((p) => {
      const m = line.match(p);
      if (!m) return;
      const value = (m[1] || line).trim();
      const entry = { date, type: 'diagnosis', value, rawText: line, lineNumber };
      uniquePush(medicalEvents, medEventSet, entry, `dx|${value}|${date || ''}`.toLowerCase());

      if (/\b(chronic|persistent|recurrent|ongoing|for\s+\d+\s+(?:months|years))\b/i.test(line)) {
        uniquePush(chronicConditions, chronicSet, { date, value, rawText: line, lineNumber }, `chronic|${value}|${date || ''}`.toLowerCase());
      }
    });

    symptomPatterns.forEach((p) => {
      const m = line.match(p);
      if (!m) return;
      const value = (m[1] || line).trim();
      uniquePush(medicalEvents, medEventSet, { date, type: 'symptom', value, rawText: line, lineNumber }, `sx|${value}|${date || ''}`.toLowerCase());
    });

    treatmentPatterns.forEach((p) => {
      const m = line.match(p);
      if (!m) return;
      const value = (m[1] || line).trim();
      uniquePush(medicalEvents, medEventSet, { date, type: 'treatment', value, rawText: line, lineNumber }, `tx|${value}|${date || ''}`.toLowerCase());
    });

    medicationPatterns.forEach((p) => {
      const m = line.match(p);
      if (!m) return;
      const value = (m[1] || m[0] || line).trim();
      uniquePush(medications, medicationSet, { date, value, rawText: line, lineNumber }, `med|${value}|${date || ''}`.toLowerCase());
    });

    dutyPatterns.forEach((p) => {
      if (!p.test(line)) return;
      uniquePush(dutyLimitations, dutySet, { date, value: line, rawText: line, lineNumber }, `duty|${line}|${date || ''}`.toLowerCase());
      uniquePush(medicalEvents, medEventSet, { date, type: 'duty-limitation', value: line, rawText: line, lineNumber }, `me-duty|${line}|${date || ''}`.toLowerCase());
    });

    lodPatterns.forEach((p) => {
      if (!p.test(line)) return;
      uniquePush(medicalEvents, medEventSet, { date, type: 'lod-indicator', value: line, rawText: line, lineNumber }, `lod|${line}|${date || ''}`.toLowerCase());
    });

    exposurePatterns.forEach((p) => {
      if (!p.test(line)) return;
      uniquePush(exposureEvents, exposureSet, { date, value: line, rawText: line, lineNumber }, `exp|${line}|${date || ''}`.toLowerCase());
      uniquePush(medicalEvents, medEventSet, { date, type: 'exposure-event', value: line, rawText: line, lineNumber }, `me-exp|${line}|${date || ''}`.toLowerCase());
    });

    injuryPatterns.forEach((p) => {
      if (!p.test(line)) return;
      uniquePush(injuries, injurySet, { date, value: line, rawText: line, lineNumber }, `inj|${line}|${date || ''}`.toLowerCase());
    });

    surgeryPatterns.forEach((p) => {
      if (!p.test(line)) return;
      uniquePush(surgeries, surgerySet, { date, value: line, rawText: line, lineNumber }, `surg|${line}|${date || ''}`.toLowerCase());
    });

    mentalHealthPatterns.forEach((p) => {
      if (!p.test(line)) return;
      uniquePush(mentalHealthFlags, mhSet, {
        date,
        value: line,
        summary: 'Mental health indicator present in STR text.',
        rawText: line,
        lineNumber,
      }, `mh|${line}|${date || ''}`.toLowerCase());
    });
  });

  const result = {
    documentType: 'STR',
    schemaVersion: '3.0.0',
    scannerVersion: '3.0.0',
    medicalEvents,
    injuries,
    chronicConditions,
    mentalHealthFlags,
    exposureEvents,
    dutyLimitations,
    surgeries,
    medications,
    strAnalysis: buildStrAnalysis(text, { includeEvidenceGraph: false, includeCrossValidation: true }),
    extractionMeta: buildExtractionMeta({
      scannerType: 'str',
      schemaVersion: '3.0.0',
      confidence: lines.length ? 0.85 : 0,
      fieldsPopulated: [medicalEvents, injuries, chronicConditions, mentalHealthFlags, exposureEvents, dutyLimitations, surgeries, medications].filter((value) => value.length > 0).length,
      fieldsTotal: 8,
    }),
  };

  const schema = validateSTRSchema(result);
  result.extractionMeta.schemaValid = schema.valid;
  result.extractionMeta.schemaErrors = schema.errors;

  return result;
}
