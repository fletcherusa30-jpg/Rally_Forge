import 'package:flutter/material.dart';
import 'ui_theme.dart';

class ScenarioChart extends StatelessWidget {
  final Map<String, dynamic> scenarios;

  const ScenarioChart({super.key, required this.scenarios});

  @override
  Widget build(BuildContext context) {
    final data = [
      {'label': 'Worst', 'value': scenarios['worstValue']},
      {'label': 'Median', 'value': scenarios['medianValue']},
      {'label': 'Best', 'value': scenarios['bestValue']},
    ];

    final max = data.map((e) => e['value'] as double).reduce((a, b) => a > b ? a : b);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: data.map((item) {
        final height = (item['value'] / max) * 120;

        return Expanded(
          child: Column(
            children: [
              Container(
                height: height,
                width: 20,
                decoration: rfBar,
              ),
              const SizedBox(height: 6),
              Text(item['label'], style: rfLabel),
              Text('\-Force{item['value'].toStringAsFixed(0)}', style: rfValue),
            ],
          ),
        );
      }).toList(),
    );
  }
}
