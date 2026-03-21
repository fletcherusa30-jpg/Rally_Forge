/**
 * AI-Assisted Date Parser for VA Rating Decisions
 * Handles unclear, fragmented, or non-standard date formats in PDFs
 * Uses pattern matching and heuristics to extract decision dates
 */

import { normalizeDateFormat } from './dateFormatter.js';

/**
 * Months in various formats
 */
const MONTH_PATTERNS = {
  january: { month: 0, patterns: ['jan', 'january', '01', '1'] },
  february: { month: 1, patterns: ['feb', 'february', '02', '2'] },
  march: { month: 2, patterns: ['mar', 'march', '03', '3'] },
  april: { month: 3, patterns: ['apr', 'april', '04', '4'] },
  may: { month: 4, patterns: ['may', '05', '5'] },
  june: { month: 5, patterns: ['jun', 'june', '06', '6'] },
  july: { month: 6, patterns: ['jul', 'july', '07', '7'] },
  august: { month: 7, patterns: ['aug', 'august', '08', '8'] },
  september: { month: 8, patterns: ['sep', 'sept', 'september', '09', '9'] },
  october: { month: 9, patterns: ['oct', 'october', '10'] },
  november: { month: 10, patterns: ['nov', 'november', '11'] },
  december: { month: 11, patterns: ['dec', 'december', '12'] }
};

/**
 * Parse month from string
 * @param {string} monthStr - Month string in any format
 * @returns {number|null} - 0-indexed month or null
 */
function parseMonth(monthStr) {
  if (!monthStr) return null;
  
  const lower = monthStr.toLowerCase().trim();
  
  for (const [, monthData] of Object.entries(MONTH_PATTERNS)) {
    if (monthData.patterns.some(p => lower.includes(p) || p.includes(lower))) {
      return monthData.month;
    }
  }
  
  return null;
}

/**
 * Parse day from string
 * @param {string} dayStr - Day string
 * @returns {number|null} - Day (1-31) or null
 */
function parseDay(dayStr) {
  if (!dayStr) return null;
  
  const day = parseInt(dayStr.trim(), 10);
  return day >= 1 && day <= 31 ? day : null;
}

/**
 * Parse year from string
 * @param {string} yearStr - Year string
 * @returns {number|null} - Year (1900-2100) or null
 */
function parseYear(yearStr) {
  if (!yearStr) return null;
  
  let year = parseInt(yearStr.trim(), 10);
  
  // Handle 2-digit years
  if (yearStr.trim().length === 2) {
    year = year < 50 ? year + 2000 : year + 1900;
  }
  
  return year >= 1900 && year <= 2100 ? year : null;
}

/**
 * Try to extract a date from a text segment
 * @param {string} text - Text containing potential date
 * @returns {Date|null} - Parsed Date or null
 */
function extractDateFromSegment(text) {
  if (!text || typeof text !== 'string') return null;
  
  // Clean up text
  const clean = text.replace(/[^\w\s,]/g, ' ').trim();
  const words = clean.split(/\s+/);
  
  // Try to find month, day, year sequence
  for (let i = 0; i < words.length - 1; i++) {
    const month = parseMonth(words[i]);
    if (month === null) continue;
    
    // Look for day after month
    const day = parseDay(words[i + 1]);
    if (day === null) continue;
    
    // Look for year
    let year = null;
    if (i + 2 < words.length) {
      year = parseYear(words[i + 2]);
    }
    
    // If no year found after day, try 4-digit pattern
    if (year === null) {
      const yearMatch = text.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        year = parseInt(yearMatch[1] + yearMatch[0].slice(2), 10);
      }
    }
    
    if (year !== null) {
      return new Date(year, month, day);
    }
  }
  
  // Try MM/DD/YYYY or M/D/YYYY pattern
  const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10) - 1;
    const day = parseInt(slashMatch[2], 10);
    let year = parseInt(slashMatch[3], 10);
    
    if (slashMatch[3].length === 2) {
      year = year < 50 ? year + 2000 : year + 1900;
    }
    
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(year, month, day);
    }
  }
  
  // Try YYYY-MM-DD pattern
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(year, month, day);
    }
  }
  
  return null;
}

/**
 * Intelligently parse decision date from VA decision document text
 * Uses multiple strategies:
 * 1. Look for explicit "Decision Date" label
 * 2. Scan for patterns near "Rating Decision" text
 * 3. Extract dates from signature blocks
 * 4. As fallback, use first valid date found
 * 
 * @param {string} documentText - Full document text from PDF
 * @returns {Object} - { date: Date|null, confidence: number, source: string, format: string }
 */
