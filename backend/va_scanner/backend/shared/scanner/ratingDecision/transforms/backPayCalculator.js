'use strict';

/**
 * Back Pay Calculator
 * Calculates retroactive compensation for VA rating decisions
 * Implements back pay calculation per 38 CFR §3.400
 */

/**
 * Calculate back pay amount based on effective date and rating change
 * @param {Object} params - Calculation parameters
 * @param {string} params.effectiveDate - Effective date of new rating (YYYY-MM-DD)
 * @param {string} params.decisionDate - Date decision was made (YYYY-MM-DD)
 * @param {number} params.monthlyAmount - Monthly compensation at new rating
 * @param {number} [params.priorMonthlyAmount=0] - Prior monthly compensation amount
 * @param {number} [params.priorRating=0] - Prior rating percentage
 * @returns {Object} {eligible: boolean, backPayPeriod: Object, totalBackPay: number, monthlyBreakdown: Array, details: string}
 * @throws {Error} If dates are invalid or in wrong order
 */
function calculateBackPay(params) {
  const {
    effectiveDate,
    decisionDate,
    monthlyAmount,
    priorMonthlyAmount = 0,
    priorRating = 0
  } = params;

  // Validate parameters
  if (!effectiveDate || !decisionDate) {
    throw new Error('Both effectiveDate and decisionDate are required');
  }

  if (typeof monthlyAmount !== 'number' || monthlyAmount < 0) {
    throw new Error('monthlyAmount must be a non-negative number');
  }

  // Parse dates
  let effDate, decDate;
  try {
    effDate = new Date(effectiveDate);
    decDate = new Date(decisionDate);
  } catch (error) {
    throw new Error(`Invalid date format: ${error.message}`);
  }

  // Validate date logic
  if (effDate > decDate) {
    return {
      eligible: false,
      reason: 'Effective date cannot be after decision date',
      details: `Effective: ${effectiveDate}, Decision: ${decisionDate}`
    };
  }

  // Effective date cannot be more than 1 year in the future
  const maxFutureDate = new Date();
  maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1);
  
  if (effDate > maxFutureDate) {
    return {
      eligible: false,
      reason: 'Effective date too far in future',
      details: `Effective date must be within 1 year`
    };
  }

  // Effective date cannot be in the future
  const today = new Date();
  if (effDate > today) {
    return {
      eligible: false,
      reason: 'Effective date cannot be in the future',
      details: `Effective: ${effectiveDate}, Today: ${today.toISOString().split('T')[0]}`
    };
  }

  // Calculate months between effective date and decision date
  const months = getMonthsDifference(effDate, decDate);
  
  if (months === 0) {
    return {
      eligible: false,
      reason: 'No back pay period - effective and decision dates are in same month',
      backPayPeriod: {
        startDate: effectiveDate,
        endDate: decisionDate,
        months: 0
      },
      totalBackPay: 0,
      monthlyBreakdown: [],
      details: 'Back pay calculations begin month after effective date'
    };
  }

  // Calculate monthly difference
  const monthlyDifference = monthlyAmount - priorMonthlyAmount;
  
  if (monthlyDifference <= 0) {
    return {
      eligible: false,
      reason: 'No back pay - new rating amount is not greater than prior amount',
      totalBackPay: 0,
      details: `Prior: $${priorMonthlyAmount}, New: $${monthlyAmount}`
    };
  }

  // Build month-by-month breakdown
  const breakdown = [];
  let currentDate = new Date(effDate);
  
  for (let i = 0; i < months; i++) {
    const monthStart = new Date(currentDate);
    const monthEnd = new Date(currentDate);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(monthEnd.getDate() - 1);
    
    breakdown.push({
      month: monthStart.toISOString().split('T')[0].substring(0, 7), // YYYY-MM
      startDate: monthStart.toISOString().split('T')[0],
      endDate: monthEnd.toISOString().split('T')[0],
      monthlyAmount: monthlyAmount,
      priorAmount: priorMonthlyAmount,
      difference: monthlyDifference
    });
    
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  const totalBackPay = months * monthlyDifference;

  return {
    eligible: true,
    backPayPeriod: {
      startDate: effectiveDate,
      endDate: decisionDate,
      months: months
    },
    priorRating: priorRating,
    priorMonthlyAmount: priorMonthlyAmount,
    newMonthlyAmount: monthlyAmount,
    monthlyIncrease: monthlyDifference,
    monthlyBreakdown: breakdown,
    totalBackPay: Number(totalBackPay.toFixed(2)),
    details: `${months} months × $${monthlyDifference.toFixed(2)} = $${totalBackPay.toFixed(2)} back pay`,
    regulationCitation: '38 CFR §3.400',
    warnings: []
  };
}

/**
 * Calculate difference in months between two dates
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {number} Number of complete months
 */
function getMonthsDifference(startDate, endDate) {
  let months = 0;
  const current = new Date(startDate);
  
  while (current < endDate) {
    current.setMonth(current.getMonth() + 1);
    if (current <= endDate) {
      months++;
    }
  }
  
  return months;
}

/**
 * Validate back pay calculation in decision document
 * @param {number} statedBackPay - Back pay amount from decision
 * @param {Object} calculation - Result from calculateBackPay()
 * @returns {Object} {isValid: boolean, status: string, discrepancy: number}
 */
function validateBackPayAmount(statedBackPay, calculation) {
  if (!calculation.eligible) {
    return {
      isValid: statedBackPay === 0,
      status: statedBackPay === 0 ? 'PASS' : 'FAIL - Back pay stated but not eligible',
      statedAmount: statedBackPay,
      calculatedAmount: 0,
      details: calculation.reason
    };
  }

  const discrepancy = Math.abs(statedBackPay - calculation.totalBackPay);
  const isValid = discrepancy < 0.01; // Allow for rounding errors

  return {
    isValid: isValid,
    status: isValid ? 'PASS - Back pay amount correct' : 'FAIL - Back pay discrepancy',
    statedAmount: statedBackPay,
    calculatedAmount: calculation.totalBackPay,
    discrepancy: Number(discrepancy.toFixed(2)),
    details: calculation.details,
    warnings: !isValid ? [`Back pay discrepancy: $${discrepancy.toFixed(2)}`] : []
  };
}

module.exports = {
  calculateBackPay,
  validateBackPayAmount,
  getMonthsDifference
};
