/**
 * Year Selection and Rate Table Management Module
 * Handles automatic year detection, fallback logic, and year table loading
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ratesDir = path.join(__dirname, 'rates');

/**
 * Get all available rate table years
 * @returns {number[]} Array of available years sorted descending
 */
export function getAvailableYears() {
  try {
    const files = fs.readdirSync(ratesDir);
    const years = files
      .filter(file => file.endsWith('.json'))
      .map(file => parseInt(file.replace('.json', ''), 10))
      .filter(year => !isNaN(year))
      .sort((a, b) => b - a);
    return years;
  } catch (error) {
    console.error('Error reading rates directory:', error.message);
    return [];
  }
}

/**
 * Detect the current year
 * @returns {number} Current year
 */
export function detectCurrentYear() {
  return new Date().getFullYear();
}

/**
 * Select and load a rate table for the specified year
 * With automatic fallback to most recent available year if exact match not found
 * @param {number|null} yearOverride - Optional year override for testing/manual selection
 * @returns {object} Rate table object with year, rates, SMC codes, ancillary benefits
 * @throws {Error} If no rate tables are available
 */
export function selectYearTable(yearOverride = null) {
  const availableYears = getAvailableYears();

  if (availableYears.length === 0) {
    throw new Error('No rate tables available in compensation-engine/rates/');
  }

  let targetYear = yearOverride || detectCurrentYear();

  // Find exact match or fall back to most recent
  let selectedYear = availableYears.includes(targetYear)
    ? targetYear
    : availableYears[0]; // Most recent (first in descending sort)

  const rateFile = path.join(ratesDir, `${selectedYear}.json`);

  try {
    const rateData = JSON.parse(fs.readFileSync(rateFile, 'utf8'));
    return {
      ...rateData,
      _selectedYear: selectedYear,
      _requestedYear: yearOverride || targetYear,
      _fallbackApplied: selectedYear !== (yearOverride || targetYear)
    };
  } catch (error) {
    console.error(`Error loading rate table for ${selectedYear}:`, error.message);
    throw new Error(`Failed to load rate table for year ${selectedYear}`);
  }
}

/**
 * Get rate table for a specific effective date
 * @param {string|Date} effectiveDate - Date in format YYYY-MM-DD or Date object
 * @returns {object} Rate table for the effective date's year
 */
export function getTableByEffectiveDate(effectiveDate) {
  let targetDate;

  if (typeof effectiveDate === 'string') {
    targetDate = new Date(effectiveDate);
  } else if (effectiveDate instanceof Date) {
    targetDate = effectiveDate;
  } else {
    throw new Error('effectiveDate must be string (YYYY-MM-DD) or Date object');
  }

  if (Number.isNaN(targetDate.getTime())) {
    throw new Error(`Invalid effectiveDate value: ${effectiveDate}`);
  }

  const availableYears = getAvailableYears().sort((a, b) => a - b);
  if (availableYears.length === 0) {
    throw new Error('No rate tables available in compensation-engine/rates/');
  }

  const candidates = availableYears.map((year) => {
    const table = selectYearTable(year);
    const tableEffectiveDate = table.effectiveDate || table.effective_date || `${year}-01-01`;
    return {
      year,
      table,
      effectiveDate: new Date(tableEffectiveDate)
    };
  }).filter((item) => !Number.isNaN(item.effectiveDate.getTime()));

  candidates.sort((a, b) => a.effectiveDate - b.effectiveDate);

  let selected = candidates[0];
  for (const candidate of candidates) {
    if (candidate.effectiveDate <= targetDate) {
      selected = candidate;
    }
  }

  return {
    ...selected.table,
    _selectedYear: selected.year,
    _requestedYear: targetDate.getFullYear(),
    _fallbackApplied: selected.year !== targetDate.getFullYear()
  };
}

/**
 * Get all available rate tables
 * Useful for timeline calculations across multiple years
 * @returns {object[]} Array of all rate tables
 */
export function getAllRateTables() {
  const years = getAvailableYears();
  return years.map(year => selectYearTable(year));
}

