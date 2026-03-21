import { describe, expect, it } from 'vitest';
import { normalizeDecisionCondition } from '../utils/vaDecisionNormalization.js';

describe('normalizeDecisionCondition', () => {
  it('maps manual-entry condition objects to label', () => {
    const input = {
      condition: 'Sleep Apnea',
      percentage: 50,
      reasons: ['CPAP prescribed'],
    };

    const normalized = normalizeDecisionCondition(input);

    expect(normalized.label).toBe('Sleep Apnea');
    expect(normalized.percentage).toBe(50);
    expect(normalized.reasons).toEqual(['CPAP prescribed']);
  });

  it('prefers explicit label when both label and condition exist', () => {
    const normalized = normalizeDecisionCondition({
      label: 'Migraines',
      condition: 'Migraine Headaches',
      percentage: '30',
    });

    expect(normalized.label).toBe('Migraines');
    expect(normalized.percentage).toBe(30);
  });

  it('handles string conditions and non-array reasons safely', () => {
    const normalized = normalizeDecisionCondition('Tinnitus');

    expect(normalized).toEqual({
      label: 'Tinnitus',
      percentage: 0,
      reasons: [],
    });
  });
});
