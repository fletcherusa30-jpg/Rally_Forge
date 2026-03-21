import { describe, expect, it } from 'vitest';
import {
  CLAIM_DATA_UNIFIED_ENGINE_CHAIN,
  CLAIM_DATA_UNIFIED_REQUIRED_KEYS,
  CLAIM_DATA_UNIFIED_SCHEMA,
  CLAIM_DATA_UNIFIED_NORMALIZATION_RULES,
  validateClaimDataUnifiedShape,
} from '../schemas/claimDataUnified.schema.js';

describe('Schema Compliance - claimDataUnified', () => {
  it('defines required unified keys', () => {
    expect(CLAIM_DATA_UNIFIED_REQUIRED_KEYS).toEqual([
      'profile',
      'service',
      'str',
      'currentTreatment',
      'ratingDecision',
      'timeline',
      'derivedSignals',
      'generatedConditions',
      'layStatement',
      'evidenceIndex',
    ]);
  });

  it('includes required engine chain definitions', () => {
    expect(CLAIM_DATA_UNIFIED_ENGINE_CHAIN).toContain('conditionGenerator');
    expect(CLAIM_DATA_UNIFIED_ENGINE_CHAIN).toContain('derivedSignals');
    expect(CLAIM_DATA_UNIFIED_ENGINE_CHAIN).toContain('layStatement');
    expect(CLAIM_DATA_UNIFIED_ENGINE_CHAIN).toContain('evidenceIndex');
    expect(CLAIM_DATA_UNIFIED_ENGINE_CHAIN).toContain('timelineBuilder');
  });

  it('includes normalization rule declarations', () => {
    expect(Array.isArray(CLAIM_DATA_UNIFIED_NORMALIZATION_RULES)).toBe(true);
    expect(CLAIM_DATA_UNIFIED_NORMALIZATION_RULES.length).toBeGreaterThan(0);
  });

  it('validates required shape keys', () => {
    const candidate = {
      profile: {},
      service: [],
      str: {},
      currentTreatment: {},
      ratingDecision: {},
      timeline: [],
      derivedSignals: {},
      generatedConditions: [],
      layStatement: '',
      evidenceIndex: [],
    };

    expect(validateClaimDataUnifiedShape(candidate)).toBe(true);
    expect(validateClaimDataUnifiedShape({ profile: {} })).toBe(false);
  });

  it('schema object includes every required key', () => {
    CLAIM_DATA_UNIFIED_REQUIRED_KEYS.forEach((key) => {
      expect(Object.prototype.hasOwnProperty.call(CLAIM_DATA_UNIFIED_SCHEMA, key)).toBe(true);
    });
  });
});
