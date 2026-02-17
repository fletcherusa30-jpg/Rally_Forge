class BudgetEngine {
  Map<String, double> calculate() {
    final income = 6500 + 4400 + 1600;
    final fixed = 1100 + 300 + 250 + 120 + 80;
    final variable = 900 + 300 + 200 + 150;
    final annual = (300 + 1500 + 1800) / 12;
    final savings = 500 + 1500 + 300;

    final total = fixed + variable + annual + savings;
    final surplus = income - total;

    final fixedRatio = income > 0 ? fixed / income : 0;
    final variableRatio = income > 0 ? variable / income : 0;
    final savingsRatio = income > 0 ? savings / income : 0;

    final monthlyCore = fixed + variable;
    final emergencyFund = 500.0;
    final emergencyMonths = monthlyCore > 0 ? emergencyFund / monthlyCore : 0;
    final targetMonths = 6.0;

    double score = 100;
    if (savingsRatio < 0.15) score -= 20;
    if (fixedRatio > 0.5) score -= 15;
    if (surplus < 0) score -= 25;
    if (emergencyMonths < targetMonths) score -= 20;
    if (score < 0) score = 0;
    if (score > 100) score = 100;

    return {
      'Income': income,
      'FixedExpenses': fixed,
      'VariableExpenses': variable,
      'AnnualExpensesMonthly': annual,
      'Savings': savings,
      'TotalExpenses': total,
      'Surplus': surplus,
      'HealthScore': score,
    };
  }
}
