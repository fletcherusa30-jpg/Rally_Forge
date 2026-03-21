const SMC_RANK_ORDER = ['T', 'S', 'R2', 'R1', 'O', 'N½', 'N', 'M½', 'M', 'L½', 'L', 'K'];

export function extractSmcCodesFromText(value) {
  const text = String(value || '').trim();
  if (!text) return [];

  const codes = new Set();

  const explicitMatches = text.matchAll(/\bSMC[-\s]?(R1|R2|L½|M½|N½|[KLMNOST])\b/gi);
  for (const match of explicitMatches) {
    codes.add(match[1].toUpperCase());
  }

  const levelListMatches = text.matchAll(/(?:^|[,;\s])(R1|R2|L½|M½|N½|[KLMNOST])\s*[-:]/gi);
  for (const match of levelListMatches) {
    codes.add(match[1].toUpperCase());
  }

  return Array.from(codes);
}

export function getHighestSmcCode(scanData = {}) {
  const levelCandidates = new Set();

  const detectedLevels = Array.isArray(scanData?.smc?.detectedLevels) ? scanData.smc.detectedLevels : [];
  detectedLevels.forEach((item) => {
    const level = String(item?.level || '').toUpperCase();
    if (level) {
      levelCandidates.add(level);
    }
  });

  const explicitSmc = Array.isArray(scanData?.smc?.explicit) ? scanData.smc.explicit : [];
  explicitSmc.forEach((entry) => {
    const parsedCodes = extractSmcCodesFromText(entry);
    parsedCodes.forEach((code) => levelCandidates.add(code));
  });

  for (const code of SMC_RANK_ORDER) {
    if (levelCandidates.has(code)) {
      return code;
    }
  }

  return null;
}

export function getAncillaryFlags(scanData = {}) {
  const ancillaryBenefits = Array.isArray(scanData?.ancillaryBenefits) ? scanData.ancillaryBenefits : [];

  let aidAndAttendance = false;
  let housebound = false;

  ancillaryBenefits.forEach((benefit) => {
    const status = String(benefit?.status || '').toLowerCase();
    const name = String(benefit?.benefit || benefit?.shortName || '').toLowerCase();

    if (status !== 'granted') {
      return;
    }

    if (name.includes('aid and attendance')) {
      aidAndAttendance = true;
    }
    if (name.includes('housebound')) {
      housebound = true;
    }
  });

  return { aidAndAttendance, housebound };
}

export function determineParserProfile({ scanType, extractedText, looksLikeRatingDecisionNarrative }) {
  const normalizedScanType = String(scanType || '').trim().toLowerCase();
  if (normalizedScanType === 'ratingdecision') {
    return 'va-rating-decision';
  }

  if (typeof looksLikeRatingDecisionNarrative === 'function' && looksLikeRatingDecisionNarrative(extractedText)) {
    return 'va-rating-decision';
  }

  return 'generic-va-document';
}

