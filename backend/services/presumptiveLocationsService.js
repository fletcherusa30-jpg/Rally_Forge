import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const knowledgePath = path.join(__dirname, '..', '..', 'knowledge', 'presumptive-locations.json');

function normalizeLocation(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseDate(value) {
  if (!value || value === 'present') {
    return new Date('9999-12-31T00:00:00.000Z');
  }
  return new Date(`${value}T00:00:00.000Z`);
}

function hasDateOverlap(startA, endA, startB, endB) {
  const aStart = parseDate(startA);
  const aEnd = parseDate(endA || 'present');
  const bStart = parseDate(startB);
  const bEnd = parseDate(endB || 'present');
  return aStart <= bEnd && bStart <= aEnd;
}

export async function loadPresumptiveKnowledge() {
  const raw = await fs.readFile(knowledgePath, 'utf-8');
  const parsed = JSON.parse(raw);
  const categories = Array.isArray(parsed.categories) ? parsed.categories : [];
  return {
    version: parsed.version || null,
    categories,
  };
}

export function getFlattenedPresumptiveLocations(knowledge) {
  const categories = Array.isArray(knowledge?.categories) ? knowledge.categories : [];
  return categories.flatMap((category) => {
    const locations = Array.isArray(category.locations) ? category.locations : [];
    return locations.map((location) => ({
      location: location.name,
      category: category.id,
      categoryLabel: category.label,
    }));
  });
}

export function getPresumptiveExposureRules(knowledge) {
  const categories = Array.isArray(knowledge?.categories) ? knowledge.categories : [];
  return categories.flatMap((category) => {
    const locations = Array.isArray(category.locations) ? category.locations : [];
    return locations.flatMap((location) => {
      const dateRanges = Array.isArray(location.dateRanges) ? location.dateRanges : [];
      return dateRanges.map((dateRange) => ({
        location: location.name,
        aliases: Array.isArray(location.aliases) ? location.aliases : [],
        category: category.id,
        categoryLabel: category.label,
        start: dateRange.start,
        end: dateRange.end,
      }));
    });
  });
}

export function matchDeploymentToPresumptive(deployment, exposureRules) {
  const location = String(deployment?.location || '').trim();
  const normalized = normalizeLocation(location);
  const startDate = deployment?.startDate || null;
  const endDate = deployment?.endDate || 'present';

  const rules = Array.isArray(exposureRules) ? exposureRules : [];
  const matchedRule = rules.find((rule) => {
    const locationNames = [rule.location, ...(Array.isArray(rule.aliases) ? rule.aliases : [])]
      .map((name) => normalizeLocation(name));
    if (!locationNames.includes(normalized)) {
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
