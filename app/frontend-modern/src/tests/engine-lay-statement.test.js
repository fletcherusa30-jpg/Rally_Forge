import { describe, expect, it } from 'vitest';
import { runLayStatementEngine } from '../engine/layStatement/index.js';
import { runConditionGeneratorEngine } from '../engine/conditionGenerator/index.js';

// ── Test fixture helpers ───────────────────────────────────────────────────────

function buildUnified(overrides = {}) {
  return {
    profile: { firstName: 'Robert', lastName: 'Johnson', dateOfBirth: '1972-03-10', ...overrides.profile },
    service: overrides.service ?? [
      // engine reads branchOfService (not branch) and primaryMOS (not mos)
      { branchOfService: 'Marine Corps', primaryMOS: '0311', startDate: '1990-09-01', endDate: '1994-09-01', serviceType: 'Active', dischargeType: 'Honorable', combatVeteran: true, hazardPayIndicators: [], deploymentLocations: ['Kuwait'] },
    ],
    str: overrides.str ?? {
      extractedFindings: { diagnoses: ['Tinnitus', 'Hearing Loss'], injuries: [], events: ['artillery noise exposure'] },
      manualEntries: [],
    },
    currentTreatment: overrides.currentTreatment ?? {
      extractedFindings: {
        currentConditions: ['tinnitus', 'hearing loss'],
        functionalLimitations: ['difficulty hearing conversations'],
        treatmentEvents: ['audiology eval 2022'],
        evidenceSnippets: ['audiogram 45dB loss bilateral'],
      },
      manualEntries: [],
    },
    ratingDecision: overrides.ratingDecision ?? {
      manualEntries: [],
      extractedFindings: { serviceConnectedConditions: [], deniedConditions: [] },
      conflicts: [],
    },
    derivedSignals: overrides.derivedSignals ?? {
      exposures: ['hazardous noise', 'combat service'],
      presumptives: [],
      secondaryCandidates: [],
      worseningIndicators: [],
      unratedConditions: ['tinnitus', 'hearing loss'],
    },
  };
}

function buildConditions(unified) {
  return runConditionGeneratorEngine(unified);
}

// ── Lay Statement Engine: Return Type ─────────────────────────────────────────

describe('Lay Statement Engine — Return Type', () => {
  it('returns a string', () => {
    const unified = buildUnified();
    const result = runLayStatementEngine(unified, buildConditions(unified));
    expect(typeof result).toBe('string');
  });

  it('returns an empty string for empty conditions array', () => {
    expect(runLayStatementEngine(buildUnified(), [])).toBe('');
  });

  it('returns a non-empty string when conditions are provided', () => {
    const unified = buildUnified();
    const statement = runLayStatementEngine(unified, buildConditions(unified));
    expect(statement.length).toBeGreaterThan(0);
  });
});

// ── Lay Statement Engine: Veteran Identity ────────────────────────────────────

describe('Lay Statement Engine — Veteran Identity', () => {
  it('includes the veteran first name', () => {
    const unified = buildUnified();
    const statement = runLayStatementEngine(unified, buildConditions(unified));
    expect(statement).toContain('Robert');
  });

  it('includes the veteran last name', () => {
    const unified = buildUnified();
    const statement = runLayStatementEngine(unified, buildConditions(unified));
    expect(statement).toContain('Johnson');
  });

  it('references branch of service', () => {
    const unified = buildUnified();
    const statement = runLayStatementEngine(unified, buildConditions(unified));
    expect(statement).toMatch(/marine|marine corps|army|navy|air force/i);
  });

  it('includes service dates or years', () => {
    const unified = buildUnified();
    const statement = runLayStatementEngine(unified, buildConditions(unified));
    // Should mention at least one year from 1990-1994 service
    expect(statement).toMatch(/199[0-9]/);
  });
});

// ── Lay Statement Engine: Condition Coverage ──────────────────────────────────

describe('Lay Statement Engine — Condition Coverage', () => {
  it('mentions at least one generated condition name', () => {
    const unified = buildUnified();
    const conditions = buildConditions(unified);
    const statement = runLayStatementEngine(unified, conditions);
    const mentionsOne = conditions.some((c) =>
      statement.toLowerCase().includes(c.conditionName.toLowerCase())
    );
    expect(mentionsOne).toBe(true);
  });

  it('statement does not contain undefined or [object Object] placeholders', () => {
    const unified = buildUnified();
    const statement = runLayStatementEngine(unified, buildConditions(unified));
    expect(statement).not.toContain('undefined');
    expect(statement).not.toContain('[object Object]');
    expect(statement).not.toContain('null');
  });
});

// ── Lay Statement Engine: Section Presence ────────────────────────────────────

describe('Lay Statement Engine — Section Presence', () => {
  it('contains an in-service events or service history section', () => {
    const unified = buildUnified();
    const statement = runLayStatementEngine(unified, buildConditions(unified));
    expect(statement).toMatch(/service|in.service|served/i);
  });

  it('contains a current symptoms or condition section', () => {
    const unified = buildUnified();
    const statement = runLayStatementEngine(unified, buildConditions(unified));
    expect(statement).toMatch(/symptom|current|treatment|condition/i);
  });

  it('does not include a rating history section when ratingDecision is empty', () => {
    const unified = buildUnified({
      ratingDecision: { manualEntries: [], extractedFindings: { serviceConnectedConditions: [], deniedConditions: [] }, conflicts: [] },
    });
    const statement = runLayStatementEngine(unified, buildConditions(unified));
    // Should not claim there were prior ratings when none exist
    expect(statement).not.toMatch(/previously rated|prior rating|denied in \d{4}/i);
  });
});

// ── Lay Statement Engine: Multiple Condition Handling ─────────────────────────

describe('Lay Statement Engine — Multiple Condition Handling', () => {
  it('handles a single condition without errors', () => {
    const unified = buildUnified({
      str: { extractedFindings: { diagnoses: ['Tinnitus'], injuries: [], events: [] }, manualEntries: [] },
      derivedSignals: { exposures: [], presumptives: [], secondaryCandidates: [], worseningIndicators: [], unratedConditions: ['tinnitus'] },
    });
    const conditions = buildConditions(unified);
    expect(() => runLayStatementEngine(unified, conditions)).not.toThrow();
  });

  it('handles multiple conditions without errors', () => {
    const unified = buildUnified();
    const conditions = buildConditions(unified);
    expect(() => runLayStatementEngine(unified, conditions)).not.toThrow();
  });

  it('lay statement length scales with number of conditions (more conditions = longer statement)', () => {
    const singleUnified = buildUnified({
      str: { extractedFindings: { diagnoses: ['Tinnitus'], injuries: [], events: [] }, manualEntries: [] },
      currentTreatment: { extractedFindings: { currentConditions: ['tinnitus'], functionalLimitations: [], treatmentEvents: [], evidenceSnippets: [] }, manualEntries: [] },
      derivedSignals: { exposures: [], presumptives: [], secondaryCandidates: [], worseningIndicators: [], unratedConditions: ['tinnitus'] },
    });
    const multiUnified = buildUnified();
    const singleStatement = runLayStatementEngine(singleUnified, buildConditions(singleUnified));
    const multiStatement = runLayStatementEngine(multiUnified, buildConditions(multiUnified));
    // More conditions generally means a longer document
    expect(multiStatement.length).toBeGreaterThanOrEqual(singleStatement.length);
  });
});
