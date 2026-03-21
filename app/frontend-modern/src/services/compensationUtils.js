// Compensation calculation utilities — no React dependencies.
// Extracted from ScannerHub so they can be tested in isolation
// and reused by other components that display compensation data.

export const SMC_RANK_ORDER = ['T', 'S', 'R2', 'R1', 'O', 'N\u00bd', 'N', 'M\u00bd', 'M', 'L\u00bd', 'L', 'K'];

export function formatUsd(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function normalizeCompensationBreakdown(input) {
  const value = input || {};
  if (value.breakdown && typeof value.breakdown.totalMonthly === 'number' && Number.isFinite(value.breakdown.totalMonthly)) {
    return value.breakdown;
  }
  if (typeof value.totalMonthly === 'number' && Number.isFinite(value.totalMonthly)) {
    return {
      baseMonthly: value.baseMonthly ?? value.ratingMonthly ?? 0,
      dependentMonthly: value.dependentMonthly ?? 0,
      smcMonthly: value.smcMonthly ?? 0,
      ancillaryMonthly: value.ancillaryMonthly ?? 0,
      totalMonthly: value.totalMonthly,
      totalYearly: value.totalYearly ?? value.totalMonthly * 12,
    };
  }
  return null;
}

export function extractSmcCodes(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  const candidates = new Set();
  const explicitMatches = text.matchAll(/\bSMC[-\s]?(R1|R2|L\u00bd|M\u00bd|N\u00bd|[KLMNOST])\b/gi);
  for (const match of explicitMatches) {
    candidates.add(match[1].toUpperCase());
  }
  const levelListMatches = text.matchAll(/(?:^|[,;\s])(R1|R2|L\u00bd|M\u00bd|N\u00bd|[KLMNOST])\s*[-:]/gi);
  for (const match of levelListMatches) {
    candidates.add(match[1].toUpperCase());
  }
  return Array.from(candidates);
}

export function getHighestSmcCodeFromDecision(decision) {
  const candidates = new Set();

  const explicitSmc = Array.isArray(decision?.smc) ? decision.smc : [];
  explicitSmc.forEach((entry) => {
    const parsedCodes = extractSmcCodes(entry);
    parsedCodes.forEach((code) => candidates.add(code));
  });

  for (const code of SMC_RANK_ORDER) {
    if (candidates.has(code)) {
      return code;
    }
  }

  return null;
}

export function resolveCompensationForDisplay(selected, currentCompensation) {
  const displayedCompensation = selected ? normalizeCompensationBreakdown(selected?.compensation) : null;
  const scannedFinalMonthly = Number(selected?.finalMonthlyAmount);
  const hasScannedFinalMonthly = Number.isFinite(scannedFinalMonthly) && scannedFinalMonthly > 0;

  let compensationForDisplay = displayedCompensation || currentCompensation;

  if (compensationForDisplay && hasScannedFinalMonthly) {
    const calculatedTotal = Number(compensationForDisplay.totalMonthly || 0);
    if (!Number.isFinite(calculatedTotal) || Math.abs(scannedFinalMonthly - calculatedTotal) > 0.01) {
      const baseMonthly = Number(compensationForDisplay.baseMonthly || 0);
      const smcMonthly = Number(compensationForDisplay.smcMonthly || 0);
      const ancillaryMonthly = Number(compensationForDisplay.ancillaryMonthly || 0);
      const derivedDependentMonthly = Math.max(0, scannedFinalMonthly - (baseMonthly + smcMonthly + ancillaryMonthly));
      compensationForDisplay = {
        ...compensationForDisplay,
        dependentMonthly: Math.max(Number(compensationForDisplay.dependentMonthly || 0), derivedDependentMonthly),
        totalMonthly: scannedFinalMonthly,
        totalYearly: scannedFinalMonthly * 12,
      };
    }
  }

  const currentTotalMonthly = hasScannedFinalMonthly
    ? scannedFinalMonthly
    : Number(compensationForDisplay?.totalMonthly || 0);

  return { compensationForDisplay, currentTotalMonthly };
}
