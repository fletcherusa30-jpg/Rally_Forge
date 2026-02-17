function futureValue(P, r, n) {
  if (r === 0) return P * n;
  const growth = Math.pow(1 + r, n);
  return Math.round(P * ((growth - 1) / r) * 100) / 100;
}

function scenarios(P, r, n, spread = 0.03) {
  return {
    worstRate: r - spread,
    worstValue: futureValue(P, r - spread, n),
    medianRate: r,
    medianValue: futureValue(P, r, n),
    bestRate: r + spread,
    bestValue: futureValue(P, r + spread, n),
  };
}

module.exports = { futureValue, scenarios };
