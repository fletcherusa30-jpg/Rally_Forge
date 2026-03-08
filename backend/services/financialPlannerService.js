/**
 * Financial Planner Service
 * 
 * Provides comprehensive financial planning calculations including:
 * - Budget analysis and scoring
 * - Retirement projections (TSP, FERS, VA benefits)
 * - Emergency fund adequacy
 * - Debt-to-income ratios
 * - Savings rate optimization
 */

/**
 * Parse expense/income lines from text format
 * Format: "ItemName: Amount" per line
 */
const parseLines = (text) => {
  if (!text) return [];
  return text.split('\n')
    .map(line => {
      const parts = line.split(':');
      return {
        name: parts[0]?.trim() || '',
        amount: parseFloat(parts[1]) || 0
      };
    })
    .filter(item => item.name && item.amount > 0);
};

/**
 * Sum amounts from parsed items
 */
const sum = (items) => {
  return items.reduce((total, item) => total + (item.amount || 0), 0);
};

/**
 * Calculate future value of lump sum
 * FV = PV * (1 + r)^n
 */
const futureValueLumpSum = (presentValue, rate, years) => {
  return presentValue * Math.pow(1 + rate, years);
};

/**
 * Calculate future value of annuity (regular contributions)
 * FV = C * [(1 + r)^n - 1] / r
 */
const futureValueAnnuity = (annualContribution, rate, years) => {
  if (rate === 0) return annualContribution * years;
  return annualContribution * ((Math.pow(1 + rate, years) - 1) / rate);
};

/**
 * Analyze budget and generate financial health score
 */
export const analyzeBudget = (budgetData) => {
  const {
    monthlyIncome = 0,
    fixedExpenses = '',
    variableExpenses = '',
    debtPayments = '',
    savingsContributions = '',
    emergencyFundBalance = 0
  } = budgetData;

  // Parse all expense categories
  const fixed = parseLines(fixedExpenses);
  const variable = parseLines(variableExpenses);
  const debt = parseLines(debtPayments);
  const savings = parseLines(savingsContributions);

  // Calculate totals
  const totalFixed = sum(fixed);
  const totalVariable = sum(variable);
  const totalDebt = sum(debt);
  const totalSavings = sum(savings);
  const totalExpenses = totalFixed + totalVariable + totalDebt + totalSavings;
  const surplus = monthlyIncome - totalExpenses;

  // Calculate key ratios
  const savingsRate = monthlyIncome > 0 ? totalSavings / monthlyIncome : 0;
  const debtToIncome = monthlyIncome > 0 ? totalDebt / monthlyIncome : 0;
  
  // Core expenses (excluding savings)
  const coreExpenses = totalExpenses - totalSavings;
  const emergencyFundMonths = coreExpenses > 0 ? emergencyFundBalance / coreExpenses : 0;

  // Calculate budget health score (0-100)
  let score = 50; // Base score

  // Positive cashflow bonus
  if (surplus > 0) score += 10;
  
  // Savings rate bonus (15%+ is excellent)
  if (savingsRate >= 0.20) score += 20;
  else if (savingsRate >= 0.15) score += 15;
  else if (savingsRate >= 0.10) score += 10;
  
  // Debt-to-income bonus (lower is better)
  if (debtToIncome <= 0.15) score += 20;
  else if (debtToIncome <= 0.30) score += 15;
  else if (debtToIncome <= 0.43) score += 5;
  
  // Emergency fund bonus
  if (emergencyFundMonths >= 6) score += 20;
  else if (emergencyFundMonths >= 3) score += 10;

  score = Math.min(100, Math.max(0, score));

  // Generate recommendations
  const recommendations = [];
  
  if (surplus < 0) {
    recommendations.push('🔴 Spending exceeds income. Review expenses and identify cuts.');
  }
  if (savingsRate < 0.15) {
    recommendations.push(`⚠️ Savings rate is ${(savingsRate * 100).toFixed(1)}%. Aim for 15%+ for financial security.`);
  }
  if (debtToIncome > 0.43) {
    recommendations.push('🔴 Debt-to-income ratio exceeds 43%. Focus on debt reduction.');
  } else if (debtToIncome > 0.30) {
    recommendations.push('⚠️ Debt-to-income is elevated. Consider accelerating debt payoff.');
  }
  if (emergencyFundMonths < 3) {
    recommendations.push('🔴 Emergency fund is below 3 months. Prioritize building reserves.');
  } else if (emergencyFundMonths < 6) {
    recommendations.push('⚠️ Emergency fund is adequate. Target 6 months for optimal security.');
  }
  if (surplus > 0 && emergencyFundMonths >= 6) {
    recommendations.push('✅ Strong financial position! Consider increasing retirement contributions.');
  }

  return {
    summary: {
      totalIncome: monthlyIncome,
      totalExpenses,
      totalFixed,
      totalVariable,
      totalDebt,
      totalSavings,
      surplus,
      emergencyFundBalance
    },
    metrics: {
      savingsRate: Math.round(savingsRate * 10000) / 100,
      debtToIncome: Math.round(debtToIncome * 10000) / 100,
      emergencyFundMonths: Math.round(emergencyFundMonths * 10) / 10
    },
    score: Math.round(score),
    scoreCategory: score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Improvement',
    recommendations,
    breakdown: {
      fixed,
      variable,
      debt,
      savings
    }
  };
};

