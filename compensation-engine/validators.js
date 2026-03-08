/**
 * Input Validation Module for Compensation Engine
 * Validates ratings, SMC codes, dependent configurations, and effective dates
 */

/**
 * Validate disability rating (0-100 in 10% increments)
 * @param {number} rating - Disability rating
 * @returns {boolean} True if valid
 */
export function isValidRating(rating) {
  if (typeof rating !== 'number') return false;
  if (rating < 0 || rating > 100) return false;
  if (rating % 10 !== 0) return false;
  return true;
}

/**
 * Validate SMC code (K through T)
 * @param {string} code - SMC code
 * @returns {boolean} True if valid
 */
export function isValidSMCCode(code) {
  const validCodes = ['K', 'L', 'L½', 'M', 'M½', 'N', 'N½', 'O', 'R1', 'R2', 'S', 'T'];
  return validCodes.includes(code);
}

/**
 * Validate SMC codes array (all SMC codes in array must be valid)
 * @param {string|string[]} smcCodes - Single code or array of codes
 * @returns {boolean} True if all codes valid
 */
export function isValidSMCCodes(smcCodes) {
  const codeArray = Array.isArray(smcCodes) ? smcCodes : [smcCodes];
  return codeArray.every(code => isValidSMCCode(code));
}

/**
 * Validate dependent configuration object
 * @param {object} dependents - Dependents object with spouse, children, parents
 * @returns {boolean} True if structure valid
 */
export function isValidDependents(dependents) {
  if (!dependents || typeof dependents !== 'object') return true; // dependents optional
  
  if (!Number.isInteger(dependents.spouse) || dependents.spouse < 0) return false;
  if (!Number.isInteger(dependents.children) || dependents.children < 0) return false;
  if (!Number.isInteger(dependents.parents) || dependents.parents < 0) return false;
  
  return true;
}

/**
 * Validate effective date format (YYYY-MM-DD or Date object)
 * @param {string|Date} date - Date in YYYY-MM-DD format or Date object
 * @returns {boolean} True if valid
 */
export function isValidEffectiveDate(date) {
  if (typeof date === 'string') {
    // Check YYYY-MM-DD format
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(date)) return false;
    
    // Verify it's a valid date
    const parsed = new Date(date + 'T00:00:00Z');
    return !isNaN(parsed.getTime());
  }
  
  if (date instanceof Date) {
    return !isNaN(date.getTime());
  }
  
  return false;
}

/**
 * Validate year (positive integer, reasonable range)
 * @param {number} year - Year to validate
 * @returns {boolean} True if valid
 */
export function isValidYear(year) {
  if (!Number.isInteger(year)) return false;
  if (year < 2000 || year > 2100) return false;
  return true;
}

/**
 * Validate combined rating (for timeline calculations)
 * Same as individual rating validation
 * @param {number} rating - Combined rating
 * @returns {boolean} True if valid
 */
export function isValidCombinedRating(rating) {
  return isValidRating(rating);
}

/**
 * Sanitize and normalize dependent object
 * @param {object} dependents - Raw dependent configuration
 * @returns {object} Normalized dependent configuration
 */
export function normalizeDependents(dependents = {}) {
  return {
    spouse: Math.max(0, dependents.spouse || 0),
    children: Math.max(0, dependents.children || 0),
    parents: Math.max(0, dependents.parents || 0)
  };
}

/**
 * Sanitize and normalize at-most one SMC code string/array
 * (VA rule: highest benefit wins, so we take best code)
 * @param {string|string[]} smcCodes - Raw SMC code(s)
 * @returns {string|null} Single best SMC code or null
 */
export function normalizeSMCCode(smcCodes) {
  if (!smcCodes) return null;
  
  const codeArray = Array.isArray(smcCodes) ? smcCodes : [smcCodes];
  const validCodes = codeArray.filter(code => isValidSMCCode(code));
  
  if (validCodes.length === 0) return null;
  
  // Rank SMC codes by benefit (T is highest, K is lowest)
  const rankOrder = ['T', 'S', 'R2', 'R1', 'O', 'N½', 'N', 'M½', 'M', 'L½', 'L', 'K'];
  
  for (const code of rankOrder) {
    if (validCodes.includes(code)) {
      return code;
    }
  }
  
  return validCodes[0] || null;
}

/**
 * Normalize effective date to YYYY-MM-DD string
 * @param {string|Date} date - Date in any format
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
export function normalizeEffectiveDate(date) {
  if (typeof date === 'string') {
    return date.substring(0, 10); // Takes first 10 chars for YYYY-MM-DD
  }
  
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

