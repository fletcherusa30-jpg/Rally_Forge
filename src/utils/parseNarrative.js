/**
 * Parse VA rating narrative text
 * @param {string} text - Raw narrative text
 * @returns {Object} Parsed narrative data
 */
export function parseNarrative(text) {
  return {
    serviceConnected: extractServiceConnected(text),
    denied: extractDenied(text),
    rawText: text
  };
}

function extractServiceConnected(text) {
  const scPattern = /service connection for ([^\.]+) is granted.*?(\d+)\s*percent/gi;
  const matches = [];
  let match;

  while ((match = scPattern.exec(text)) !== null) {
    matches.push({
      condition: match[1].trim(),
      percentage: parseInt(match[2]),
      evidenceSource: 'VA Rating Narrative'
    });
  }

  return matches;
}

function extractDenied(text) {
  const deniedPattern = /service connection for ([^\.]+) is denied[^\.]*\.([^\.]+)/gi;
  const matches = [];
  let match;

  while ((match = deniedPattern.exec(text)) !== null) {
    matches.push({
      condition: match[1].trim(),
      reason: match[2].trim(),
      evidenceSource: 'VA Rating Narrative'
    });
  }

  return matches;
}
