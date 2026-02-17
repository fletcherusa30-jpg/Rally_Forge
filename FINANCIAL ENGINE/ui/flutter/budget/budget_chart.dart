import 'package:flutter/material.dart';

class BudgetChart extends StatelessWidget {
  final Map<String, double> result;

  const BudgetChart({super.key, required this.result});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Income: \class BudgetEngine {
  Map<String, double> calculate() {
    final income = 6500 + 4400 + 1600;
    final fixed = 1100 + 300 + 250 + 120 + 80;
    final variable = 900 + 300 + 200 + 150;
    final annual = (300 + 1500 + 1800) / 12;
    final savings = 500 + 1500 + 300;

    final total = fixed + variable + annual + savings;
    final surplus = income - total;

    return {
      'Income': income,
      'FixedExpenses': fixed,
      'VariableExpenses': variable,
      'AnnualExpensesMonthly': annual,
      'Savings': savings,
      'TotalExpenses': total,
      'Surplus': surplus,
    };
  }
}{result['Income']!.toStringAsFixed(2)}'),
        Text('Expenses: \class BudgetEngine {
  Map<String, double> calculate() {
    final income = 6500 + 4400 + 1600;
    final fixed = 1100 + 300 + 250 + 120 + 80;
    final variable = 900 + 300 + 200 + 150;
    final annual = (300 + 1500 + 1800) / 12;
    final savings = 500 + 1500 + 300;

    final total = fixed + variable + annual + savings;
    final surplus = income - total;

    return {
      'Income': income,
      'FixedExpenses': fixed,
      'VariableExpenses': variable,
      'AnnualExpensesMonthly': annual,
      'Savings': savings,
      'TotalExpenses': total,
      'Surplus': surplus,
    };
  }
}{result['TotalExpenses']!.toStringAsFixed(2)}'),
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

    return {
      'Income': income,
      'FixedExpenses': fixed,
      'VariableExpenses': variable,
      'AnnualExpensesMonthly': annual,
      'Savings': savings,
      'TotalExpenses': total,
      'Surplus': surplus,
    };
  }
}{result['Surplus']!.toStringAsFixed(2)}',
          style: TextStyle(
            color: result['Surplus']! >= 0 ? Colors.greenAccent : Colors.redAccent,
          ),
        ),
      ],
    );
  }
}
