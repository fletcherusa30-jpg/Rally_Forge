/**
 * Evidence List Extraction
 * Extracts all evidence items cited in the decision
 */

/**
 * Extract evidence list from normalized text
 * @param {string} normalizedText - Normalized VA decision text
 * @returns {Array<Object>} Evidence items
 */
export function extractEvidence(normalizedText) {
  if (!normalizedText) return [];

  const evidence = [];
  const seen = new Set();

  // Pattern 1: "EVIDENCE CONSIDERED" or "The following evidence was considered" section
  const evidenceSectionPatterns = [
    /(?:evidence\s+considered|evidence\s+reviewed)[\s:]*\n([\s\S]+?)(?=\n(?:REASONS?|CONCLUSION|DECISION|RIGHTS|$))/i,
    /(?:the\s+)?following\s+evidence\s+(?:was\s+)?considered[\s\S]*?:\s*([\s\S]+?)(?=\n(?:REASONS?|CONCLUSION|DECISION|RIGHTS|$))/i,
    /in\s+reaching\s+this\s+decision[,\s]*(?:we\s+)?(?:considered|reviewed)[\s:]*\n([\s\S]+?)(?=\n\n|reasons?\s+for|conclusion|decision|$)/i
  ];

  for (const pattern of evidenceSectionPatterns) {
    const sectionMatch = normalizedText.match(pattern);
    if (sectionMatch) {
      const evidenceText = sectionMatch[1];
      const evidenceItems = parseEvidenceItems(evidenceText, evidence, seen);
      if (evidenceItems.length > 0) {
        return evidenceItems;
      }
    }
  }

  // Pattern 2: Look for evidence markers throughout text
  const evidenceMarkers = [
    /(?:we\s+)?reviewed[\s:]*(.+?)(?:conclusion|decision|reason|$)/gi,
    /(?:we\s+)?considered[\s:]*(.+?)(?:conclusion|decision|reason|$)/gi,
    /(?:we\s+)?examined[\s:]*(.+?)(?:conclusion|decision|reason|$)/gi
  ];

  evidenceMarkers.forEach(pattern => {
    let match;
    while ((match = pattern.exec(normalizedText)) !== null) {
      const evidenceText = match[1];
      parseEvidenceItems(evidenceText, evidence, seen);
    }
  });

  // If no specific evidence section found, extract general evidence mentions
  if (evidence.length === 0) {
    extractGeneralEvidence(normalizedText, evidence, seen);
  }

  return evidence;
}

/**
 * Parse individual evidence items from text
 * @param {string} evidenceText - Text containing evidence items
 * @param {Array<Object>} evidenceArray - Array to add to
 * @param {Set<string>} seen - Set to track duplicates
 * @returns {Array<Object>} Updated evidence array
 */
function parseEvidenceItems(evidenceText, evidenceArray = [], seen = new Set()) {
  if (!evidenceText) return evidenceArray;

  // Split evidence items by common markers (bullets, newlines with dashes)
  const lines = evidenceText
    .split(/[\n]/)
    .map(l => l.trim())
    .map(l => l.replace(/^[-\u2022*]\s*/, ''))  // Remove leading bullets
    .filter(l => l.length > 10);  // Minimum meaningful length

  lines.forEach((line, index) => {
    // Try to parse as evidence item
    const item = parseEvidenceItem(line);
    
    if (item && item.description && item.description.length > 10) {
      // Check for duplicates
      const key = item.description.toLowerCase().substring(0, 100);
      if (!seen.has(key)) {
        seen.add(key);
        item.sequenceNumber = evidenceArray.length + 1;
        evidenceArray.push(item);
        console.log(`[Evidence] ${item.sequenceNumber}. ${item.type}: ${item.description.substring(0, 80)}...`);
      }
    }
  });

  return evidenceArray;
}

/**
 * Parse a single evidence item
 * @param {string} itemText - Text describing evidence
 * @returns {Object|null} Parsed evidence item
 */
