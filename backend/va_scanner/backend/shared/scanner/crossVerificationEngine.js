/**
 * Deterministic cross-verification engine.
 */

import { buildExtractionMeta } from './scannerMiddleware.js';
import { validateCrossVerificationSchema } from './schemaValidators.js';

function toDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) return null;
  const d = new Date(v + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

function inRange(date, start, end) {
  const d = toDate(date);
  const s = toDate(start);
  const e = toDate(end);
  if (!d || !s || !e) return false;
  return d >= s && d <= e;
}

function normalizeText(v) {
  return String(v || '').toLowerCase();
}

function isCombatAward(awardText) {
  const a = normalizeText(awardText);
  return [
    'purple heart',
    'combat infantry badge',
    'combat action badge',
    'combat medical badge',
    'bronze star',
    'silver star',
    'valor',
    ' v ',
    ' v-device',
  ].some((k) => a.includes(k));
}

export function crossVerifyDD214WithSTR({ dd214, strData, includeInferredConnections = false }) {
  const matches = [];
  const mismatches = [];
  const missingEvidence = [];
  const confidenceScores = [];
  const inferredConnections = [];

  const startDate = dd214?.servicePeriods?.entryDate || null;
  const endDate = dd214?.servicePeriods?.separationDate || null;

  // 1) DD214 service periods <-> STR encounter dates
  const datedMedicalEvents = (strData?.medicalEvents || []).filter((e) => !!e.date);
  const inServiceEvents = datedMedicalEvents.filter((e) => inRange(e.date, startDate, endDate));

  if (datedMedicalEvents.length === 0) {
    missingEvidence.push({
      rule: 'servicePeriods_vs_strDates',
      message: 'No STR encounter dates available for verification.',
    });
    confidenceScores.push({ rule: 'servicePeriods_vs_strDates', score: 0.2 });
  } else if (inServiceEvents.length === 0) {
    mismatches.push({
      rule: 'servicePeriods_vs_strDates',
      message: 'STR encounter dates do not fall within DD214 service period.',
      details: { startDate, endDate, sampleDates: datedMedicalEvents.slice(0, 5).map((e) => e.date) },
    });
    confidenceScores.push({ rule: 'servicePeriods_vs_strDates', score: 0.1 });
  } else {
    matches.push({
      rule: 'servicePeriods_vs_strDates',
      message: 'STR encounter dates overlap DD214 service period.',
      details: { inServiceCount: inServiceEvents.length },
    });
    confidenceScores.push({ rule: 'servicePeriods_vs_strDates', score: 0.9 });
  }

  // 2) DD214 MOS <-> STR injury patterns
  const mos = normalizeText(dd214?.gradeSpecialty?.primaryMOSOrAFSCOrRating);
  const injuryBlob = normalizeText((strData?.injuries || []).map((i) => i.value).join(' | '));

  if (!mos) {
    missingEvidence.push({ rule: 'mos_vs_injuries', message: 'No DD214 MOS available.' });
    confidenceScores.push({ rule: 'mos_vs_injuries', score: 0.2 });
  } else if (!injuryBlob) {
    missingEvidence.push({ rule: 'mos_vs_injuries', message: 'No STR injuries available.' });
    confidenceScores.push({ rule: 'mos_vs_injuries', score: 0.3 });
  } else {
    // Deterministic mismatch patterns only
    const mosInjuryMismatchRules = [
      {
        rule: /^(68|HM|HS)/, // medical MOS/rating
        mismatch: /\b(flight line noise|artillery blast|weapons range acoustic trauma)\b/,
      },
      {
        rule: /^(11|12|13|19|0311|0321|0331|0341)/, // combat arms
        mismatch: /\b(office ergonomics only|sedentary desk strain only)\b/,
      },
      {
        rule: /^(88|92|2T|3P|YN|PS)/, // logistics/admin-like
        mismatch: /\b(parachute jump injury|breach blast overpressure|combat breaching injury)\b/,
      },
    ];

    const incompatible = mosInjuryMismatchRules.some((entry) => entry.rule.test(mos.toUpperCase()) && entry.mismatch.test(injuryBlob));

    if (incompatible) {
      mismatches.push({
        rule: 'mos_vs_injuries',
        message: 'Injury pattern appears inconsistent with DD214 MOS.',
        details: { mos },
      });
      confidenceScores.push({ rule: 'mos_vs_injuries', score: 0.3 });
    } else {
      matches.push({
        rule: 'mos_vs_injuries',
        message: 'No deterministic MOS-injury contradiction detected.',
        details: { mos },
      });
      confidenceScores.push({ rule: 'mos_vs_injuries', score: 0.7 });
    }
  }

  // 3) DD214 deployments <-> STR exposures
  const dd214Locations = (dd214?.decorationsAndService?.foreignServiceLocationsIfListed || []).map(normalizeText);
  const exposureBlob = normalizeText((strData?.exposureEvents || []).map((e) => e.value).join(' | '));

  if (dd214Locations.length === 0) {
    missingEvidence.push({ rule: 'deployments_vs_exposures', message: 'No DD214 deployment locations listed.' });
    confidenceScores.push({ rule: 'deployments_vs_exposures', score: 0.2 });
  } else if (!exposureBlob) {
    missingEvidence.push({ rule: 'deployments_vs_exposures', message: 'No STR exposure events found.' });
    confidenceScores.push({ rule: 'deployments_vs_exposures', score: 0.3 });
  } else {
    const overlaps = dd214Locations.filter((loc) => exposureBlob.includes(loc));
    if (overlaps.length > 0) {
      matches.push({
        rule: 'deployments_vs_exposures',
        message: 'STR exposures align with DD214 deployment locations.',
        details: { overlaps },
      });
      confidenceScores.push({ rule: 'deployments_vs_exposures', score: 0.9 });
    } else {
      mismatches.push({
        rule: 'deployments_vs_exposures',
        message: 'No deterministic overlap between DD214 locations and STR exposures.',
        details: { dd214Locations },
      });
      confidenceScores.push({ rule: 'deployments_vs_exposures', score: 0.25 });
    }
  }

  // 4) DD214 awards <-> combat indicators
  const awards = dd214?.decorationsAndService?.decorationsAndAwards || [];
  const combatIndicators = dd214?.decorationsAndService?.combatIndicatorsFromAwards || [];

  if (awards.length === 0) {
    missingEvidence.push({ rule: 'awards_vs_combat', message: 'No DD214 awards found.' });
    confidenceScores.push({ rule: 'awards_vs_combat', score: 0.2 });
  } else {
    const combatAwards = awards.filter(isCombatAward);
    if (combatAwards.length > 0 || combatIndicators.length > 0) {
      matches.push({
        rule: 'awards_vs_combat',
        message: 'Combat-indicative awards present on DD214.',
        details: { combatAwards: combatAwards.length, combatIndicators: combatIndicators.length },
      });
      confidenceScores.push({ rule: 'awards_vs_combat', score: 0.95 });
    } else {
      matches.push({
        rule: 'awards_vs_combat',
        message: 'No combat award contradiction detected.',
      });
      confidenceScores.push({ rule: 'awards_vs_combat', score: 0.6 });
    }
  }

  const result = includeInferredConnections
    ? {
      documentType: 'CrossVerification',
      schemaVersion: '2.0.0',
      matches,
      mismatches,
      missingEvidence,
      inferredConnections,
      confidenceScores,
      extractionMeta: buildExtractionMeta({
        scannerType: 'crossVerification',
        schemaVersion: '2.0.0',
        confidence: confidenceScores.length
          ? confidenceScores.reduce((sum, entry) => sum + (Number(entry?.score) || 0), 0) / confidenceScores.length
          : 0,
        fieldsPopulated: [matches, mismatches, missingEvidence, inferredConnections, confidenceScores].filter((value) => Array.isArray(value) && value.length > 0).length,
        fieldsTotal: 5,
      }),
    }
    : {
      documentType: 'CrossVerification',
      schemaVersion: '2.0.0',
      matches,
      mismatches,
      missingEvidence,
      confidenceScores,
      extractionMeta: buildExtractionMeta({
        scannerType: 'crossVerification',
        schemaVersion: '2.0.0',
        confidence: confidenceScores.length
          ? confidenceScores.reduce((sum, entry) => sum + (Number(entry?.score) || 0), 0) / confidenceScores.length
          : 0,
        fieldsPopulated: [matches, mismatches, missingEvidence, confidenceScores].filter((value) => Array.isArray(value) && value.length > 0).length,
        fieldsTotal: 4,
      }),
    };

  const schema = validateCrossVerificationSchema(result);
  result.extractionMeta.schemaValid = schema.valid;
  result.extractionMeta.schemaErrors = schema.errors;

  return result;
}
