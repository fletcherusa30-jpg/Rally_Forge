import { compensationEngine } from '../domain/index.js';

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  }
  return fallback;
}

export function normalizeDependentProfile(input = {}) {
  const spouse = toBoolean(input.spouse, false) ? 1 : 0;
  const children = Math.max(0, toInteger(input.children, 0));
  const parents = Math.max(0, toInteger(input.parents, 0));
  return { spouse, children, parents };
}

export function calculateCompensationQuote({
  rating,
  dependents = {},
  smcCode = null,
  effectiveDate = null,
  yearOverride = null,
  ancillary = { aidAndAttendance: false, housebound: false }
} = {}) {
  const normalizedRating = toInteger(rating, 0);
  const normalizedDependents = normalizeDependentProfile(dependents);

  return compensationEngine.calculateVeteran({
    rating: normalizedRating,
    dependents: normalizedDependents,
    smcCode,
    effectiveDate,
    yearOverride,
    ancillary
  });
}

export function calculateBackPay({
  rating,
  dependents = {},
  smcCode = null,
  startDate,
  endDate = null,
  ancillary = { aidAndAttendance: false, housebound: false }
} = {}) {
  if (!startDate) {
    throw new Error('startDate is required for back-pay calculation');
  }

  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    throw new Error(`Invalid startDate: ${startDate}`);
  }

  const end = endDate ? new Date(endDate) : new Date();
  if (Number.isNaN(end.getTime())) {
    throw new Error(`Invalid endDate: ${endDate}`);
  }
  if (end < start) {
    throw new Error('endDate must be on or after startDate');
  }

  const normalizedDependents = normalizeDependentProfile(dependents);
  const normalizedRating = toInteger(rating, 0);

  const monthCursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthEnd = new Date(end.getFullYear(), end.getMonth(), 1);

  const timeline = [];
  let totalRetroactive = 0;

  while (monthCursor <= monthEnd) {
    const periodDate = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}-01`;
    const quote = compensationEngine.calculateVeteran({
      rating: normalizedRating,
      dependents: normalizedDependents,
      smcCode,
      effectiveDate: periodDate,
      ancillary
    });

    totalRetroactive += quote.summary.totalMonthly;
    timeline.push({
      month: periodDate,
      yearUsed: quote.summary.year,
      totalMonthly: quote.summary.totalMonthly,
      baseMonthly: quote.breakdown.baseMonthly,
      dependentMonthly: quote.breakdown.dependentMonthly,
      smcMonthly: quote.breakdown.smcMonthly,
      ancillaryMonthly: quote.breakdown.ancillaryMonthly
    });

    monthCursor.setMonth(monthCursor.getMonth() + 1);
  }

  return {
    input: {
      rating: normalizedRating,
      dependents: normalizedDependents,
      smcCode,
      startDate,
      endDate: end.toISOString().slice(0, 10)
    },
    months: timeline.length,
    totalRetroactive,
    averageMonthly: timeline.length > 0 ? totalRetroactive / timeline.length : 0,
    timeline
  };
}

