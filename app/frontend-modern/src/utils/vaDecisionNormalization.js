export function normalizeDecisionCondition(item) {
  return {
    label: String(
      item?.label
      || item?.condition
      || (typeof item === 'string' ? item : '')
    ).trim(),
    percentage: Number(item?.percentage || 0),
    reasons: Array.isArray(item?.reasons) ? item.reasons.filter(Boolean) : [],
  };
}
