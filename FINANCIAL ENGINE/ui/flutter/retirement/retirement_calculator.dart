import 'dart:math';

class RetirementCalculator {
  double futureValue(double P, double r, int n) {
    if (r == 0) return P * n;
    final growth = pow(1 + r, n);
    final fv = P * ((growth - 1) / r);
    return double.parse(fv.toStringAsFixed(2));
  }

  Map<String, dynamic> scenarios(double P, double r, int n, {double spread = 0.03}) {
    final worst = r - spread;
    final median = r;
    final best = r + spread;

    return {
      'worstRate': worst,
      'worstValue': futureValue(P, worst, n),
      'medianRate': median,
      'medianValue': futureValue(P, median, n),
      'bestRate': best,
      'bestValue': futureValue(P, best, n),
    };
  }
}
