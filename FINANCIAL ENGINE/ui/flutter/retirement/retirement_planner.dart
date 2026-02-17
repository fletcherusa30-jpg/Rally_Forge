import 'package:flutter/material.dart';
import 'dart:math';
import 'retirement_calculator.dart';
import 'scenario_chart.dart';
import 'ui_theme.dart';

class RetirementPlanner extends StatefulWidget {
  const RetirementPlanner({super.key});

  @override
  State<RetirementPlanner> createState() => _RetirementPlannerState();
}

class _RetirementPlannerState extends State<RetirementPlanner> {
  double contribution = 15000;
  double rate = 0.15;
  int years = 20;

  double? futureValue;
  Map<String, dynamic>? scenarios;

  void calculate() {
    final calc = RetirementCalculator();
    final fv = calc.futureValue(contribution, rate, years);
    final sc = calc.scenarios(contribution, rate, years);

    setState(() {
      futureValue = fv;
      scenarios = sc;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: rfCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Retirement Planner', style: rfHeading),

          const SizedBox(height: 16),

          TextField(
            decoration: rfInput('Annual Contribution'),
            keyboardType: TextInputType.number,
            onChanged: (v) => contribution = double.tryParse(v) ?? 0,
          ),
          const SizedBox(height: 12),

          TextField(
            decoration: rfInput('Growth Rate (decimal)'),
            keyboardType: TextInputType.number,
            onChanged: (v) => rate = double.tryParse(v) ?? 0,
          ),
          const SizedBox(height: 12),

          TextField(
            decoration: rfInput('Years Until Retirement'),
            keyboardType: TextInputType.number,
            onChanged: (v) => years = int.tryParse(v) ?? 0,
          ),
          const SizedBox(height: 16),

          ElevatedButton(
            style: rfButton,
            onPressed: calculate,
            child: const Text('Calculate'),
          ),

          if (futureValue != null) ...[
            const SizedBox(height: 20),
            Text('Projected Retirement Savings', style: rfSubheading),
            Text(
              '\}{futureValue!.toStringAsFixed(2)}',
              style: rfResult,
            ),
          ],

          if (scenarios != null) ...[
            const SizedBox(height: 20),
            Text('Scenario Comparison', style: rfSubheading),
            ScenarioChart(scenarios: scenarios!),
          ],
        ],
      ),
    );
  }
}