export function intelligentlyParseDateFromPDF(documentText) {
  if (!documentText || typeof documentText !== 'string') {
    return {
      date: null,
      confidence: 0,
      source: 'none',
      format: null
    };
  }
  
  const text = documentText.trim();
  let bestResult = {
    date: null,
    confidence: 0,
    source: 'none',
    format: null
  };
  
  // Strategy 1: Look for "Decision Date" or "Date of Decision" with nearby date
  const decisionDateMatch = text.match(/(?:Decision\s+)?Date\s+of\s+Decision[:\s]+([^\n]{0,100})/i);
  if (decisionDateMatch) {
    const date = extractDateFromSegment(decisionDateMatch[1]);
    if (date && date.getTime()) {
      return {
        date,
        confidence: 0.95,
        source: 'decision-date-label',
        format: formatDate(date)
      };
    }
  }
  
  // Strategy 2: Look for "Rating Decision dated"
  const ratingDecisionMatch = text.match(/Rating\s+Decision\s+(?:D|d)ated[:\s]+([^\n]{0,100})/i);
  if (ratingDecisionMatch) {
    const date = extractDateFromSegment(ratingDecisionMatch[1]);
    if (date && date.getTime()) {
      return {
        date,
        confidence: 0.90,
        source: 'rating-decision-dated',
        format: formatDate(date)
      };
    }
  }
  
  // Strategy 3: Look for "This decision is dated"
  const thisDecisionMatch = text.match(/This\s+decision\s+is\s+dated[:\s]+([^\n]{0,100})/i);
  if (thisDecisionMatch) {
    const date = extractDateFromSegment(thisDecisionMatch[1]);
    if (date && date.getTime()) {
      return {
        date,
        confidence: 0.85,
        source: 'this-decision-dated',
        format: formatDate(date)
      };
    }
  }
  
  // Strategy 4: Look for signature block dates (often near "VA Regional Office" or "_____  date")
  const signatureMatch = text.match(/(?:VA\s+Regional\s+Office|_+\s+date)[^\n]{0,150}(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}-\d{1,2}-\d{4}|[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (signatureMatch) {
    const date = extractDateFromSegment(signatureMatch[1]);
    if (date && date.getTime()) {
      return {
        date,
        confidence: 0.70,
        source: 'signature-block',
        format: formatDate(date)
      };
    }
  }
  
  // Strategy 5: Extract all dates and prefer more recent ones (likely decision, not historical)
  const allDateMatches = [
    ...text.matchAll(/(?:19|20)\d{2}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])/g),
    ...text.matchAll(/([A-Z][a-z]+)\s+(\d{1,2}),?\s+(19|20)\d{2}/g)
  ];
  
  const allDates = [];
  for (const match of allDateMatches) {
    const date = extractDateFromSegment(match[0]);
    if (date && date.getTime()) {
      allDates.push(date);
    }
  }
  
  // Sort by date (newest first) and take most recent
  if (allDates.length > 0) {
    allDates.sort((a, b) => b.getTime() - a.getTime());
    const mostRecentDate = allDates[0];
    
    // Sanity check: decision should not be in future or more than 5 years old
    const now = new Date();
    const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    
    if (mostRecentDate.getTime() <= now.getTime() && mostRecentDate.getTime() >= fiveYearsAgo.getTime()) {
      return {
        date: mostRecentDate,
        confidence: 0.50,
        source: 'extracted-recent-date',
        format: formatDate(mostRecentDate)
      };
    }
  }
  
  return bestResult;
}

/**
 * Format Date object to "Month day, year" string
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  return normalizeDateFormat(date);
}

/**
 * Extract and normalize decision date from scanner result
 * Prioritizes ratingDecisionDate, falls back to intelligent parsing
 * 
 * @param {Object} scannerResult - Result object from vaSuperScanner
 * @returns {string|null} - Formatted date "Month day, year" or null
 */
export function extractDecisionDate(scannerResult) {
  if (!scannerResult) return null;
  
  // First priority: use metadata.ratingDecisionDate if available
  if (scannerResult.metadata?.ratingDecisionDate) {
    try {
      const date = new Date(scannerResult.metadata.ratingDecisionDate);
      if (!isNaN(date.getTime())) {
        return formatDate(date);
      }
    } catch {
      // Malformed metadata date — fall through to text parsing
    }
  }
  
  // Second priority: try intelligent parsing of full text
  if (scannerResult.fullText) {
    const result = intelligentlyParseDateFromPDF(scannerResult.fullText);
    if (result.date && result.confidence >= 0.50) {
      return formatDate(result.date);
    }
  }
  
  return null;
}

/**
 * Get metadata about date extraction for logging/debugging
 * @param {string} documentText - Full document text
 * @returns {Object} - Detailed parsing information
 */
export function getDateParsingMetadata(documentText) {
  return intelligentlyParseDateFromPDF(documentText);
}

export default {
  intelligentlyParseDateFromPDF,
  extractDecisionDate,
  getDateParsingMetadata,
  parseMonth,
  parseDay,
  parseYear
};
