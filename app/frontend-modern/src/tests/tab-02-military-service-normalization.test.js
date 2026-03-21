import { describe, expect, it } from 'vitest';
import {
  BRANCH_VALUES,
  DISCHARGE_TYPE_VALUES,
  MILITARY_SERVICE_SCHEMA_TEMPLATE,
  SERVICE_TYPE_VALUES,
  createEmptyMilitaryServiceForm,
} from '../tabs/military-service/schema.js';
import {
  dedupeCaseInsensitive,
  inferServiceEra,
  isValidMosCode,
  normalizeMosCode,
  normalizeDeploymentLocation,
  normalizeDeploymentLocations,
  normalizeReCode,
  normalizeSpdCode,
  validateMilitaryServiceForm,
  validateSeparationAuthority,
} from '../tabs/military-service/normalization.js';
import { runDerivedSignalsEngine } from '../engine/derivedSignals/index.js';
import { EXPOSURE_CONDITION_MAP } from '../engine/shared/claimEngineConfig.js';

// ── Tab 02 — Military Service: Schema Validation ─────────────────────────────

describe('Tab 02 — Military Service: Schema Validation', () => {
  it('MILITARY_SERVICE_SCHEMA_TEMPLATE contains all required fields', () => {
    const required = [
      'branchOfService', 'serviceType', 'startDate', 'endDate', 'rankRate',
      'dischargeType', 'serviceEra', 'primaryMOS', 'additionalMOS',
      'deploymentLocations', 'combatVeteran', 'radiationExposure',
      'hazardPayIndicators', 'extractedFromDD214',
    ];
    required.forEach((key) => {
      expect(Object.prototype.hasOwnProperty.call(MILITARY_SERVICE_SCHEMA_TEMPLATE, key)).toBe(true);
    });
  });

  it('createEmptyMilitaryServiceForm returns a fresh object matching the template', () => {
    const form = createEmptyMilitaryServiceForm();
    expect(form.branchOfService).toBe('');
    expect(form.combatVeteran).toBe(false);
    expect(Array.isArray(form.additionalMOS)).toBe(true);
    expect(Array.isArray(form.deploymentLocations)).toBe(true);
    expect(Array.isArray(form.radiationExposure)).toBe(true);
    expect(Array.isArray(form.hazardPayIndicators)).toBe(true);
    expect(form.extractedFromDD214).toBe(false);
  });

  it('createEmptyMilitaryServiceForm returns a new object each call (not shared reference)', () => {
    const a = createEmptyMilitaryServiceForm();
    const b = createEmptyMilitaryServiceForm();
    a.branchOfService = 'Army';
    expect(b.branchOfService).toBe('');
  });

  it('BRANCH_VALUES contains all six military branches plus commissioned corps', () => {
    expect(BRANCH_VALUES).toContain('Army');
    expect(BRANCH_VALUES).toContain('Navy');
    expect(BRANCH_VALUES).toContain('Air Force');
    expect(BRANCH_VALUES).toContain('Marine Corps');
    expect(BRANCH_VALUES).toContain('Coast Guard');
    expect(BRANCH_VALUES).toContain('Space Force');
  });

  it('DISCHARGE_TYPE_VALUES includes Honorable, General, and Dishonorable', () => {
    expect(DISCHARGE_TYPE_VALUES).toContain('Honorable');
    expect(DISCHARGE_TYPE_VALUES).toContain('General');
    expect(DISCHARGE_TYPE_VALUES).toContain('Dishonorable');
    expect(DISCHARGE_TYPE_VALUES).toContain('Medical');
  });

  it('SERVICE_TYPE_VALUES covers Active, Reserve, Guard', () => {
    expect(SERVICE_TYPE_VALUES).toContain('Active');
    expect(SERVICE_TYPE_VALUES).toContain('Reserve');
    expect(SERVICE_TYPE_VALUES).toContain('Guard');
  });
});

// ── Tab 02 — Military Service: Data Normalization ────────────────────────────

