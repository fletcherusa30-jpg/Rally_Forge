import 'package:flutter/material.dart';
import 'budget_engine.dart';

class BudgetPlanner extends StatefulWidget {
  const BudgetPlanner({super.key});

  @override
  State<BudgetPlanner> createState() => _BudgetPlannerState();
}

class _BudgetPlannerState extends State<BudgetPlanner> {
  Map<String, double>? result;

  void calculate() {
    final engine = BudgetEngine();
    setState(() {
      result = engine.calculate();
    });
  }

  @override
  Widget build(BuildContext context) {
    final r = result;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF020617),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Budget Planner',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 12),
          ElevatedButton(onPressed: calculate, child: const Text('Calculate')),
          const SizedBox(height: 12),
          if (r != null) ...[
            Text('Income: \class BudgetEngine {
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
}{r['Income']!.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white)),
            Text('Expenses: \class BudgetEngine {
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
}{r['TotalExpenses']!.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white)),
            Text(
              'Surplus: \class BudgetEngine {
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
}{r['Surplus']!.toStringAsFixed(2)}',
              style: TextStyle(
                color: r['Surplus']! >= 0 ? Colors.greenAccent : Colors.redAccent,
              ),
            ),
            Text(
              'Health Score: ',
              style: const TextStyle(color: Colors.amberAccent),
            ),
          ],
        ],
      ),
    );
  }
}
