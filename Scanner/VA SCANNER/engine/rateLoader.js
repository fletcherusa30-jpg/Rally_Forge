/**
 * Rate Loader for VA Disability Compensation
 * Parses RATE DATABASE markdown files to provide authoritative VA rates
 * Replaces hardcoded compensation-engine rates with official RATE DATABASE
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RATES_DIR = path.resolve(__dirname, '../rates');

let cachedRates = {};
const yearCache = {}; // Cache for different years

/**
 * Parse markdown table rows into objects
 * Expects format:
 * | Header 1 | Header 2 | ... |
 * |----------|----------|-----|
 * | Value 1  | Value 2  | ... |
 */
function parseMarkdownTable(lines) {
  const rows = [];
  if (lines.length < 3) return rows;

  // First line is headers
  const headerLine = lines[0];
  const headers = headerLine
    .split('|')
    .map(h => h.trim())
    .filter(h => h.length > 0);

  // Skip separator line (lines[1])
  // Process data rows (lines[2+])
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('|') === false) continue;

    const values = line
      .split('|')
      .map(v => v.trim())
      .filter(v => v.length > 0);

    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Extract numeric value from text (e.g., "1,234.56" -> 1234.56)
 */
function parseAmount(text) {
  const cleaned = String(text || '').replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Load 2026 disability compensation rates from markdown
 */
function load2026DisabilityRates() {
  try {
    const filePath = path.join(RATES_DIR, '2026_disability_basic.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const rates = {
      year: 2026,
      baseRates: {},
      dependentAddons: {},
      ancillaryAddons: {}
    };

    // Extract 10%-20% section
    let sectionStart = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('10%–20%')) {
        sectionStart = i;
        break;
      }
    }
    if (sectionStart >= 0) {
      const tableLines = [];
      for (let i = sectionStart + 3; i < lines.length; i++) {
        if (lines[i].includes('|')) {
          tableLines.push(lines[i]);
        } else if (tableLines.length > 0) {
          break;
        }
      }
      const rows10_20 = parseMarkdownTable(tableLines);
      rows10_20.forEach(row => {
        const rating = row['Disability Rating']?.replace('%', '').trim();
        const amount = parseAmount(row['Monthly Payment']);
        if (rating && amount > 0) {
          rates.baseRates[rating] = amount;
        }
      });
    }

    // Extract 30%-60% section (veteran alone rates are base)
    sectionStart = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('30%–60%')) {
        sectionStart = i;
        break;
      }
    }
    if (sectionStart >= 0) {
      const tableLines = [];
      for (let i = sectionStart + 3; i < lines.length; i++) {
        if (lines[i].includes('|')) {
          tableLines.push(lines[i]);
        } else if (tableLines.length > 0) {
          break;
        }
      }
      const rows30_60 = parseMarkdownTable(tableLines);
      rows30_60.forEach(row => {
        const depStatus = row['Dependent Status'];
        if (depStatus === 'Veteran alone') {
          ['30', '40', '50', '60'].forEach(rating => {
            const amount = parseAmount(row[rating + '%']);
            if (amount > 0) {
              rates.baseRates[rating] = amount;
            }
          });
        }
      });
    }

    // Extract 70%-100% section (veteran alone rates are base)
    sectionStart = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('70%–100%')) {
        sectionStart = i;
        break;
      }
    }
    if (sectionStart >= 0) {
      const tableLines = [];
      for (let i = sectionStart + 3; i < lines.length; i++) {
        if (lines[i].includes('|')) {
          tableLines.push(lines[i]);
        } else if (tableLines.length > 0) {
          break;
        }
      }
      const rows70_100 = parseMarkdownTable(tableLines);
      rows70_100.forEach(row => {
        const depStatus = row['Dependent Status'];
        if (depStatus === 'Veteran alone') {
          ['70', '80', '90', '100'].forEach(rating => {
            const amount = parseAmount(row[rating + '%']);
            if (amount > 0) {
              rates.baseRates[rating] = amount;
            }
          });
        }
      });
    }

    return rates;
  } catch (error) {
    console.error('[RateLoader] Error loading disability rates:', error.message);
    return null;
  }
}

/**
 * Load 2026 SMC rates from markdown
 */
