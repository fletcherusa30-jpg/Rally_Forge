function normalizeLocation(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseDate(value) {
  if (!value || value === 'present') {
    return new Date('9999-12-31T00:00:00.000Z');
  }
  return new Date(`${value}T00:00:00.000Z`);
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function hasDateOverlap(startA, endA, startB, endB) {
  const aStart = parseDate(startA);
  const aEnd = parseDate(endA || 'present');
  const bStart = parseDate(startB);
  const bEnd = parseDate(endB || 'present');

  if (!isValidDate(aStart) || !isValidDate(aEnd) || !isValidDate(bStart) || !isValidDate(bEnd)) {
    return false;
  }

  return aStart <= bEnd && bStart <= aEnd;
}

export function getDropdownLocations(knowledgePayload) {
  const locations = Array.isArray(knowledgePayload?.locations) ? knowledgePayload.locations : [];
  return locations
    .map((item) => ({
      value: item.location,
      label: `${item.location} (${item.categoryLabel})`,
      category: item.category,
      categoryLabel: item.categoryLabel,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function getExposureRules(knowledgePayload) {
  return Array.isArray(knowledgePayload?.exposureRules) ? knowledgePayload.exposureRules : [];
}

export function buildDeploymentEvidence(deployment, exposureRules) {
  const location = String(deployment?.location || '').trim();
  const normalized = normalizeLocation(location);
  const startDate = deployment?.startDate || null;
  const endDate = deployment?.endDate || 'present';

  const matchedRule = (Array.isArray(exposureRules) ? exposureRules : []).find((rule) => {
    const names = [rule.location, ...(Array.isArray(rule.aliases) ? rule.aliases : [])]
      .map((name) => normalizeLocation(name));

    if (!names.includes(normalized)) {
      return false;
    }

    if (!startDate) {
      return true;
    }

    return hasDateOverlap(startDate, endDate, rule.start, rule.end);
  });

  return {
    type: 'Deployment',
    location,
    startDate: deployment?.startDate || '',
    endDate: deployment?.endDate || '',
    presumptiveMatch: Boolean(matchedRule),
    matchedCategory: matchedRule?.categoryLabel || null,
    matchedDateRange: matchedRule
      ? {
          start: matchedRule.start,
          end: matchedRule.end,
        }
      : null,
  };
}

export { hasDateOverlap };