/**
 * Calculate retirement projections including TSP, FERS, and VA benefits
 */
export const calculateRetirement = (retirementData) => {
  const {
    currentAge = 35,
    retirementAge = 67,
    yearsOfFederalService = 20,
    high3Salary = 100000,
    
    // TSP balances
    tspCivilianBalance = 0,
    tspMilitaryBalance = 0,
    tspEmployeePercent = 5,
    tspAgencyAutoPercent = 1,
    tspAgencyMatchPercent = 4,
    
    // Brokerage accounts
    brokerageBalance = 0,
    brokerageMonthlyContribution = 0,
    
    // VA income
    vaMonthlyCompensation = 0,
    crscMonthlyCompensation = 0,
    
    // Assumptions
    annualReturnRate = 5,
    estimatedMonthlyExpenses = 5000
  } = retirementData;

  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const returnRate = annualReturnRate / 100;

  // TSP calculations
  const totalTspBalance = tspCivilianBalance + tspMilitaryBalance;
  const tspAnnualContribution = high3Salary * (
    (tspEmployeePercent / 100) + 
    (tspAgencyAutoPercent / 100) + 
    (tspAgencyMatchPercent / 100)
  );
  
  const tspFutureValue = 
    futureValueLumpSum(totalTspBalance, returnRate, yearsToRetirement) +
    futureValueAnnuity(tspAnnualContribution, returnRate, yearsToRetirement);

  // Brokerage calculations
  const brokerageAnnualContribution = brokerageMonthlyContribution * 12;
  const brokerageFutureValue = 
    futureValueLumpSum(brokerageBalance, returnRate, yearsToRetirement) +
    futureValueAnnuity(brokerageAnnualContribution, returnRate, yearsToRetirement);

  // Total investments at retirement
  const totalInvestments = tspFutureValue + brokerageFutureValue;

  // FERS pension calculation
  // Multiplier: 1.1% if retiring at 62+ with 20+ years, else 1%
  const fersMultiplier = (retirementAge >= 62 && yearsOfFederalService >= 20) ? 0.011 : 0.01;
  const fersAnnualPension = high3Salary * yearsOfFederalService * fersMultiplier;
  const fersMonthlyPension = fersAnnualPension / 12;

  // Total monthly income at retirement
  const totalMonthlyIncome = fersMonthlyPension + vaMonthlyCompensation + crscMonthlyCompensation;

  // Income vs expenses analysis
  const monthlyGap = totalMonthlyIncome - estimatedMonthlyExpenses;
  const needsWithdrawals = monthlyGap < 0;
  const annualWithdrawalNeeded = needsWithdrawals ? Math.abs(monthlyGap) * 12 : 0;

  // 4% rule: safe withdrawal rate for 30-year retirement
  const safeWithdrawalAmount = totalInvestments * 0.04;
  const isSustainable = annualWithdrawalNeeded <= safeWithdrawalAmount;

  // Calculate years money will last
  let yearsMoneyLasts = 0;
  if (annualWithdrawalNeeded > 0 && totalInvestments > 0) {
    // Simplified calculation: total / annual need
    yearsMoneyLasts = Math.floor(totalInvestments / annualWithdrawalNeeded);
  }

  // Generate recommendations
  const recommendations = [];
  
  if (totalInvestments < 500000) {
    recommendations.push('⚠️ Consider increasing retirement contributions for better security.');
  }
  if (needsWithdrawals && !isSustainable) {
    recommendations.push('🔴 Projected withdrawals exceed safe 4% rule. Increase savings or reduce expenses.');
  }
  if (fersMonthlyPension < estimatedMonthlyExpenses * 0.5) {
    recommendations.push('⚠️ FERS pension covers less than 50% of expenses. Maximize TSP contributions.');
  }
  if (tspEmployeePercent < 5) {
    recommendations.push('💡 Increase TSP contributions to at least 5% to maximize agency match.');
  }
  if (totalMonthlyIncome >= estimatedMonthlyExpenses && !needsWithdrawals) {
    recommendations.push('✅ Pension and VA income cover all expenses! Investments are pure surplus.');
  }

  return {
    timeline: {
      currentAge,
      retirementAge,
      yearsToRetirement,
      yearsOfFederalService
    },
    investments: {
      tspBalance: totalTspBalance,
      tspAnnualContribution,
      tspAtRetirement: tspFutureValue,
      brokerageBalance,
      brokerageAnnualContribution,
      brokerageAtRetirement: brokerageFutureValue,
      totalAtRetirement: totalInvestments
    },
    income: {
      fersMonthlyPension: Math.round(fersMonthlyPension * 100) / 100,
      fersAnnualPension: Math.round(fersAnnualPension * 100) / 100,
      vaMonthly: vaMonthlyCompensation,
      crscMonthly: crscMonthlyCompensation,
      totalMonthlyIncome: Math.round(totalMonthlyIncome * 100) / 100,
      totalAnnualIncome: Math.round(totalMonthlyIncome * 12 * 100) / 100
    },
    analysis: {
      estimatedMonthlyExpenses,
      monthlyGap: Math.round(monthlyGap * 100) / 100,
      needsWithdrawals,
      annualWithdrawalNeeded: Math.round(annualWithdrawalNeeded * 100) / 100,
      safeWithdrawalAmount: Math.round(safeWithdrawalAmount * 100) / 100,
      isSustainable,
      yearsMoneyLasts: needsWithdrawals ? yearsMoneyLasts : null
    },
    recommendations
  };
};

/**
 * Generate comprehensive financial plan
 */
export const generateFinancialPlan = (budgetData, retirementData) => {
  const budget = analyzeBudget(budgetData);
  const retirement = calculateRetirement(retirementData);

  // Cross-cutting recommendations
  const integratedRecommendations = [];
  
  if (budget.summary.surplus > 0 && budget.metrics.emergencyFundMonths >= 6) {
    integratedRecommendations.push(
      `💡 You have $${budget.summary.surplus}/month surplus. Consider increasing retirement contributions by this amount.`
    );
  }
  
  if (retirement.investments.tspAnnualContribution < budget.summary.totalIncome * 0.15) {
    integratedRecommendations.push(
      '⚠️ TSP contributions are below 15% of gross income. This may impact retirement readiness.'
    );
  }

  return {
    budget,
    retirement,
    integratedRecommendations,
    generatedAt: new Date().toISOString()
  };
};
