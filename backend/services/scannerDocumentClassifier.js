const normalizeScanInput = (value) =>
  String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();

const countMatches = (text, pattern) => {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
};

export const classifyScannerDocument = (rawText) => {
  const normalizedText = normalizeScanInput(rawText);
  const lowered = normalizedText.toLowerCase();

  if (!lowered) {
    return {
      normalizedText,
      isRatingDecision: false,
      reason: "empty"
    };
  }

  const ratingDecisionCues = [
    /\brating\s+decision\b/i,
    /\bservice\s+connection\s+for\b/i,
    /\bevaluation\s+of\s+\d{1,3}\s*(?:%|percent)\b/i,
    /\breasons?\s+for\s+decision\b/i,
    /\bcombined\s+rating\s+(?:evaluation\s+)?is\s+\d{1,3}\s*%/i,
    /\beffective\s+[a-z]+\s+\d{1,2},\s*\d{4}\b/i,
    /\bservice\s+connection\s+for\s+.+?\s+is\s+denied\b/i
  ];

  const decisionLetterCues = [
    /\bwe\s+made\s+a\s+decision\s+on\s+your\s+va\s+benefits\b/i,
    /\bdear\s+(?:mr|ms|mrs)\.?\b/i,
    /\byour\s+combined\s+rating\s+(?:evaluation\s+)?is\s+\d{1,3}\s*%\b/i,
    /\brating\s+decision\s+date\b/i,
    /\bfile\s+number\s*:/i,
    /\bregional\s+office\s+director\b/i
  ];

  const authorityDocCues = [
    /\btitle\s+38\s+of\s+the\s+code\s+of\s+federal\s+regulations\b/i,
    /\bpart\s+4\s+schedule\s+for\s+rating\s+disabilities\b/i,
    /\bpart\s+[0-9]{1,2}\s*[—-]/i,
    /\bc\.?f\.?r\.?\s*§/i,
    /\bappendix\b/i,
    /\bsubpart\b/i,
    /\bauthority\s*:\s*38\s+u\.?s\.?c\.?/i
  ];

  const decisionCueScore = ratingDecisionCues.reduce(
    (score, pattern) => score + (pattern.test(normalizedText) ? 1 : 0),
    0
  );

  const authorityCueScore = authorityDocCues.reduce(
    (score, pattern) => score + (pattern.test(normalizedText) ? 1 : 0),
    0
  );

  const decisionLetterCueScore = decisionLetterCues.reduce(
    (score, pattern) => score + (pattern.test(normalizedText) ? 1 : 0),
    0
  );

  const serviceConnectionMentions = countMatches(
    normalizedText,
    /\bservice\s+connection\s+for\b/gi
  );
  const deniedMentions = countMatches(normalizedText, /\bis\s+denied\b/gi);
  const grantedMentions = countMatches(normalizedText, /\bis\s+granted\b/gi);
  const cfrSectionMentions = countMatches(
    normalizedText,
    /(?:^|\s)§\s*[0-9]+\.[0-9A-Za-z\-]+/gim
  );
  const partHeaderMentions = countMatches(normalizedText, /\bPART\s+[0-9]{1,2}\b/gim);
  const subpartHeaderMentions = countMatches(normalizedText, /\bSubpart\s+[A-Z0-9]+\b/gim);
  const hasTitle38CfrPhrase = /\btitle\s+38\s+of\s+the\s+code\s+of\s+federal\s+regulations\b/i.test(normalizedText);

  const looksLikeDecisionNarrative =
    decisionCueScore >= 2 &&
    serviceConnectionMentions >= 2 &&
    (deniedMentions >= 1 || grantedMentions >= 1);

  const hasDecisionLetterStructure = decisionLetterCueScore >= 1;

  const hasStrongAuthorityStructure =
    (partHeaderMentions >= 2 && subpartHeaderMentions >= 1) ||
    (hasTitle38CfrPhrase && cfrSectionMentions >= 3);

  const looksLikeAuthorityDocument =
    hasStrongAuthorityStructure ||
    (hasTitle38CfrPhrase && authorityCueScore >= 2 && !hasDecisionLetterStructure);

  const isRatingDecision =
    looksLikeDecisionNarrative && (!looksLikeAuthorityDocument || hasDecisionLetterStructure);

  return {
    normalizedText,
    isRatingDecision,
    reason: looksLikeAuthorityDocument
      ? "authority_document"
      : isRatingDecision
      ? "rating_decision"
      : "unknown_document",
    diagnostics: {
      decisionCueScore,
      decisionLetterCueScore,
      authorityCueScore,
      serviceConnectionMentions,
      deniedMentions,
      grantedMentions,
      cfrSectionMentions,
      partHeaderMentions,
      subpartHeaderMentions,
      hasTitle38CfrPhrase,
      hasDecisionLetterStructure
    }
  };
};
