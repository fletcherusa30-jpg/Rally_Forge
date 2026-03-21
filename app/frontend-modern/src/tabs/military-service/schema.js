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
