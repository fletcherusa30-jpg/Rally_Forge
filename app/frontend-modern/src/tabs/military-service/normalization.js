import {
  BRANCH_VALUES,
  DISCHARGE_TYPE_VALUES,
  SERVICE_TYPE_VALUES,
} from './schema.js';

const MOS_PATTERN = /^(?:[0-9]{4}|[0-9]{2,4}[A-Z][A-Z0-9]{0,3}|[0-9][A-Z][A-Z0-9]{0,4}|[A-Z]{2,5}[0-9]?)$/;
const SEPARATION_CODE_PATTERN = /^[A-Z0-9]{3}$/;
const RE_PATTERN = /^(?:RE)?[1-4](?:[A-C])?$/;

const LOCATION_NORMALIZATION_MAP = {
  'OIF': 'Iraq',
  'OPERATION IRAQI FREEDOM': 'Iraq',
  'OEF': 'Afghanistan',
  'OPERATION ENDURING FREEDOM': 'Afghanistan',
  'SOUTHWEST ASIA': 'Southwest Asia',
  'PERSIAN GULF': 'Southwest Asia',
  'KOREAN DMZ': 'Korea DMZ',
};

export function dedupeCaseInsensitive(values = []) {
  const map = new Map();

  values.forEach((value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return;
    }

    const key = trimmed.toUpperCase();
    if (!map.has(key)) {
      map.set(key, trimmed);
    }
  });

  return Array.from(map.values());
}

export function normalizeMosCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function isValidMosCode(value) {
  const normalized = normalizeMosCode(value);
  return MOS_PATTERN.test(normalized);
}

export function normalizeSeparationCode(value) {
  const cleaned = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return SEPARATION_CODE_PATTERN.test(cleaned) ? cleaned : '';
}

export function normalizeSpdCode(value) {
  return normalizeSeparationCode(value);
}

export function normalizeReCode(value) {
  const cleaned = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  return RE_PATTERN.test(cleaned) ? cleaned : '';
}

export function normalizeDeploymentLocation(value, knownLocations = []) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const upper = raw.toUpperCase();
  const mapped = LOCATION_NORMALIZATION_MAP[upper] || raw;

  const match = knownLocations.find((item) => String(item || '').trim().toUpperCase() === mapped.toUpperCase());
  return match ? String(match) : mapped;
}

export function normalizeDeploymentLocations(values = [], knownLocations = []) {
  return dedupeCaseInsensitive(
    values
      .map((item) => normalizeDeploymentLocation(item, knownLocations))
      .filter(Boolean)
  );
}

export function validateSeparationAuthority(value) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }

  if (text.length < 3 || text.length > 140) {
    return false;
  }

  if (/[^a-zA-Z0-9\s.,()\-/]/.test(text)) {
    return false;
  }

  return true;
}

export function inferServiceEra(startDate, endDate) {
  const startYear = Number(String(startDate || '').slice(0, 4));
  const endYear = Number(String(endDate || '').slice(0, 4));
  const currentYear = new Date().getUTCFullYear();
  const begin = Number.isFinite(startYear) ? startYear : null;
  const finish = Number.isFinite(endYear) ? endYear : (begin != null ? currentYear : null);

  if (begin == null || finish == null) {
    return '';
  }

  const overlaps = (rangeStart, rangeEnd) => begin <= rangeEnd && finish >= rangeStart;
  if (overlaps(1941, 1945)) return 'WWII (1941-1945)';
  if (overlaps(1950, 1953)) return 'Korea (1950-1953)';
  if (overlaps(1964, 1975)) return 'Vietnam Era (1964-1975)';
  if (overlaps(1990, currentYear)) return 'Gulf War (1990-Present)';
  if (overlaps(2001, currentYear)) return 'Post-9/11 (2001-Present)';
  return 'Peacetime';
}

export function validateMilitaryServiceForm(form, knownDeploymentLocations = []) {
  const errors = [];

  if (!BRANCH_VALUES.includes(form.branchOfService)) {
    errors.push('Branch of service is invalid.');
  }

  if (!SERVICE_TYPE_VALUES.includes(form.serviceType)) {
    errors.push('Service type is invalid.');
  }

  const start = Date.parse(form.startDate);
  const end = Date.parse(form.endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    errors.push('Start date must be earlier than end date.');
  }

  if (!DISCHARGE_TYPE_VALUES.includes(form.dischargeType)) {
    errors.push('Discharge type is invalid.');
  }

  if (!String(form.primaryMOS || '').trim()) {
    errors.push('Primary MOS/AFSC/Rating is required.');
  } else if (!isValidMosCode(form.primaryMOS)) {
    errors.push('Primary MOS format is invalid.');
  }

  const invalidAdditionalMos = (form.additionalMOS || []).some((item) => !isValidMosCode(item));
  if (invalidAdditionalMos) {
    errors.push('One or more additional MOS entries are invalid.');
  }

  const allowedLocations = new Set(
    knownDeploymentLocations.map((item) => String(item || '').trim().toUpperCase())
  );

  const invalidLocations = (form.deploymentLocations || []).filter((location) => {
    const normalized = String(location || '').trim().toUpperCase();
    if (!normalized) {
      return true;
    }
    if (allowedLocations.size === 0) {
      return false;
    }
    return !allowedLocations.has(normalized);
  });

  if (invalidLocations.length > 0) {
    errors.push('One or more deployment locations are invalid.');
  }

  return errors;
}
