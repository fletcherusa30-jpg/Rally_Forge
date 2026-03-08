const getValue = (source, path) => {
  if (!path) {
    return undefined;
  }

  return path.split(".").reduce((value, key) => {
    if (value === null || value === undefined) {
      return undefined;
    }
    return value[key];
  }, source);
};

const matchesCondition = (condition, data) => {
  const { field, operator, value } = condition;
  const actual = getValue(data, field);

  switch (operator) {
    case "eq":
      return actual === value;
    case "neq":
      return actual !== value;
    case "gte":
      return typeof actual === "number" && actual >= value;
    case "lte":
      return typeof actual === "number" && actual <= value;
    case "in":
      return Array.isArray(value) && value.includes(actual);
    case "contains":
      if (Array.isArray(actual)) {
        return actual.includes(value);
      }
      if (typeof actual === "string") {
        return actual.includes(value);
      }
      return false;
    case "exists":
      return value ? actual !== undefined && actual !== null : actual === undefined || actual === null;
    default:
      return false;
  }
};

export const evaluateRuleSet = (ruleSet, data) => {
  const items = [];
  const notes = [];

  ruleSet.rules.forEach((rule) => {
    const matches = rule.conditions.every((condition) => matchesCondition(condition, data));
    if (!matches) {
      return;
    }

    rule.outcomes.forEach((outcome) => {
      items.push({
        title: outcome.title,
        description: outcome.description,
        link: outcome.link,
        tags: outcome.tags || [],
        ruleId: rule.id,
        ruleDescription: rule.description,
        ruleTags: rule.tags || [],
        ruleConditions: rule.conditions || []
      });
    });

    if (rule.notes) {
      notes.push(...(Array.isArray(rule.notes) ? rule.notes : [rule.notes]));
    }
  });

  return { items, notes };
};

export const buildFacts = (onboardingResult) => {
  const periods = Array.isArray(onboardingResult.servicePeriods)
    ? onboardingResult.servicePeriods
    : [];
  const theaters = Array.from(
    new Set(
      periods
        .map((period) => period.theater)
        .filter((theater) => Boolean(theater))
    )
  );
  const activeService = periods.some((period) => !period.endDate);

  return {
    servicePeriodCount: periods.length,
    theaters,
    activeService
  };
};

