import { compensationEngine } from '../domain/index.js';
import {
  calculateBackPay,
  calculateCompensationQuote,
  normalizeDependentProfile,
} from '../services/compensationService.js';

// Default to current year; compensation-engine will fallback to most recent available if needed
function getDefaultYear() {
  return new Date().getFullYear();
}

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildAuthoritativeQuote({ rating, dependents = {}, smcCode = null, ancillary = {}, year = null } = {}) {
  const normalizedRating = toInteger(rating, 0);
  const normalizedSmcCode = String(smcCode || '').toUpperCase().trim() || null;
  // Let compensation-engine handle year selection and fallback
  const normalizedYear = year ? toInteger(year, null) : null;
  const normalizedDependents = normalizeDependentProfile(dependents || {});

  if (normalizedRating <= 0) {
    throw new Error('rating must be a positive percentage value');
  }

  return calculateCompensationQuote({
    rating: normalizedRating,
    dependents: normalizedDependents,
    smcCode: normalizedSmcCode,
    yearOverride: normalizedYear,
    ancillary,
  });
}

export function getCompensation(req, res) {
  try {
    const rating = Number.parseInt(String(req.query.rating ?? '100'), 10);
    const year = Number.parseInt(String(req.query.yearOverride ?? req.query.year ?? ''), 10) || null;
    const dependents = normalizeDependentProfile({
      spouse: req.query.spouse,
      children: req.query.children,
      parents: req.query.parents,
    });

    const quote = buildAuthoritativeQuote({
      rating,
      dependents,
      smcCode: req.query.smcCode || null,
      ancillary: {
        aidAndAttendance: ['true', '1', 'yes'].includes(String(req.query.aidAndAttendance || '').toLowerCase()),
        housebound: ['true', '1', 'yes'].includes(String(req.query.housebound || '').toLowerCase()),
      },
      year,
    });

    res.json({
      ratingMonthly: quote.breakdown.baseMonthly,
      baseMonthly: quote.breakdown.baseMonthly,
      dependentMonthly: quote.breakdown.dependentMonthly,
      smcMonthly: quote.breakdown.smcMonthly,
      ancillaryMonthly: quote.breakdown.ancillaryMonthly,
      totalMonthly: quote.breakdown.totalMonthly,
      totalYearly: quote.breakdown.totalYearly,
      year: quote.summary.year,
      rating,
      dependents,
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to calculate compensation' });
  }
}

export function getCompensationYears(_req, res) {
  try {
    const years = compensationEngine.getAvailableYears();
    res.json({ years: [...years].sort((a, b) => a - b) });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load compensation years' });
  }
}

export function getSupportedCompensationYears(_req, res) {
  try {
    const availableYears = compensationEngine.getAvailableYears();
    const currentYear = getDefaultYear();
    res.json({
      supportedYears: availableYears.sort((a, b) => a - b),
      default: currentYear,
      note: 'If requested year not available, compensation engine will use most recent available year.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load supported years' });
  }
}

export function createCompensationQuote(req, res) {
  try {
    const body = req.body || {};
    const year = body.yearOverride || body.year || null;
    const quote = buildAuthoritativeQuote({
      rating: body.rating,
      dependents: body.dependents || {},
      smcCode: body.smcCode || null,
      ancillary: body.ancillary || { aidAndAttendance: false, housebound: false },
      year,
    });
    res.json({ success: true, quote });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || 'Failed to create compensation quote' });
  }
}

export function createBackpayQuote(req, res) {
  try {
    const body = req.body || {};
    const calculation = calculateBackPay({
      rating: body.rating,
      dependents: body.dependents || {},
      smcCode: body.smcCode || null,
      startDate: body.startDate,
      endDate: body.endDate || null,
      ancillary: body.ancillary || { aidAndAttendance: false, housebound: false },
    });
    res.json({ success: true, calculation });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || 'Failed to calculate back-pay' });
  }
}
