import 'dart:math';

double futureValue(double P, double r, int n) {
  if (r == 0) return P * n;
  final growth = pow(1 + r, n);
  final fv = P * ((growth - 1) / r);
  return double.parse(fv.toStringAsFixed(2));
}

Map<String, dynamic> scenarios(double P, double r, int n, {double spread = 0.03}) {
  return {
    'worstRate': r - spread,
    'worstValue': futureValue(P, r - spread, n),
    'medianRate': r,
    'medianValue': futureValue(P, r, n),
    'bestRate': r + spread,
    'bestValue': futureValue(P, r + spread, n),
  };
}
