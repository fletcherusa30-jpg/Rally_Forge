// Future Value of an Annuity:
// FV = P * ((1 + r)^n - 1) / r

export function useRetirementCalculator() {
  let futureValue = null;
  let scenarios = null;

  const getFutureValue = (P, r, n) => {
    if (r === 0) return P * n;
    const growth = Math.pow(1 + r, n);
    const fv = P * ((growth - 1) / r);
    return Math.round(fv * 100) / 100;
  };

  const calculate = ({ contribution, rate, years, spread = 0.03 }) => {
    const fv = getFutureValue(contribution, rate, years);
    futureValue = fv;

    const worstRate = rate - spread;
    const medianRate = rate;
    const bestRate = rate + spread;

    scenarios = {
      worstRate,
      worstValue: getFutureValue(contribution, worstRate, years),
      medianRate,
      medianValue: getFutureValue(contribution, medianRate, years),
      bestRate,
      bestValue: getFutureValue(contribution, bestRate, years),
    };
  };

  return {
    get futureValue() {
      return futureValue;
    },
    get scenarios() {
      return scenarios;
    },
    calculate,
  };
}
