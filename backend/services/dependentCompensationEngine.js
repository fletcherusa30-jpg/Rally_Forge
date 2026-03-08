import { calculateCompensationQuote } from './compensationService.js';

function toISODate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function uniqueSortedDates(values = []) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => new Date(a) - new Date(b));
}

function normalizeDependentType(rawType, warnings, name) {
  const value = String(rawType || '').toLowerCase();
  if (value === 'spouse' || value === 'child' || value === 'parent') {
    return value;
  }

  warnings.push({
    message: 'Unknown dependent type defaulted to child.',
    dependentName: name || null,
    originalType: rawType || null
  });

  return 'child';
}

function normalizeDependents(dependents = [], warnings = []) {
  return (Array.isArray(dependents) ? dependents : []).map((dep) => {
    const name = String(dep?.name || '').trim();
    const type = normalizeDependentType(dep?.type, warnings, name);

    return {
      type,
      name,
      effectiveDate: toISODate(dep?.effectiveDate),
      removalDate: toISODate(dep?.removalDate),
      reasonRemoved: dep?.reasonRemoved || null,
      paymentStartDates: Array.isArray(dep?.paymentStartDates)
        ? dep.paymentStartDates.map(toISODate).filter(Boolean)
        : []
    };
  }).filter((dep) => !!dep.name && !!dep.effectiveDate);
}

function getRatingEffectiveDate(scanData = {}) {
  const candidates = [
    scanData?.metadata?.effectiveDate,
    ...(Array.isArray(scanData?.metadata?.allEffectiveDates) ? scanData.metadata.allEffectiveDates : []),
    ...(Array.isArray(scanData?.effectiveDates) ? scanData.effectiveDates.map((item) => item?.date || item) : [])
  ]
    .map(toISODate)
    .filter(Boolean)
    .sort((a, b) => new Date(a) - new Date(b));

  return candidates[0] || toISODate(new Date());
}

function isDependentActiveOn(dep, dateStr) {
  const date = new Date(dateStr);
  const eff = new Date(dep.effectiveDate);
  const rem = dep.removalDate ? new Date(dep.removalDate) : null;

  if (date < eff) return false;
  if (rem && date >= rem) return false;
  return true;
}

function getActiveDependentsOnDate(dependents, dateStr) {
  return dependents.filter((dep) => isDependentActiveOn(dep, dateStr));
}

function getDependentCounts(activeDependents) {
  return {
    spouseCount: activeDependents.filter((d) => d.type === 'spouse').length,
    childCount: activeDependents.filter((d) => d.type === 'child').length,
    parentCount: activeDependents.filter((d) => d.type === 'parent').length
  };
}

function getRateCategorySet(rating, effectiveDate) {
  const veteranOnly = calculateCompensationQuote({
    rating,
    dependents: { spouse: 0, children: 0, parents: 0 },
    effectiveDate
  }).breakdown.totalMonthly;

  const withSpouse = calculateCompensationQuote({
    rating,
    dependents: { spouse: 1, children: 0, parents: 0 },
    effectiveDate
  }).breakdown.totalMonthly;

  const withSpouseOneChild = calculateCompensationQuote({
    rating,
    dependents: { spouse: 1, children: 1, parents: 0 },
    effectiveDate
  }).breakdown.totalMonthly;

  const withOneChild = calculateCompensationQuote({
    rating,
    dependents: { spouse: 0, children: 1, parents: 0 },
    effectiveDate
  }).breakdown.totalMonthly;

  const withSpouseTwoChildren = calculateCompensationQuote({
    rating,
    dependents: { spouse: 1, children: 2, parents: 0 },
    effectiveDate
  }).breakdown.totalMonthly;

  const withOneSpouseOneParent = calculateCompensationQuote({
    rating,
    dependents: { spouse: 1, children: 0, parents: 1 },
    effectiveDate
  }).breakdown.totalMonthly;

  const additionalChild = Number((withSpouseTwoChildren - withSpouseOneChild).toFixed(2));
  const additionalParent = Number((withOneSpouseOneParent - withSpouse).toFixed(2));

  const requiredKeys = {
    veteranOnly,
    withSpouse,
    withSpouseOneChild,
    withOneChild,
    additionalChild,
    additionalParent
  };

  Object.entries(requiredKeys).forEach(([key, value]) => {
    if (!Number.isFinite(value)) {
      throw new Error(`Rate table missing key: ${key}`);
    }
  });

  return requiredKeys;
}

