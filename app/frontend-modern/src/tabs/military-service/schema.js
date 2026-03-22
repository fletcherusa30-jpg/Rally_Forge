export const BRANCH_VALUES = [
  'Army',
  'Navy',
  'Air Force',
  'Marine Corps',
  'Coast Guard',
  'Space Force',
  'Public Health Service Commissioned Corps (USPHS)',
  'NOAA Commissioned Officer Corps',
];

export const SERVICE_TYPE_VALUES = ['Active', 'Reserve', 'Guard'];

export const DISCHARGE_TYPE_VALUES = [
  'Honorable',
  'General',
  'Other Than Honorable',
  'Bad Conduct',
  'Dishonorable',
  'Uncharacterized',
  'Entry Level Separation',
  'Medical',
  'Retirement',
];

export const SERVICE_ERA_VALUES = [
  'WWII (1941-1945)',
  'Korea (1950-1953)',
  'Vietnam Era (1964-1975)',
  'Gulf War (1990-Present)',
  'Post-9/11 (2001-Present)',
  'Peacetime',
];

function buildRange(prefix, start, end) {
  const values = [];
  for (let value = start; value <= end; value += 1) {
    values.push(`${prefix}-${value}`);
  }
  return values;
}

const RANK_RATE_OPTIONS_BY_BRANCH = {
  Army: [
    ...buildRange('E', 1, 9),
    ...buildRange('W', 1, 5),
    ...buildRange('O', 1, 10),
  ],
  'Marine Corps': [
    ...buildRange('E', 1, 9),
    ...buildRange('W', 1, 5),
    ...buildRange('O', 1, 10),
  ],
  Navy: [
    ...buildRange('E', 1, 9),
    ...buildRange('W', 2, 5),
    ...buildRange('O', 1, 10),
  ],
  'Coast Guard': [
    ...buildRange('E', 1, 9),
    ...buildRange('W', 2, 5),
    ...buildRange('O', 1, 10),
  ],
  'Air Force': [
    ...buildRange('E', 1, 9),
    ...buildRange('O', 1, 10),
  ],
  'Space Force': [
    ...buildRange('E', 1, 9),
    ...buildRange('O', 1, 10),
  ],
  'Public Health Service Commissioned Corps (USPHS)': [
    ...buildRange('O', 1, 10),
  ],
  'NOAA Commissioned Officer Corps': [
    ...buildRange('O', 1, 10),
  ],
};

export function getRankRateOptionsForBranch(branchOfService) {
  const branch = String(branchOfService || '').trim();
  return RANK_RATE_OPTIONS_BY_BRANCH[branch] || [];
}

export function getMosTypesForRankRate(rankRate) {
  const prefix = String(rankRate || '').trim().toUpperCase().charAt(0);

  if (prefix === 'E') {
    return ['enlisted'];
  }

  if (prefix === 'W') {
    return ['warrant'];
  }

  if (prefix === 'O') {
    return ['officer'];
  }

  return [];
}

export const MILITARY_SERVICE_SCHEMA_TEMPLATE = {
  branchOfService: '',
  serviceType: '',
  startDate: '',
  endDate: '',
  rankRate: '',
  dischargeType: '',
  serviceEra: '',
  primaryMOS: '',
  additionalMOS: [],
  deploymentLocations: [],
  combatVeteran: false,
  radiationExposure: [],
  hazardPayIndicators: [],
  extractedFromDD214: false,
};

export function createEmptyMilitaryServiceForm() {
  return { ...MILITARY_SERVICE_SCHEMA_TEMPLATE };
}