function load2026SMCRates() {
  try {
    const filePath = path.join(RATES_DIR, '2026_smc.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const rates = {
      year: 2026,
      smcRates: {}
    };

    // Extract SMC-K and SMC-Q section
    let sectionStart = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('SMC-K and SMC-Q')) {
        sectionStart = i;
        break;
      }
    }
    if (sectionStart >= 0) {
      const tableLines = [];
      for (let i = sectionStart + 1; i < lines.length; i++) {
        if (lines[i].includes('|')) {
          tableLines.push(lines[i]);
        } else if (tableLines.length > 0 && !lines[i].trim()) {
          break;
        }
      }
      const rows = parseMarkdownTable(tableLines);
      rows.forEach(row => {
        const level = row['Level']?.trim();
        const monthly = parseAmount(row['Monthly Payment']);
        if (level && monthly > 0) {
          // Extract just the letter code from "SMC-K" -> "K"
          const code = level.replace(/^SMC-/i, '').trim();
          rates.smcRates[code] = monthly;
        }
      });
    }

    // Extract SMC-L through SMC-N section (Veteran alone rates)
    sectionStart = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('SMC-L through SMC-N')) {
        sectionStart = i;
        break;
      }
    }
    if (sectionStart >= 0) {
      let foundBasicRates = false;
      for (let i = sectionStart; i < lines.length; i++) {
        if (lines[i].includes('Basic SMC Rates')) {
          foundBasicRates = true;
        }
        if (foundBasicRates && lines[i].includes('Veteran alone')) {
          // Found the veteran alone row, extract values
          const row = lines[i];
          const values = row.split('|').map(v => v.trim()).filter(v => v.length > 0);
          if (values.length >= 5) {
            const levels = ['L', 'L½', 'M', 'M½'];
            for (let j = 0; j < Math.min(4, values.length - 1); j++) {
              const amount = parseAmount(values[j + 1]);
              if (amount > 0) {
                rates.smcRates[levels[j]] = amount;
              }
            }
          }
          break;
        }
      }
    }

    // Extract SMC-N½ through SMC-S section
    sectionStart = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('SMC-N½ through SMC-S')) {
        sectionStart = i;
        break;
      }
    }
    if (sectionStart >= 0) {
      let foundBasicRates = false;
      for (let i = sectionStart; i < lines.length; i++) {
        if (lines[i].includes('Basic SMC Rates')) {
          foundBasicRates = true;
        }
        if (foundBasicRates && lines[i].includes('Veteran alone')) {
          const row = lines[i];
          const values = row.split('|').map(v => v.trim()).filter(v => v.length > 0);
          if (values.length >= 5) {
            // Table has 4 columns after "Dependent Status": N½, O/P, R.1, R.2/T
            // Map each column to the appropriate SMC code(s)
            const amount_N_half = parseAmount(values[1]);
            const amount_O_P = parseAmount(values[2]);
            const amount_R1 = parseAmount(values[3]);
            const amount_R2_T = parseAmount(values[4]);
            
            if (amount_N_half > 0) rates.smcRates['N½'] = amount_N_half;
            if (amount_O_P > 0) {
              rates.smcRates['O'] = amount_O_P;
              rates.smcRates['P'] = amount_O_P; // O/P same rate
            }
            if (amount_R1 > 0) rates.smcRates['R1'] = amount_R1;
            if (amount_R2_T > 0) {
              rates.smcRates['R2'] = amount_R2_T;
              rates.smcRates['T'] = amount_R2_T; // R.2/T same rate
            }
          }
          break;
        }
      }
    }

    return rates;
  } catch (error) {
    console.error('[RateLoader] Error loading SMC rates:', error.message);
    return null;
  }
}

/**
 * Load ancillary benefit rates
 */