function computeAmountFromCategories({ counts, categories }) {
  const { spouseCount, childCount, parentCount } = counts;
  let base = 0;

  if (spouseCount === 1 && childCount === 0) base = categories.withSpouse;
  if (spouseCount === 1 && childCount >= 1) base = categories.withSpouseOneChild;
  if (spouseCount === 0 && childCount >= 1) base = categories.withOneChild;
  if (spouseCount === 0 && childCount === 0) base = categories.veteranOnly;

  if (childCount > 1) {
    base += (childCount - 1) * categories.additionalChild;
  }

  if (parentCount > 0) {
    base += parentCount * categories.additionalParent;
  }

  return Number(base.toFixed(2));
}

function extractPaymentRows(scanData = {}) {
  return (Array.isArray(scanData?.payments) ? scanData.payments : [])
    .map((payment) => ({
      date: toISODate(payment?.startDate || payment?.effectiveDate),
      amount: Number(payment?.amount || 0)
    }))
    .filter((row) => row.date && Number.isFinite(row.amount) && row.amount > 0);
}

export function computeDependentCompensation(ratingPercent, rawDependents = [], scanData = {}) {
  const warnings = [];
  const dependents = normalizeDependents(rawDependents, warnings);
  const ratingEffectiveDate = getRatingEffectiveDate(scanData);

  const timelineDates = uniqueSortedDates([
    ratingEffectiveDate,
    ...dependents.map((dep) => dep.effectiveDate),
    ...dependents.map((dep) => dep.removalDate),
    ...dependents.flatMap((dep) => dep.paymentStartDates || []),
    ...extractPaymentRows(scanData).map((row) => row.date)
  ]);

  const compensationTimeline = timelineDates.map((date) => {
    const activeDependents = getActiveDependentsOnDate(dependents, date);
    const counts = getDependentCounts(activeDependents);

    const categories = getRateCategorySet(ratingPercent, date);
    const amount = computeAmountFromCategories({ counts, categories });

    return {
      date,
      amount,
      baseAmount: Number(categories.veteranOnly.toFixed(2)),
      dependentCounts: counts,
      additionalIncrements: {
        additionalChildAmount: categories.additionalChild,
        additionalParentAmount: categories.additionalParent
      },
      finalMonthlyAmount: amount,
      activeDependents: activeDependents.map((dep) => ({ name: dep.name, type: dep.type }))
    };
  });

  const paymentRows = extractPaymentRows(scanData);
  if (paymentRows.length > 0) {
    paymentRows.forEach((row) => {
      const computed = compensationTimeline.find((item) => item.date === row.date);
      if (!computed) return;
      if (Math.abs(computed.amount - row.amount) > 1) {
        throw new Error('Compensation mismatch — verify rate table or dependent counts.');
      }
    });
  }

  const spouseExists = dependents.some((dep) => dep.type === 'spouse');
  const spouseEverCounted = compensationTimeline.some((entry) => entry.dependentCounts.spouseCount > 0);
  if (spouseExists && !spouseEverCounted) {
    warnings.push({ message: 'Spouse exists but not counted.' });
  }

  dependents.forEach((dep) => {
    if (dep.type === 'child' && !dep.removalDate) {
      warnings.push({
        message: 'Child exists but removal date missing.',
        dependentName: dep.name
      });
    }
  });

  const dependentAdjustments = dependents
    .filter((dep) => !!dep.removalDate)
    .map((dep) => {
      const beforeDate = addDays(dep.removalDate, -1);
      const beforeEntry = compensationTimeline.find((item) => item.date === beforeDate) || (() => {
        const activeBefore = getActiveDependentsOnDate(dependents, beforeDate);
        const countsBefore = getDependentCounts(activeBefore);
        const categoriesBefore = getRateCategorySet(ratingPercent, beforeDate);
        const beforeAmount = computeAmountFromCategories({ counts: countsBefore, categories: categoriesBefore });
        return { amount: beforeAmount };
      })();

      const afterEntry = compensationTimeline.find((item) => item.date === dep.removalDate) || (() => {
        const activeAfter = getActiveDependentsOnDate(dependents, dep.removalDate);
        const countsAfter = getDependentCounts(activeAfter);
        const categoriesAfter = getRateCategorySet(ratingPercent, dep.removalDate);
        const afterAmount = computeAmountFromCategories({ counts: countsAfter, categories: categoriesAfter });
        return { amount: afterAmount };
      })();

      const adjustmentAmount = Number((beforeEntry.amount - afterEntry.amount).toFixed(2));

      return {
        name: dep.name,
        type: dep.type,
        removalDate: dep.removalDate,
        adjustmentAmount,
        newMonthlyAmount: afterEntry.amount
      };
    });

  const latest = compensationTimeline[compensationTimeline.length - 1];

  return {
    dependents,
    compensationTimeline,
    dependentAdjustments,
    finalMonthlyAmount: latest ? latest.amount : 0,
    warnings
  };
}
