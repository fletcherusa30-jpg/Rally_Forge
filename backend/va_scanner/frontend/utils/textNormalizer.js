/**
 * Text Normalization Layer for BenefitScan
 * Converts raw PDF/text into clean, parseable format
 */

/**
 * V2 Text Normalization for advanced preprocessing per .copilot-instructions.md
 * Handles UTF-8 issues, OCR artifacts, deterministic text cleaning.
 * @param {string} rawText - Raw text from PDF or manual entry
 * @returns {string} Normalized text
 */
export function normalizeText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }

  let normalized = rawText;

  // Step 1: Convert common PDF encoding issues (deterministic)
  normalized = normalized
    .replace(/\u00a0/g, ' ')           // Non-breaking space
    .replace(/\u2013/g, '-')           // En dash
    .replace(/\u2014/g, '-')           // Em dash
    .replace(/\u2018|\u2019/g, "'")    // Smart quotes
    .replace(/\u201c|\u201d/g, '"')    // Smart double quotes
    .replace(/\u2026/g, '...')         // Ellipsis
    .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Zero-width chars

  // Step 2: Fix hyphenated words at line breaks
  // "post-trau-\nmatic" -> "post-traumatic"
  normalized = normalized.replace(/(\w)-\s*\n\s*(\w)/g, '$1$2');

  // Step 3: Remove excessive line breaks but preserve paragraph structure
  normalized = normalized
    .replace(/\r\n/g, '\n')            // Normalize line endings
    .replace(/\n{3,}/g, '\n\n')        // Max 2 consecutive newlines

  // Step 4: Standardize spacing
  normalized = normalized
    .replace(/[ \t]+/g, ' ')           // Multiple spaces to single space
    .replace(/ \n/g, '\n')             // Remove trailing spaces before newline
    .replace(/\n /g, '\n')             // Remove leading spaces after newline

  // Step 5: Convert bullet points and list markers to consistent format
  normalized = normalized
    .replace(/^[\u2022\u2023\u25E6\u2043\u2219]\s*/gm, '• ')  // Unicode bullets
    .replace(/^[○◦▪▫]\s*/gm, '• ')                             // Other bullets
    .replace(/^[-*]\s+/gm, '• ')                                // Dash/asterisk bullets
    .replace(/^\d+\.\s+/gm, (match) => match)                  // Keep numbered lists

  // Step 6: Normalize common VA abbreviations for consistent matching
  const abbreviations = {
    'Post-Traumatic Stress Disorder': 'PTSD',
    'post-traumatic stress disorder': 'PTSD',
    'Degenerative Disc Disease': 'DDD',
    'degenerative disc disease': 'DDD',
    'Traumatic Brain Injury': 'TBI',
    'traumatic brain injury': 'TBI',
    'Erectile Dysfunction': 'ED',
    'erectile dysfunction': 'ED'
  };

  // Step 7: Fix common OCR errors
  normalized = normalized
    .replace(/\bl\s*0\s*(?=\d)/g, '10')     // "l 0 %" -> "10%"
    .replace(/(?<=\d)\s*o\s*(?=%)/g, '0')  // "7 o %" -> "70%"

  // Step 8: Standardize percentage format
  normalized = normalized
    .replace(/(\d+)\s*percent/gi, '$1%')    // "70 percent" -> "70%"
    .replace(/(\d+)\s*pct\.?/gi, '$1%')     // "70 pct" -> "70%"

  // Step 9: Normalize date formats to consistent format
  // Keep dates as-is but standardize spacing
  normalized = normalized
    .replace(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/g, '$1/$2/$3');

  // Step 10: Normalize common VA decision phrases
  normalized = normalized
    .replace(/service\s+connection/gi, 'service connection')
    .replace(/service[-\s]connected/gi, 'service-connected')
    .replace(/is\s+granted/gi, 'is granted')
    .replace(/is\s+denied/gi, 'is denied');

  // Step 11: Remove page numbers and headers/footers
  normalized = normalized
    .replace(/^Page\s+\d+\s+of\s+\d+\s*$/gim, '')
    .replace(/^[\d\s]+$/gm, '')  // Lines with only numbers

  // Step 12: Clean up excessive whitespace after all transformations
  normalized = normalized
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  return normalized;
}

/**
 * Extract clean sentences from normalized text
 * @param {string} normalizedText - Text from normalizeText()
 * @returns {Array<string>} Array of clean sentences
 */