function parseEvidenceItem(itemText) {
  if (!itemText || itemText.length < 5) return null;

  // Determine evidence type
  const typeMap = {
    'Service Treatment Records': [
      /service\s+treatment\s+records?/i,
      /service\s+medical\s+records?/i,
      /service\s+records?/i
    ],
    'VA Medical Records': [
      /va\s+(?:medical\s+)?records?/i,
      /va\s+treatment\s+records?/i,
      /va\s+examination\/c.?p/i,
      /va\s+c[&.]?p.*?examination/i
    ],
    'Private Medical Records': [
      /private\s+(?:medical\s+)?records?/i,
      /civilian\s+medical\s+records?/i,
      /provider\s+records?/i,
      /physician\s+records?/i
    ],
    'Medical Opinion': [
      /(?:competent\s+)?medical\s+opinion/i,
      /physician.*?opinion/i,
      /doctor.*?opinion/i,
      /medical\s+specialist/i,
      /medical\s+evidence/i
    ],
    'VA Examination (C&P)': [
      /(?:va\s+)?c.?p.*?examination/i,
      /compensation\s+(?:and\s+)?pension\s+examination/i,
      /va\s+examination/i,
      /va.*?exam/i
    ],
    'Lay Statement': [
      /lay\s+(?:evidence|statement)/i,
      /buddy\s+statement/i,
      /personal\s+statement/i,
      /statement\s+in\s+support/i,
      /veteran.*?statement/i
    ],
    'Clinical Records': [
      /clinical\s+(?:records?|notes?)/i,
      /progress\s+notes?/i,
      /medical\s+notes?/i,
      /hospital\s+records?/i
    ],
    'Nexus Evidence': [
      /nexus/i,
      /causal\s+relationship/i,
      /etiology/i,
      /relationship.*?service/i
    ],
    'Regulations/Schedule': [
      /38\s+cfr/i,
      /38\s+u\.?s\.?c/i,
      /rating\s+schedule/i,
      /cva\s+(?:rating\s+)?table/i
    ],
    'Other': [
      /.+/  // Catch-all
    ]
  };

  // Determine type
  let evidenceType = 'Other';
  for (const [type, patterns] of Object.entries(typeMap)) {
    for (const pattern of patterns) {
      if (pattern.test(itemText)) {
        evidenceType = type;
        break;
      }
    }
    if (evidenceType !== 'Other') break;
  }

  // Extract dates if present
  const dateMatch = itemText.match(/(\d{1,2}\/\d{1,2}\/\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})/);
  const date = dateMatch ? dateMatch[1] : null;

  // Extract document specifics
  const docNumberMatch = itemText.match(/(?:document|record)\s+(?:#|number)[\s:]*([A-Z0-9-]+)/i);
  const documentNumber = docNumberMatch ? docNumberMatch[1] : null;

  // Extract facility/provider
  const facilityMatch = itemText.match(/(?:from|at)\s+([A-Za-z\s&,]+?)(?:\s+dated?|\s+dated?|$)/i);
  const facility = facilityMatch ? facilityMatch[1].trim() : null;

  return {
    type: evidenceType,
    description: itemText.substring(0, 500),  // Truncate to 500 chars
    date: date,
    facility: facility,
    documentNumber: documentNumber,
    source: 'VA Rating Decision'
  };
}

/**
 * Extract general evidence mentions throughout text
 * @param {string} normalizedText - Full text
 * @param {Array<Object>} evidenceArray - Array to add to
 * @param {Set<string>} seen - Set to track duplicates
 */
function extractGeneralEvidence(normalizedText, evidenceArray, seen) {
  // Common evidence phrases
  const evidencePatterns = [
    { pattern: /service\s+treatment\s+records?/gi, type: 'Service Treatment Records' },
    { pattern: /va\s+medical\s+records?/gi, type: 'VA Medical Records' },
    { pattern: /private\s+medical\s+records?/gi, type: 'Private Medical Records' },
    { pattern: /(?:competent\s+)?medical\s+opinion/gi, type: 'Medical Opinion' },
    { pattern: /compensation\s+and\s+pension\s+examination/gi, type: 'VA Examination (C&P)' },
    { pattern: /lay\s+(?:evidence|statement)/gi, type: 'Lay Statement' },
    { pattern: /buddy\s+statement/gi, type: 'Lay Statement' },
    { pattern: /clinical\s+notes?/gi, type: 'Clinical Records' },
    { pattern: /hospital\s+records?/gi, type: 'Clinical Records' },
    { pattern: /nexus/gi, type: 'Nexus Evidence' },
    { pattern: /38\s+cfr/gi, type: 'Regulations/Schedule' },
    { pattern: /rating\s+schedule/gi, type: 'Regulations/Schedule' }
  ];

  evidencePatterns.forEach(({ pattern, type }) => {
    let match;
    while ((match = pattern.exec(normalizedText)) !== null) {
      const description = match[0];
      const key = description.toLowerCase();

      if (!seen.has(key)) {
        seen.add(key);
        evidenceArray.push({
          type,
          description,
          source: 'VA Rating Decision'
        });
        console.log(`[Evidence] ${type}: ${description}`);
      }
    }
  });
}

/**
 * Group evidence by type
 * @param {Array<Object>} evidence - Evidence items from extractEvidence
 * @returns {Object} Evidence grouped by type
 */
export function groupEvidenceByType(evidence) {
  if (!Array.isArray(evidence)) return {};

  const grouped = {};

  evidence.forEach(item => {
    const type = item.type || 'Other';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(item);
  });

  return grouped;
}

/**
 * Get evidence summary
 * @param {Array<Object>} evidence - Evidence items
 * @returns {Object} Summary statistics
 */
export function getEvidenceSummary(evidence) {
  if (!Array.isArray(evidence)) {
    return {
      totalItems: 0,
      byType: {}
    };
  }

  const byType = {};
  evidence.forEach(item => {
    const type = item.type || 'Other';
    byType[type] = (byType[type] || 0) + 1;
  });

  return {
    totalItems: evidence.length,
    byType
  };
}