function load2026AncillaryRates() {
  try {
    const filePath = path.join(RATES_DIR, '2026.json');
    if (!fs.existsSync(filePath)) {
      return {
        year: 2026,
        aidAndAttendance: 171.00,
        housebound: 107.00,
        clothingAllowance: 37.25
      };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    return {
      year: 2026,
      aidAndAttendance: data.ancillary?.aid_and_attendance?.monthly || 171.00,
      housebound: data.ancillary?.housebound?.monthly || 107.00,
      clothingAllowance: data.ancillary?.clothing_allowance?.monthly || 37.25
    };
  } catch (error) {
    console.warn('[RateLoader] Falling back to default ancillary rates:', error.message);
    return {
      year: 2026,
      aidAndAttendance: 171.00,
      housebound: 107.00,
      clothingAllowance: 37.25
    };
  }
}

/**
 * Load rates from JSON file for any year
 * Returns null if file doesn't exist or data is incomplete
 */
function loadRatesFromJSON(year) {
  try {
    const filePath = path.join(RATES_DIR, 'YEARS', `${year}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    if (!data.ratings) {
      return null;
    }

    // Convert ratings to our format: { year, baseRates: {}, smcRates: {}, ancillary: {} }
    const baseRates = {};
    for (const [rating, categories] of Object.entries(data.ratings)) {
      if (categories.veteran !== null && categories.veteran !== undefined) {
        baseRates[rating] = categories.veteran;
      }
    }

    return {
      year,
      baseRates,
      smcRates: data.smc_rates || {},
      ancillary: {
        aidAndAttendance: data.ancillary?.aid_and_attendance?.monthly || 171.00,
        housebound: data.ancillary?.housebound?.monthly || 107.00,
        clothingAllowance: data.ancillary?.clothing_allowance?.monthly || 37.25
      }
    };
  } catch (error) {
    console.warn(`[RateLoader] Cannot load rates from JSON for year ${year}:`, error.message);
    return null;
  }
}

/**
 * Load all 2026 rates (cache on first call)
 */
export function load2026Rates() {
  if (cachedRates.year === 2026) {
    return cachedRates;
  }

  const disabilityRates = load2026DisabilityRates();
  const smcRates = load2026SMCRates();
  const ancillaryRates = load2026AncillaryRates();

  cachedRates = {
    year: 2026,
    baseRates: disabilityRates?.baseRates || {},
    smcRates: smcRates?.smcRates || {},
    ancillary: ancillaryRates
  };

  return cachedRates;
}

/**
 * Load rates for any year
 * Tries JSON file first, falls back to markdown for 2026
 */
function loadRatesByYear(year) {
  const yearInt = Number.parseInt(String(year), 10);
  if (!Number.isFinite(yearInt) || yearInt < 1950 || yearInt > 2100) {
    throw new Error(`Invalid year: ${year}. Must be between 1950 and 2100.`);
  }

  // Check cache first
  if (yearCache[yearInt]) {
    return yearCache[yearInt];
  }

  // Try to load from JSON file
  let rates = loadRatesFromJSON(yearInt);
  
  // Fall back to markdown for 2026
  if (!rates && yearInt === 2026) {
    const disabilityRates = load2026DisabilityRates();
    const smcRates = load2026SMCRates();
    const ancillaryRates = load2026AncillaryRates();

    rates = {
      year: 2026,
      baseRates: disabilityRates?.baseRates || {},
      smcRates: smcRates?.smcRates || {},
      ancillary: ancillaryRates
    };
  }

  if (!rates) {
    throw new Error(`No rates found for year ${yearInt}`);
  }

  // Cache it
  yearCache[yearInt] = rates;
  return rates;
}

/**
 * Get base monthly rate for a disability rating (veteran alone, no dependents)
 */
export function getBaseRate(rating, year = 2026) {
  const ratingNum = Number.parseInt(String(rating), 10);
  if (!Number.isFinite(ratingNum) || ratingNum <= 0 || ratingNum > 100) {
    throw new Error(`Invalid disability rating: ${rating}. Must be between 1 and 100.`);
  }
  const rates = loadRatesByYear(year);
  const ratingStr = String(ratingNum);
  const amount = rates.baseRates[ratingStr];
  if (!amount) {
    throw new Error(`No base rate found for ${ratingNum}% in year ${year}`);
  }
  return amount;
}

/**
 * Get SMC monthly amount
 */
export function getSMCRate(code, year = 2026) {
  const rates = loadRatesByYear(year);
  return rates.smcRates[code] || 0;
}

/**
 * Get ancillary benefit amount
 */
export function getAncillaryRate(benefitType, year = 2026) {
  const rates = loadRatesByYear(year);
  if (benefitType === 'aidAndAttendance') {
    return rates.ancillary.aidAndAttendance;
  }
  if (benefitType === 'housebound') {
    return rates.ancillary.housebound;
  }
  if (benefitType === 'clothingAllowance') {
    return rates.ancillary.clothingAllowance;
  }
  return 0;
}

export default {
  load2026Rates,
  loadRatesByYear,
  getBaseRate,
  getSMCRate,
  getAncillaryRate
};