export function extractSentences(normalizedText) {
  if (!normalizedText) return [];

  // Split on sentence boundaries but keep context
  const sentences = normalizedText
    .split(/(?<=[.!?])\s+(?=[A-Z])/)  // Split on period/!/? followed by capital
    .map(s => s.trim())
    .filter(s => s.length > 10);  // Filter out very short fragments

  return sentences;
}

/**
 * Extract clean paragraphs from normalized text
 * @param {string} normalizedText - Text from normalizeText()
 * @returns {Array<string>} Array of paragraphs
 */
export function extractParagraphs(normalizedText) {
  if (!normalizedText) return [];

  return normalizedText
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 20);
}

/**
 * Find section by header in normalized text
 * @param {string} normalizedText - Text from normalizeText()
 * @param {string|RegExp} headerPattern - Pattern to match section header
 * @returns {string} Section text or empty string
 */
export function extractSection(normalizedText, headerPattern) {
  if (!normalizedText) return '';

  const pattern = typeof headerPattern === 'string'
    ? new RegExp(headerPattern, 'i')
    : headerPattern;

  // Find section start
  const lines = normalizedText.split('\n');
  let sectionStart = -1;
  let sectionEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      sectionStart = i;
      break;
    }
  }

  if (sectionStart === -1) return '';

  // Find next major section header (usually all caps or numbered)
  for (let i = sectionStart + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    // Next section is usually all caps, numbered, or starts with common headers
    if (
      line.length > 5 &&
      (
        /^[A-Z\s]{5,}:?$/.test(line) ||  // ALL CAPS LINE
        /^[IVX]+\.\s+[A-Z]/.test(line) || // Roman numeral section
        /^\d+\.\s+[A-Z]/.test(line) ||    // Numbered section
        /^(REASONS?|EVIDENCE|CONCLUSION|DECISION|FINDINGS?):?/i.test(line)
      )
    ) {
      sectionEnd = i;
      break;
    }
  }

  return lines.slice(sectionStart, sectionEnd).join('\n').trim();
}

/**
 * Clean condition name (remove noise)
 * @param {string} condition - Raw condition name
 * @returns {string} Cleaned condition name
 */
export function cleanConditionName(condition) {
  if (!condition) return '';

  let cleaned = condition
    // Remove everything before "service connection for"
    .replace(/^.*?\bservice\s+connection\s+for\s+/i, '')
    .replace(/^.*?\bentitlement\s+to\s+service\s+connection\s+for\s+/i, '')
    // Remove common article prefixes only
    .replace(/^(the|a|an)\s+/i, '')
    // Remove "is granted/denied/evaluated/rated" at end
    .replace(/\s+(?:is\s+)?(?:granted|denied|evaluated|rated).*$/i, '')
    // Remove percentages after condition name
    .replace(/\s+(?:at|with|of)\s+\d{1,3}\s*(?:%|percent).*$/i, '')
    // Remove effective date clauses
    .replace(/\s+effective\s+.*/i, '')
    // Remove trailing punctuation
    .replace(/[,;:]+$/, '')
    // Remove leading numbers like "1."
    .replace(/^\d+\.\s*/, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
  
  // If cleaning resulted in empty or too short, try again with minimal cleaning
  if (!cleaned || cleaned.length < 3) {
    cleaned = condition
      .replace(/\s+(?:is\s+)?(?:granted|denied).*$/i, '')
      .replace(/\s+at\s+\d{1,3}\s*%.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  return cleaned;
}

/**
 * Parse date from various formats
 * @param {string} dateString - Date in various formats
 * @returns {Date|null} Parsed date or null
 */
export function parseDate(dateString) {
  if (!dateString) return null;

  // Try various formats
  const patterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,           // MM/DD/YYYY
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,           // Month DD, YYYY
    /(\d{1,2})\s+(\w+)\s+(\d{4})/,             // DD Month YYYY
    /(\d{4})-(\d{2})-(\d{2})/                   // YYYY-MM-DD
  ];

  for (const pattern of patterns) {
    const match = dateString.match(pattern);
    if (match) {
      try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
          return date;
        }
      } catch (e) {
        continue;
      }
    }
  }

  return null;
}

/**
 * Extract percentage from text
 * @param {string} text - Text containing percentage
 * @returns {number|null} Percentage value or null
 */
export function extractPercentage(text) {
  if (!text) return null;

  const match = text.match(/(\d{1,3})\s*%/);
  if (match) {
    const pct = parseInt(match[1]);
    return (pct >= 0 && pct <= 100) ? pct : null;
  }

  return null;
}

