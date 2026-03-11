import express from 'express';
import { asyncHandler } from '../core/index.js';
import {
  getFinancialLegacy,
  analyzeFinancialBudget,
  calculateFinancialRetirement,
  generateComprehensiveFinancialPlan,
} from '../controllers/financialController.js';

const router = express.Router();

/**
 * GET /financial - Legacy compatibility endpoint
 */
router.get('/', getFinancialLegacy);

/**
 * POST /financial/budget
 * Analyze budget and calculate financial health score
 * 
 * Body: {
 *   monthlyIncome: number,
 *   fixedExpenses: string (lines of "Name: Amount"),
 *   variableExpenses: string,
 *   debtPayments: string,
 *   savingsContributions: string,
 *   emergencyFundBalance: number
 * }
 */
router.post('/budget', asyncHandler(analyzeFinancialBudget));

/**
 * POST /financial/retirement
 * Calculate retirement projections
 * 
 * Body: {
 *   currentAge, retirementAge, yearsOfFederalService, high3Salary,
 *   tspCivilianBalance, tspMilitaryBalance, tspEmployeePercent,
 *   tspAgencyAutoPercent, tspAgencyMatchPercent,
 *   brokerageBalance, brokerageMonthlyContribution,
 *   vaMonthlyCompensation, crscMonthlyCompensation,
 *   annualReturnRate, estimatedMonthlyExpenses
 * }
 */
router.post('/retirement', asyncHandler(calculateFinancialRetirement));

/**
 * POST /financial/plan
 * Generate comprehensive financial plan (budget + retirement)
 * 
 * Body: {
 *   budget: { ... },
 *   retirement: { ... }
 * }
 */
router.post('/plan', asyncHandler(generateComprehensiveFinancialPlan));

export default router;