export function buildExtractionQuality({ scanData, dependentData, compensation, parserProfile }) {
  const serviceConnectedCount = Array.isArray(scanData?.serviceConnected) ? scanData.serviceConnected.length : 0;
  const deniedCount = Array.isArray(scanData?.denied) ? scanData.denied.length : 0;
  const smcCount = Array.isArray(scanData?.smc?.detectedLevels) ? scanData.smc.detectedLevels.length : 0;
  const dependentCount = Array.isArray(dependentData?.dependents) ? dependentData.dependents.length : 0;
  const hasRating = Number(scanData?.ratingCalculation?.calculatedCombinedRating || 0) >= 0;

  const fieldConfidence = {
    parserProfile,
    rating: hasRating ? 0.92 : 0.2,
    serviceConnected: serviceConnectedCount > 0 ? 0.9 : 0.45,
    denied: deniedCount > 0 ? 0.88 : 0.55,
    smc: smcCount > 0 ? 0.93 : 0.55,
    dependents: dependentCount > 0 ? 0.85 : 0.6,
    compensation: compensation ? 0.9 : 0.45,
  };

  const values = Object.values(fieldConfidence).filter((value) => typeof value === 'number');
  const overallConfidence = values.length
    ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100)
    : 0;

  const warnings = [];
  const signals = [];
  if ((dependentData?.validationWarnings || []).length > 0) {
    warnings.push('Dependent extraction produced warnings.');
    signals.push('dependents:validation-warnings');
  }
  if (serviceConnectedCount === 0 && deniedCount === 0) {
    warnings.push('No conditions extracted from document text.');
    signals.push('conditions:none-extracted');
  }
  if (!compensation) {
    warnings.push('Compensation estimate unavailable for this scan.');
    signals.push('compensation:unavailable');
  }
  if (parserProfile === 'generic-va-document') {
    signals.push('classification:generic-profile');
  } else {
    signals.push(`classification:${parserProfile}`);
  }
  if (serviceConnectedCount > 0) {
    signals.push('conditions:service-connected-found');
  }
  if (deniedCount > 0) {
    signals.push('conditions:denied-found');
  }

  const requiresManualReview = overallConfidence < 78 || warnings.length > 0;
  const reviewReason = requiresManualReview
    ? (warnings[0] || 'Low confidence or extraction warnings detected.')
    : 'Confidence acceptable for auto-display.';

  return {
    confidence: {
      overallConfidence,
      fieldConfidence,
    },
    diagnostics: {
      signals,
      warnings,
      metrics: {
        serviceConnectedCount,
        deniedCount,
        smcCount,
        dependentCount,
      },
    },
    review: {
      requiresManualReview,
      reason: reviewReason,
      warnings,
    },
  };
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findEvidenceSpan(text, matcher, field, label) {
  const normalizedText = String(text || '');
  if (!normalizedText) return null;

  let match = null;
  if (typeof matcher === 'string') {
    const index = normalizedText.toLowerCase().indexOf(matcher.toLowerCase());
    if (index >= 0) {
      match = { index, value: normalizedText.slice(index, index + matcher.length) };
    }
  } else if (matcher instanceof RegExp) {
    const result = normalizedText.match(matcher);
    if (result && typeof result.index === 'number') {
      match = { index: result.index, value: result[0] };
    }
  }

  if (!match) return null;

  const snippetStart = Math.max(0, match.index - 60);
  const snippetEnd = Math.min(normalizedText.length, match.index + match.value.length + 100);
  const snippet = normalizedText.slice(snippetStart, snippetEnd).replace(/\s+/g, ' ').trim();
  const line = normalizedText.slice(0, match.index).split(/\r?\n/).length;

  return {
    field,
    label,
    line,
    start: match.index,
    end: match.index + match.value.length,
    snippet,
  };
}

export function buildEvidenceSpans({ text, scanData, dependentData }) {
  const spans = [];

  const ratingValue = Number(scanData?.ratingCalculation?.calculatedCombinedRating || 0);
  if (ratingValue >= 0) {
    const ratingSpan = findEvidenceSpan(
      text,
      new RegExp(`combined\\s+rating[^\\n]{0,120}${ratingValue}\\s*%|${ratingValue}\\s*%[^\\n]{0,120}combined\\s+rating`, 'i'),
      'rating',
      `Combined rating ${ratingValue}%`
    );
    if (ratingSpan) spans.push(ratingSpan);
  }

  const serviceConnected = Array.isArray(scanData?.serviceConnected) ? scanData.serviceConnected.slice(0, 8) : [];
  serviceConnected.forEach((item) => {
    const condition = String(item?.condition || '').trim();
    if (!condition) return;
    const span = findEvidenceSpan(text, new RegExp(escapeRegex(condition), 'i'), 'serviceConnected', condition);
    if (span) spans.push(span);
  });

  const denied = Array.isArray(scanData?.denied) ? scanData.denied.slice(0, 8) : [];
  denied.forEach((item) => {
    const condition = String(item?.condition || '').trim();
    if (!condition) return;
    const span = findEvidenceSpan(text, new RegExp(escapeRegex(condition), 'i'), 'denied', condition);
    if (span) spans.push(span);
  });

  const detectedSmc = Array.isArray(scanData?.smc?.detectedLevels) ? scanData.smc.detectedLevels : [];
  detectedSmc.forEach((item) => {
    const level = String(item?.level || '').trim();
    if (!level) return;
    const span = findEvidenceSpan(
      text,
      new RegExp(`special\\s+monthly\\s+compensation[^\\n]{0,140}|SMC[-\\s]?${escapeRegex(level)}`, 'i'),
      'smc',
      `SMC-${level}`
    );
    if (span) spans.push(span);
  });

  const dependents = Array.isArray(dependentData?.dependents) ? dependentData.dependents.slice(0, 8) : [];
  dependents.forEach((item) => {
    const name = String(item?.name || '').trim();
    if (!name) return;
    const span = findEvidenceSpan(text, new RegExp(`\\b${escapeRegex(name)}\\b`, 'i'), 'dependent', name);
    if (span) spans.push(span);
  });

  return spans;
}
