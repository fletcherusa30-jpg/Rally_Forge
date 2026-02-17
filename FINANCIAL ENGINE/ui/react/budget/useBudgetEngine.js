import { useState } from 'react';

export function useBudgetEngine() {
  const [result, setResult] = useState(null);

  function sum(obj) {
    if (!obj) return 0;
    return Object.values(obj).reduce((a, b) => a + (Number(b) || 0), 0);
  }

  function calculate(budget) {
    const income = sum(budget.Income);
    const fixed = sum(budget.FixedExpenses);
    const variable = sum(budget.VariableExpenses);
    const annual = sum(budget.AnnualExpenses) / 12;
    const savings = sum(budget.Savings);

    const total = fixed + variable + annual + savings;
    const surplus = income - total;

    const fixedRatio = income > 0 ? fixed / income : 0;
    const variableRatio = income > 0 ? variable / income : 0;
    const savingsRatio = income > 0 ? savings / income : 0;

    const monthlyCore = fixed + variable;
    const emergencyFund = Number(budget.Savings?.EmergencyFund || 0);
    const emergencyMonths = monthlyCore > 0 ? emergencyFund / monthlyCore : 0;
    const targetMonths = Number(budget.EmergencyFundTargetMonths || 6);

    let score = 100;
    if (savingsRatio < 0.15) score -= 20;
    if (fixedRatio > 0.5) score -= 15;
    if (surplus < 0) score -= 25;
    if (emergencyMonths < targetMonths) score -= 20;
    if (score < 0) score = 0;
    if (score > 100) score = 100;

    setResult({
      Income: income,
      FixedExpenses: fixed,
      VariableExpenses: variable,
      AnnualExpensesMonthly: annual,
      Savings: savings,
      TotalExpenses: total,
      Surplus: surplus,
      FixedRatio: fixedRatio,
      VariableRatio: variableRatio,
      SavingsRatio: savingsRatio,
      EmergencyMonths: emergencyMonths,
      EmergencyTargetMonths: targetMonths,
      HealthScore: score,
      Debts: budget.Debts || [],
    });
  }

  return { calculate, result };
}
