import { validateDiagnosticCodes } from './diagnosticCodeValidator.js';
import { lookupCfrCriteria } from './cfrCriteriaLookup.js';

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toPercent(value) {
  const parsed = Number(String(value ?? '').replace(/[^\d]/g, ''));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return parsed;
}

function getServiceConnectedConditions(scanResult) {
  const fromNested = toArray(scanResult?.serviceConnected?.conditions).map((item) => ({
    conditionName: item?.condition || item?.name || null,
    diagnosticCode: item?.diagnosticCode || null,
    evaluationPercent: toPercent(item?.rating ?? item?.percent ?? item?.evaluationPercent),
    effectiveDate: item?.effectiveDate || null,
    disposition: 'granted',
  }));

  const fromLegacy = toArray(scanResult?.service_connected).map((item) => ({
    conditionName: item?.condition || item?.name || null,
    diagnosticCode: item?.diagnosticCode || null,
    evaluationPercent: toPercent(item?.rating ?? item?.percent ?? item?.evaluationPercent),
    effectiveDate: item?.effective_date || item?.effectiveDate || null,
    disposition: 'granted',
  }));

  return [...fromNested, ...fromLegacy].filter((item) => item.conditionName);
}

function getDeniedConditions(scanResult) {
  const fromNested = toArray(scanResult?.denied?.conditions).map((item) => ({
    conditionName: item?.condition || item?.name || null,
    denialReasons: toArray(item?.reasons || item?.denialReasons),
    disposition: 'denied',
  }));

  const fromLegacy = toArray(scanResult?.deniedConditions).map((item) => ({
    conditionName: item?.condition || item?.name || null,
    denialReasons: toArray(item?.reasons || item?.denialReasons),
    disposition: 'denied',
  }));

  return [...fromNested, ...fromLegacy].filter((item) => item.conditionName);
}

function findEvidenceSnippet(text, conditionName, markers = []) {
  const lines = String(text || '').split(/\r?\n/);
  const lowered = String(conditionName || '').toLowerCase();
  const markerList = markers.map((m) => String(m).toLowerCase());

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalized = line.toLowerCase();
    if (!lowered || !normalized.includes(lowered)) continue;

    const hasMarker = markerList.length === 0 || markerList.some((marker) => normalized.includes(marker));
    if (!hasMarker) continue;

    return {
      lineNumber: index + 1,
      snippet: line.trim(),
    };
  }

  return {
    lineNumber: null,
    snippet: null,
  };
}

function buildTextualIndicators(text) {
  const normalized = String(text || '');
  const indicators = {
    reasonsAndBasesSection: /reasons\s+(?:for\s+)?decision|reasons\s+and\s+bases/i.test(normalized),
    favorableFindingsSection: /favorable\s+findings/i.test(normalized),
    smcIndicators: [],
  };

  const smcPattern = /(special\s+monthly\s+compensation|\bsmc\b|38\s*c\.?f\.?r\.?\s*3\.350|38\s*c\.?f\.?r\.?\s*3\.352)/gi;
  let match;
  while ((match = smcPattern.exec(normalized)) !== null) {
    indicators.smcIndicators.push({
      phrase: match[0],
      index: match.index,
    });
  }

  return indicators;
}

export async function buildRatingDecisionAnalysis(rawText, scanResult = {}) {
  const grantedConditions = getServiceConnectedConditions(scanResult);
  const deniedConditions = getDeniedConditions(scanResult);
  const textualIndicators = buildTextualIndicators(rawText);

  const grantedWithEvidence = grantedConditions.map((item) => {
    const evidence = findEvidenceSnippet(rawText, item.conditionName, ['grant', 'service connection', 'evaluation', 'percent']);
    return {
      ...item,
      textualEvidence: evidence,
      confidence: evidence.snippet ? 0.92 : 0.6,
      note: evidence.snippet
        ? 'Condition extracted from explicit rating-decision language.'
        : 'Condition found in parsed structure, but direct text snippet was not located.',
    };
  });

  const deniedWithEvidence = deniedConditions.map((item) => {
    const evidence = findEvidenceSnippet(rawText, item.conditionName, ['denied', 'not', 'no evidence']);
    return {
      ...item,
      textualEvidence: evidence,
      confidence: evidence.snippet ? 0.9 : 0.58,
      note: evidence.snippet
        ? 'Denial extracted from explicit denial language.'
        : 'Denial found in parsed structure, but direct text snippet was not located.',
    };
  });

  const diagnosticCodeValidation = await validateDiagnosticCodes(grantedWithEvidence);
  const cfrCriteriaLookup = await lookupCfrCriteria(grantedWithEvidence);

  return {
    schemaVersion: '1.0.0',
    extractionMode: 'deterministic-explicit-only',
    grantedConditions: grantedWithEvidence,
    deniedConditions: deniedWithEvidence,
    textualIndicators,
    diagnosticCodeValidation,
    cfrCriteriaLookup,
    notes: 'For human review only. Text extraction does not provide legal conclusions.',
  };
}