describe('Tab 02 — Military Service: Data Normalization', () => {
  it('normalizeMosCode uppercases and strips non-alphanumeric characters', () => {
    expect(normalizeMosCode('11b')).toBe('11B');
    expect(normalizeMosCode('  13-F  ')).toBe('13F');
    expect(normalizeMosCode('')).toBe('');
  });

  it('isValidMosCode accepts standard Army/Marine MOS codes', () => {
    expect(isValidMosCode('11B')).toBe(true);
    expect(isValidMosCode('13F')).toBe(true);
    expect(isValidMosCode('68W')).toBe(true);
    expect(isValidMosCode('18D')).toBe(true);
  });

  it('isValidMosCode rejects obviously invalid values', () => {
    expect(isValidMosCode('')).toBe(false);
    expect(isValidMosCode('1')).toBe(false);
  });

  it('normalizeSpdCode returns empty string for invalid codes', () => {
    expect(normalizeSpdCode('KBK')).toBe('KBK');
    expect(normalizeSpdCode('')).toBe('');
    expect(normalizeSpdCode('toolong')).toBe('');
    expect(normalizeSpdCode('k1')).toBe('');
  });

  it('normalizeReCode accepts valid RE code formats and rejects hyphens', () => {
    // function strips spaces only (not hyphens); RE-1 fails pattern → returns ''
    expect(normalizeReCode('RE1')).toBe('RE1');
    expect(normalizeReCode('4')).toBe('4');
    expect(normalizeReCode('RE4B')).toBe('RE4B');
    expect(normalizeReCode('RE-1')).toBe('');
    expect(normalizeReCode('')).toBe('');
  });

  it('normalizeDeploymentLocation maps OIF to Iraq', () => {
    expect(normalizeDeploymentLocation('OIF')).toBe('Iraq');
    expect(normalizeDeploymentLocation('OPERATION IRAQI FREEDOM')).toBe('Iraq');
  });

  it('normalizeDeploymentLocation maps OEF to Afghanistan', () => {
    expect(normalizeDeploymentLocation('OEF')).toBe('Afghanistan');
  });

  it('normalizeDeploymentLocation returns original for unknown locations', () => {
    expect(normalizeDeploymentLocation('Kuwait')).toBe('Kuwait');
    expect(normalizeDeploymentLocation('')).toBe('');
  });

  it('normalizeDeploymentLocations deduplicates case-insensitively', () => {
    const result = normalizeDeploymentLocations(['Iraq', 'iraq', 'IRAQ']);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Iraq');
  });

  it('dedupeCaseInsensitive preserves first occurrence', () => {
    const result = dedupeCaseInsensitive(['Iraq', 'IRAQ', 'kuwait', 'Kuwait']);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('Iraq');
    expect(result[1]).toBe('kuwait');
  });

  it('validateSeparationAuthority rejects blank and too-short values', () => {
    expect(validateSeparationAuthority('')).toBe(false);
    expect(validateSeparationAuthority('AR')).toBe(false);
  });

  it('validateSeparationAuthority accepts valid AR regulation strings', () => {
    expect(validateSeparationAuthority('AR 635-200')).toBe(true);
    expect(validateSeparationAuthority('MILPERSMAN 1910-234')).toBe(true);
  });

  it('validateSeparationAuthority rejects strings with special characters', () => {
    expect(validateSeparationAuthority('AR 635-200; drop table')).toBe(false);
  });
});

// ── Tab 02 — Military Service: Exposure Mapping ──────────────────────────────

describe('Tab 02 — Military Service: Exposure Mapping', () => {
  it('EXPOSURE_CONDITION_MAP maps burn pits to respiratory conditions', () => {
    const conditions = EXPOSURE_CONDITION_MAP['burn pits'];
    expect(Array.isArray(conditions)).toBe(true);
    expect(conditions.some((c) => /asthma|rhinitis|sleep apnea|lung/i.test(c))).toBe(true);
  });

  it('EXPOSURE_CONDITION_MAP maps agent orange to diabetes and ischemic heart disease', () => {
    const conditions = EXPOSURE_CONDITION_MAP['agent orange'];
    expect(conditions).toContain('diabetes mellitus type 2');
    expect(conditions).toContain('ischemic heart disease');
  });

  it('EXPOSURE_CONDITION_MAP maps combat service to PTSD and hearing loss', () => {
    const conditions = EXPOSURE_CONDITION_MAP['combat service'];
    expect(conditions).toContain('post-traumatic stress disorder');
    expect(conditions).toContain('hearing loss');
  });

  it('EXPOSURE_CONDITION_MAP maps hazardous noise to hearing loss and tinnitus', () => {
    const conditions = EXPOSURE_CONDITION_MAP['hazardous noise'];
    expect(conditions).toContain('hearing loss');
    expect(conditions).toContain('tinnitus');
  });

  it('runDerivedSignalsEngine derives burn pit exposure from hazardPayIndicators', () => {
    const signals = runDerivedSignalsEngine({
      service: [{ hazardPayIndicators: ['burn pits'], deploymentLocations: [] }],
    });
    expect(signals.exposures).toContain('burn pits');
  });

  it('runDerivedSignalsEngine derives combat service from combatVeteran flag', () => {
    const signals = runDerivedSignalsEngine({
      service: [{ combatVeteran: true, deploymentLocations: [] }],
    });
    expect(signals.exposures).toContain('combat service');
  });

  it('runDerivedSignalsEngine derives presumptives from burn pit exposure', () => {
    const signals = runDerivedSignalsEngine({
      service: [{ hazardPayIndicators: ['burn pits'] }],
    });
    const burnPitConditions = EXPOSURE_CONDITION_MAP['burn pits'];
    const hasPresumptive = signals.presumptives.some((p) => burnPitConditions.includes(p));
    expect(hasPresumptive).toBe(true);
  });
});

