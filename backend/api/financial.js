import express from 'express';
import { asyncHandler } from '../utils/errors.js';
import {
  analyzeBudget,
  calculateRetirement,
  generateFinancialPlan
} from '../services/financialPlannerService.js';

const router = express.Router();

/**
 * GET /financial - Legacy compatibility endpoint
 */
router.get('/', (req, res) => {
  res.json({
    current: { monthly: 1650, yearly: 19800 },
    future: { monthly: 2000, yearly: 24000 }
  });
});

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
router.post('/budget', asyncHandler(async (req, res) => {
  const analysis = analyzeBudget(req.body);
  res.json({
    success: true,
    data: analysis
  });
}));

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
router.post('/retirement', asyncHandler(async (req, res) => {
  const projections = calculateRetirement(req.body);
  res.json({
    success: true,
    data: projections
  });
}));

/**
 * POST /financial/plan
 * Generate comprehensive financial plan (budget + retirement)
 * 
 * Body: {
 *   budget: { ... },
 *   retirement: { ... }
 * }
 */
router.post('/plan', asyncHandler(async (req, res) => {
  const { budget, retirement } = req.body;
  
  if (!budget || !retirement) {
    return res.status(400).json({
      success: false,
      error: 'Both budget and retirement data required'
    });
  }
  
  const plan = generateFinancialPlan(budget, retirement);
  res.json({
    success: true,
    data: plan
  });
}));

export default router;

