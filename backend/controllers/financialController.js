import {
  analyzeBudget,
  calculateRetirement,
  generateFinancialPlan,
} from '../services/financialPlannerService.js';

export function getFinancialLegacy(_req, res) {
  res.json({
    current: { monthly: 1650, yearly: 19800 },
    future: { monthly: 2000, yearly: 24000 },
  });
}

export async function analyzeFinancialBudget(req, res) {
  const analysis = analyzeBudget(req.body);
  res.json({ success: true, data: analysis });
}

export async function calculateFinancialRetirement(req, res) {
  const projections = calculateRetirement(req.body);
  res.json({ success: true, data: projections });
}

export async function generateComprehensiveFinancialPlan(req, res) {
  const { budget, retirement } = req.body;
  if (!budget || !retirement) {
    return res.status(400).json({ success: false, error: 'Both budget and retirement data required' });
  }

  const plan = generateFinancialPlan(budget, retirement);
  return res.json({ success: true, data: plan });
}
