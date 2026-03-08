/**
 * Professional Date Formatting Utilities
 * Converts various date formats to standardized "Month day, year" format
 * for VA Rating Decision display
 */

/**
 * Month names for professional formatting
 */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Parse date string in various formats and return normalized format
 * Supports:
 * - "January 5, 2024" (preferred)
 * - "1/5/2024" or "01/05/2024"
 * - "2024-01-05" (ISO)
 * - "05 January 2024"
 * - Date objects
 * 
 * @param {string|Date} dateInput - The date to parse
 * @returns {string|null} - "Month day, year" or null if unparseable
 */
export function normalizeDateFormat(dateInput) {
  if (!dateInput) return null;

  try {
    let date;

    // Handle Date objects
    if (dateInput instanceof Date) {
      date = dateInput;
    }
    // Handle ISO strings (YYYY-MM-DD)
    else if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
      date = new Date(dateInput);
    }
    // Handle MM/DD/YYYY or M/D/YYYY
    else if (typeof dateInput === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateInput)) {
      const parts = dateInput.split('/');
      const month = parseInt(parts[0], 10) - 1; // 0-indexed for Date constructor
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      date = new Date(year, month, day);
    }
    // Handle "Month day, year" (already correct format - extract and reformat to ensure correctness)
    else if (typeof dateInput === 'string' && /^[A-Z][a-z]+\s+\d{1,2},?\s+\d{4}/.test(dateInput)) {
      // Already in correct format, but validate by parsing
      const parts = dateInput.match(/([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
      if (parts) {
        const monthIndex = MONTH_NAMES.indexOf(parts[1]);
        const day = parseInt(parts[2], 10);
        const year = parseInt(parts[3], 10);
        
        if (monthIndex >= 0) {
          date = new Date(year, monthIndex, day);
        } else {
          return null;
        }
      } else {
        return null;
      }
    }
    // Handle "DD Month YYYY" format
    else if (typeof dateInput === 'string' && /^\d{1,2}\s+[A-Z][a-z]+\s+\d{4}/.test(dateInput)) {
      const parts = dateInput.match(/(\d{1,2})\s+([A-Z][a-z]+)\s+(\d{4})/);
      if (parts) {
        const day = parseInt(parts[1], 10);
        const monthIndex = MONTH_NAMES.indexOf(parts[2]);
        const year = parseInt(parts[3], 10);
        
        if (monthIndex >= 0) {
          date = new Date(year, monthIndex, day);
        } else {
          return null;
        }
      } else {
        return null;
      }
    }
    // Try general Date constructor
    else if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    }
    else {
      return null;
    }

    // Validate the date
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return null;
    }

    // Format as "Month day, year"
    const month = MONTH_NAMES[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();

    return `${month} ${day}, ${year}`;
  } catch (error) {
    console.error('[dateFormatter] Error parsing date:', dateInput, error);
    return null;
  }
}

/**
 * Format a date for VA decision display
 * Returns "Decision: Month day, year" format
 * 
 * @param {string|Date} dateInput - The date to format
 * @returns {string} - "Decision: Month day, year" or "Decision: Unknown"
 */
export function formatDecisionDate(dateInput) {
  const normalized = normalizeDateFormat(dateInput);
  if (!normalized) {
    return 'Decision: Unknown';
  }
  return `Decision: ${normalized}`;
}

/**
 * Compare two dates for sorting
 * Returns newest first for decision chronology
 * 
 * @param {string|Date} dateA - First date
 * @param {string|Date} dateB - Second date
 * @returns {number} - Negative if A is newer, positive if B is newer
 */
export function compareDates(dateA, dateB) {
  try {
    const a = new Date(dateA instanceof Date ? dateA.toISOString() : dateA);
    const b = new Date(dateB instanceof Date ? dateB.toISOString() : dateB);
    
    if (isNaN(a.getTime()) || isNaN(b.getTime())) {
      return 0;
    }
    
    return b.getTime() - a.getTime(); // Newest first
  } catch {
    return 0;
  }
}

/**
 * Extract year from date string
 * 
 * @param {string|Date} dateInput - The date to extract year from
 * @returns {number|null} - The year or null
 */
export function extractYear(dateInput) {
  if (!dateInput) return null;
  
  const normalized = normalizeDateFormat(dateInput);
  if (!normalized) return null;
  
  const match = normalized.match(/(\d{4})$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Check if date is within a range
 * 
 * @param {string|Date} dateInput - The date to check
 * @param {string|Date} startDate - Range start
 * @param {string|Date} endDate - Range end
 * @returns {boolean} - True if date is within range
 */
export function isDateInRange(dateInput, startDate, endDate) {
  try {
    const date = new Date(dateInput instanceof Date ? dateInput.toISOString() : dateInput);
    const start = new Date(startDate instanceof Date ? startDate.toISOString() : startDate);
    const end = new Date(endDate instanceof Date ? endDate.toISOString() : endDate);
    
    if (isNaN(date.getTime()) || isNaN(start.getTime()) || isNaN(end.getTime())) {
      return false;
    }
    
    return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
  } catch {
    return false;
  }
}

export default {
  normalizeDateFormat,
  formatDecisionDate,
  compareDates,
  extractYear,
  isDateInRange
};
