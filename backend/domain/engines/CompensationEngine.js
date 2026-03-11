/**
 * backend/domain/engines/CompensationEngine.js
 *
 * Consolidated compensation evaluation engine.
 * Wraps compensation-engine/index.js with structured logging and error handling.
 *
 * This is the domain layer entry point for compensation calculation.
 * Consolidates duplicated logic from:
 *   - backend/engine/compensationEngine.js (deprecated)
 *
 * Implementation: Delegates to compensation-engine/ module.
 */

import {
  getCompensationByRating,
  getSMCAmount,
  getAncillaryBenefits,
  calculateVeteranCompensation,
  getCompensationTimeline,
  getAvailableCompensationYears,
} from '../../../compensation-engine/index.js';
import { detectCurrentYear } from '../../../compensation-engine/year-selector.js';
import { createLogger } from '../../core/logging/logger.js';
import { Errors } from '../../core/errors/AppError.js';

const log = createLogger('compensation-engine');

export class CompensationEngine {
  /**
   * Calculate monthly compensation for a rated condition.
   *
   * @param {number} rating    Disability rating (0, 10, 20, ..., 100)
   * @param {object} dependents {spouse, children, parents}
   * @param {number} year      Optional specific year for rate table
   * @returns {object}         Compensation breakdown
   */
  calculateByRating(rating, dependents = {}, year = null) {
    try {
      return getCompensationByRating(rating, dependents, year);
    } catch (err) {
      log.error('Compensation calculation failed', {
        rating,
        error: err.message,
      });
      throw Errors.badRequest(`Invalid compensation parameters: ${err.message}`);
    }
  }

  /**
   * Get SMC (Special Monthly Compensation) amount.
   *
   * @param {string} smcCode  e.g., 'K', 'K1', 'L', 'N', 'P'
   * @param {number} year     Optional year for rate table
   * @returns {number}        Monthly SMC amount
   */
  getSMCAmount(smcCode, year = null) {
    try {
      return getSMCAmount(smcCode, year);
    } catch (err) {
      log.warn('SMC lookup failed', { smcCode, error: err.message });
      throw Errors.badRequest(`Invalid SMC code: ${smcCode}`);
    }
  }

  /**
   * Get available ancillary benefits for a year.
   *
   * @param {number} year  Optional year (defaults to current)
   * @returns {object}     Ancillary benefits structure
   */
  getAncillaryBenefits(year = null) {
    try {
      return getAncillaryBenefits(year);
    } catch (err) {
      log.warn('Ancillary benefits lookup failed', { year, error: err.message });
      return {};
    }
  }

  /**
   * Get all available rate table years.
   *
   * @returns {number[]}  Years for which rate tables are available
   */
  getAvailableYears() {
    try {
      return getAvailableCompensationYears();
    } catch (err) {
      log.warn('Available years lookup failed', { error: err.message });
      return [];
    }
  }

  /**
   * Detect current fiscal year based on system time.
   *
   * @returns {number}  Current or applicable year
   */
  detectCurrentYear() {
    return detectCurrentYear();
  }

  /**
   * Calculate compensation timeline across multiple rated conditions.
   *
   * @param {object} params   {effectiveDates, ratings, smcCodes, dependents}
   * @returns {Array}         Array of compensation periods
   */
  calculateTimeline(params) {
    try {
      return getCompensationTimeline(params.effectiveDates, params.ratings, params.smcCodes, params.dependents);
    } catch (err) {
      log.error('Timeline calculation failed', { error: err.message });
      throw Errors.badRequest(`Timeline calculation failed: ${err.message}`);
    }
  }

  /**
   * Full veteran compensation calculation.
   *
   * @param {object} input  {rating, dependents, ratedConditions, smcCodes, ...}
   * @returns {object}      Complete compensation analysis
   */
  calculateVeteran(input) {
    try {
      return calculateVeteranCompensation(input);
    } catch (err) {
      log.error('Veteran compensation calculation failed', { error: err.message });
      throw Errors.internal(`Compensation calculation error: ${err.message}`);
    }
  }
}

export default new CompensationEngine();