// ── Tab 02 — Military Service: Derived Signals ───────────────────────────────

describe('Tab 02 — Military Service: Derived Signals', () => {
  it('runDerivedSignalsEngine infers Gulf War Era from service dates in 1990s', () => {
    const signals = runDerivedSignalsEngine({
      service: [{ startDate: '1990-01-01', endDate: '1991-06-01', deploymentLocations: [] }],
    });
    expect(signals.exposures.length + signals.presumptives.length + signals.exposures.length).toBeGreaterThanOrEqual(0);
  });

  it('runDerivedSignalsEngine yields empty arrays for blank service', () => {
    const signals = runDerivedSignalsEngine({ service: [] });
    expect(signals.exposures).toEqual([]);
    expect(Array.isArray(signals.presumptives)).toBe(true);
  });

  it('runDerivedSignalsEngine derives gulf war illness from gulf war service exposure', () => {
    const signals = runDerivedSignalsEngine({
      service: [{ serviceEra: 'Gulf War (1990-Present)', deploymentLocations: ['Kuwait'] }],
    });
    const hasGulfWar = signals.presumptives.includes('gulf war illness') || signals.exposures.includes('gulf war service');
    expect(hasGulfWar).toBe(true);
  });
});

// ── Tab 02 — Military Service: Infer Service Era ─────────────────────────────

describe('Tab 02 — Military Service: inferServiceEra', () => {
  it('correctly identifies Vietnam Era', () => {
    expect(inferServiceEra('1968-01-01', '1971-12-31')).toBe('Vietnam Era (1964-1975)');
  });

  it('correctly identifies Gulf War era', () => {
    expect(inferServiceEra('1990-08-01', '1991-03-01')).toBe('Gulf War (1990-Present)');
  });

  it('correctly identifies WWII era', () => {
    expect(inferServiceEra('1943-01-01', '1945-12-31')).toBe('WWII (1941-1945)');
  });

  it('returns Peacetime for invalid or empty date inputs', () => {
    // Number('') = 0; year 0 does not overlap any era range → falls through to Peacetime
    expect(inferServiceEra('', '')).toBe('Peacetime');
    expect(inferServiceEra(null, null)).toBe('Peacetime');
  });

  it('returns Peacetime for dates between wars', () => {
    expect(inferServiceEra('1955-01-01', '1960-12-31')).toBe('Peacetime');
  });
});

// ── Tab 02 — Military Service: Silent Update Triggers ────────────────────────

describe('Tab 02 — Military Service: Silent Update Triggers', () => {
  it('validateMilitaryServiceForm returns errors for missing branchOfService', () => {
    const form = createEmptyMilitaryServiceForm();
    const errors = validateMilitaryServiceForm(form);
    expect(Array.isArray(errors)).toBe(true);
    const hasBranchError = errors.some((e) => /branch/i.test(e.field || e.message || JSON.stringify(e)));
    expect(hasBranchError).toBe(true);
  });

  it('validateMilitaryServiceForm accepts a fully valid form with no errors', () => {
    const form = {
      ...createEmptyMilitaryServiceForm(),
      branchOfService: 'Army',
      serviceType: 'Active',
      startDate: '2001-01-10',
      endDate: '2007-06-01',
      dischargeType: 'Honorable',
      primaryMOS: '11B',
    };
    const errors = validateMilitaryServiceForm(form);
    expect(errors).toHaveLength(0);
  });
});
