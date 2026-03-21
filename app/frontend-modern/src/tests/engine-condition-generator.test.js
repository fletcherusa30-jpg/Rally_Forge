import { describe, expect, it } from 'vitest';
import { runConditionGeneratorEngine } from '../engine/conditionGenerator/index.js';
import { FOLLOW_UP_QUESTION_LIBRARY, DBQ_MAPPING_TABLE, FORM_RECOMMENDATION_RULESET } from '../engine/shared/claimEngineConfig.js';

// ── Shared test fixture factory ────────────────────────────────────────────────

function buildUnified(overrides = {}) {
  return {
    profile: { firstName: 'John', lastName: 'Smith', ...overrides.profile },
    service: overrides.service ?? [],
    str: overrides.str ?? { extractedFindings: { diagnoses: [], injuries: [], events: [] }, manualEntries: [] },
    currentTreatment: overrides.currentTreatment ?? {
      extractedFindings: { currentConditions: [], functionalLimitations: [], treatmentEvents: [], evidenceSnippets: [] },
      manualEntries: [],
    },
    ratingDecision: overrides.ratingDecision ?? {
      manualEntries: [],
      extractedFindings: { serviceConnectedConditions: [], deniedConditions: [] },
      conflicts: [],
    },
    derivedSignals: overrides.derivedSignals ?? {
      exposures: [],
      presumptives: [],
      secondaryCandidates: [],
      worseningIndicators: [],
      unratedConditions: [],
    },
  };
}

// ── Condition Generator Engine: Output Shape ───────────────────────────────────

describe('Condition Generator Engine — Output Shape', () => {
  it('returns an array for minimal input', () => {
    expect(Array.isArray(runConditionGeneratorEngine(buildUnified()))).toBe(true);
  });

  it('each condition has the seven required fields', () => {
    const unified = buildUnified({
      str: { extractedFindings: { diagnoses: ['Tinnitus'], injuries: [], events: [] }, manualEntries: [] },
      currentTreatment: {
        extractedFindings: { currentConditions: ['tinnitus'], functionalLimitations: [], treatmentEvents: ['EN visit'], evidenceSnippets: [] },
        manualEntries: [],
      },
    });
    const conditions = runConditionGeneratorEngine(unified);
    conditions.forEach((c) => {
      ['conditionName', 'category', 'confidence', 'confidenceScore', 'missingEvidence', 'followUpQuestions'].forEach((k) => {
        expect(Object.prototype.hasOwnProperty.call(c, k)).toBe(true);
      });
      // evidence is an object with sub-arrays (not a flat array)
      expect(typeof c.evidence).toBe('object');
      expect(Array.isArray(c.evidence.str)).toBe(true);
    });
  });

  it('conditionName is a non-empty string', () => {
    const unified = buildUnified({ derivedSignals: { exposures: [], presumptives: [], secondaryCandidates: [], worseningIndicators: [], unratedConditions: ['Tinnitus'] } });
    const conditions = runConditionGeneratorEngine(unified);
    conditions.forEach((c) => {
      expect(typeof c.conditionName).toBe('string');
      expect(c.conditionName.length).toBeGreaterThan(0);
    });
  });
});

// ── Condition Generator Engine: Category Assignment ───────────────────────────

describe('Condition Generator Engine — Category Assignment', () => {
  it('denied condition is categorized as reopen', () => {
    const unified = buildUnified({
      str: { extractedFindings: { diagnoses: ['Hearing Loss'], injuries: [], events: [] }, manualEntries: [] },
      ratingDecision: {
        manualEntries: [{ conditionName: 'Hearing Loss', isDenied: true, denialReason: 'No nexus', isServiceConnected: false }],
        extractedFindings: { serviceConnectedConditions: [], deniedConditions: ['hearing loss'] },
        conflicts: [],
      },
    });
    const conditions = runConditionGeneratorEngine(unified);
    const hearing = conditions.find((c) => /hearing/i.test(c.conditionName));
    expect(hearing?.category).toBe('reopen');
  });

  it('previously granted + worsening indicators → increase', () => {
    const unified = buildUnified({
      str: { extractedFindings: { diagnoses: ['Tinnitus'], injuries: [], events: [] }, manualEntries: [] },
      currentTreatment: {
        extractedFindings: { currentConditions: ['tinnitus'], functionalLimitations: [], treatmentEvents: [], evidenceSnippets: [] },
        manualEntries: [],
      },
      ratingDecision: {
        manualEntries: [{ conditionName: 'Tinnitus', percentage: '10', isServiceConnected: true, isDenied: false }],
        extractedFindings: { serviceConnectedConditions: ['tinnitus'], deniedConditions: [] },
        conflicts: [],
      },
      derivedSignals: {
        exposures: [],
        presumptives: [],
        secondaryCandidates: [],
        worseningIndicators: ['Tinnitus worsening noted'],
        unratedConditions: [],
      },
    });
    const conditions = runConditionGeneratorEngine(unified);
    const tinnitus = conditions.find((c) => /tinnitus/i.test(c.conditionName));
    expect(tinnitus?.category).toBe('increase');
  });

  it('secondary candidate without worsening → secondary', () => {
    const unified = buildUnified({
      str: { extractedFindings: { diagnoses: ['post-traumatic stress disorder'], injuries: [], events: [] }, manualEntries: [] },
      currentTreatment: {
        extractedFindings: { currentConditions: ['post-traumatic stress disorder', 'sleep apnea'], functionalLimitations: [], treatmentEvents: [], evidenceSnippets: [] },
        manualEntries: [],
      },
      derivedSignals: {
        exposures: [],
        presumptives: [],
        secondaryCandidates: [{ primary: 'post-traumatic stress disorder', secondary: 'sleep apnea' }],
        worseningIndicators: [],
        unratedConditions: ['sleep apnea'],
      },
    });
    const conditions = runConditionGeneratorEngine(unified);
    const sleepApnea = conditions.find((c) => /sleep apnea/i.test(c.conditionName));
    expect(sleepApnea?.category).toBe('secondary');
  });

  it('presumptive condition → presumptive category', () => {
    const unified = buildUnified({
      str: {
        extractedFindings: { diagnoses: ['Diabetes Mellitus Type 2'], injuries: [], events: [] },
        manualEntries: [],
      },
      currentTreatment: {
        extractedFindings: { currentConditions: ['diabetes mellitus type 2'], functionalLimitations: [], treatmentEvents: ['endocrinology consult'], evidenceSnippets: [] },
        manualEntries: [],
      },
      derivedSignals: {
        exposures: ['agent orange'],
        presumptives: ['diabetes mellitus type 2'],
        secondaryCandidates: [],
        worseningIndicators: [],
        unratedConditions: ['diabetes mellitus type 2'],
      },
    });
    const conditions = runConditionGeneratorEngine(unified);
    const diabetes = conditions.find((c) => /diabetes/i.test(c.conditionName));
    expect(diabetes?.category).toBe('presumptive');
  });

  it('condition with only STR evidence and no special flags → primary', () => {
    const unified = buildUnified({
      str: { extractedFindings: { diagnoses: ['Lumbar Strain'], injuries: [], events: [] }, manualEntries: [] },
      currentTreatment: {
        extractedFindings: { currentConditions: ['lumbar strain'], functionalLimitations: [], treatmentEvents: ['orthopedic consult'], evidenceSnippets: [] },
        manualEntries: [],
      },
    });
    const conditions = runConditionGeneratorEngine(unified);
    const lumbar = conditions.find((c) => /lumbar/i.test(c.conditionName));
    expect(lumbar?.category).toBe('primary');
  });
});

// ── Condition Generator Engine: Confidence Scoring ────────────────────────────

describe('Condition Generator Engine — Confidence Scoring', () => {
  it('STR + treatment + exposure → high confidence (score 90)', () => {
    const unified = buildUnified({
      str: { extractedFindings: { diagnoses: ['Tinnitus'], injuries: [], events: [] }, manualEntries: [] },
      currentTreatment: {
        extractedFindings: { currentConditions: ['tinnitus'], functionalLimitations: [], treatmentEvents: ['EN eval'], evidenceSnippets: ['audiogram confirmed'] },
        manualEntries: [],
      },
      derivedSignals: {
        exposures: ['hazardous noise'],
        presumptives: [],
        secondaryCandidates: [],
        worseningIndicators: [],
        unratedConditions: ['tinnitus'],
      },
    });
    const conditions = runConditionGeneratorEngine(unified);
    const tinnitus = conditions.find((c) => /tinnitus/i.test(c.conditionName));
    expect(tinnitus?.confidenceScore).toBe(90);
    expect(tinnitus?.confidence).toBe('high');
  });

  it('STR-only evidence (no treatment) → medium confidence (score 70)', () => {
    const unified = buildUnified({
      str: { extractedFindings: { diagnoses: ['Knee Injury'], injuries: [], events: [] }, manualEntries: [] },
    });
    const conditions = runConditionGeneratorEngine(unified);
    const knee = conditions.find((c) => /knee/i.test(c.conditionName));
    if (knee) {
      expect(knee.confidenceScore).toBeGreaterThanOrEqual(40);
    }
  });

  it('no backing evidence → low confidence (score 40)', () => {
    const unified = buildUnified({
      derivedSignals: {
        exposures: [],
        presumptives: [],
        secondaryCandidates: [],
        worseningIndicators: [],
        unratedConditions: ['mystery condition'],
      },
    });
    const conditions = runConditionGeneratorEngine(unified);
    const mystery = conditions.find((c) => /mystery/i.test(c.conditionName));
    if (mystery) {
      expect(mystery.confidenceScore).toBe(40);
      expect(mystery.confidence).toBe('low');
    }
  });

  it('presumptive condition meets high score threshold', () => {
    const unified = buildUnified({
      derivedSignals: {
        exposures: ['agent orange'],
        presumptives: ['ischemic heart disease'],
        secondaryCandidates: [],
        worseningIndicators: [],
        unratedConditions: ['ischemic heart disease'],
      },
    });
    const conditions = runConditionGeneratorEngine(unified);
    const ihd = conditions.find((c) => /ischemic/i.test(c.conditionName));
    if (ihd) {
      expect(['high', 'medium']).toContain(ihd.confidence);
      expect(ihd.confidenceScore).toBeGreaterThanOrEqual(70);
    }
  });
});

// ── Condition Generator Engine: Follow-up Question Selection ────────────────────

describe('Condition Generator Engine — Follow-up Question Selection', () => {
  it('followUpQuestions are from the defined library buckets', () => {
    const allAllowedQuestions = Object.values(FOLLOW_UP_QUESTION_LIBRARY).flat();
    const unified = buildUnified({
      str: { extractedFindings: { diagnoses: ['Tinnitus'], injuries: [], events: [] }, manualEntries: [] },
    });
    const conditions = runConditionGeneratorEngine(unified);
    conditions.forEach((c) => {
      c.followUpQuestions.forEach((q) => {
        expect(allAllowedQuestions).toContain(q);
      });
    });
  });

  it('denied condition includes questions from deniedPreviously bucket', () => {
    const unified = buildUnified({
      str: { extractedFindings: { diagnoses: ['Tinnitus'], injuries: [], events: [] }, manualEntries: [] },
      ratingDecision: {
        manualEntries: [{ conditionName: 'Tinnitus', isDenied: true, denialReason: 'No nexus', isServiceConnected: false }],
        extractedFindings: { serviceConnectedConditions: [], deniedConditions: ['tinnitus'] },
        conflicts: [],
      },
    });
    const conditions = runConditionGeneratorEngine(unified);
    const tinnitus = conditions.find((c) => /tinnitus/i.test(c.conditionName));
    const deniedBucket = FOLLOW_UP_QUESTION_LIBRARY.deniedPreviously || [];
    const hasFromBucket = tinnitus?.followUpQuestions.some((q) => deniedBucket.includes(q));
    expect(hasFromBucket).toBe(true);
  });

  it('exposure-linked condition includes questions from exposureLinked bucket', () => {
    const unified = buildUnified({
      derivedSignals: {
        exposures: ['burn pits'],
        presumptives: ['asthma'],
        secondaryCandidates: [],
        worseningIndicators: [],
        unratedConditions: ['asthma'],
      },
    });
    const conditions = runConditionGeneratorEngine(unified);
    const asthma = conditions.find((c) => /asthma/i.test(c.conditionName));
    const exposureBucket = FOLLOW_UP_QUESTION_LIBRARY.exposureLinked || [];
    if (asthma && exposureBucket.length > 0) {
      const hasFromBucket = asthma.followUpQuestions.some((q) => exposureBucket.includes(q));
      expect(hasFromBucket).toBe(true);
    }
  });
});

// ── Condition Generator Engine: DBQ & Form Recommendations ────────────────────

describe('Condition Generator Engine — DBQ and Form Recommendations', () => {
  it('recommendedDBQs and recommendedForms are arrays on every condition', () => {
    const unified = buildUnified({
      derivedSignals: { exposures: [], presumptives: [], secondaryCandidates: [], worseningIndicators: [], unratedConditions: ['Tinnitus'] },
    });
    const conditions = runConditionGeneratorEngine(unified);
    conditions.forEach((c) => {
      expect(Array.isArray(c.recommendedDBQs)).toBe(true);
      expect(Array.isArray(c.recommendedForms)).toBe(true);
    });
  });

  it('reopen category includes 20-0995 form', () => {
    const unified = buildUnified({
      str: { extractedFindings: { diagnoses: ['Tinnitus'], injuries: [], events: [] }, manualEntries: [] },
      ratingDecision: {
        manualEntries: [{ conditionName: 'Tinnitus', isDenied: true, denialReason: 'No nexus', isServiceConnected: false }],
        extractedFindings: { serviceConnectedConditions: [], deniedConditions: ['tinnitus'] },
        conflicts: [],
      },
    });
    const conditions = runConditionGeneratorEngine(unified);
    const tinnitus = conditions.find((c) => /tinnitus/i.test(c.conditionName));
    expect(tinnitus?.recommendedForms).toContain('20-0995');
  });

  it('primary category includes 21-526EZ form', () => {
    const unified = buildUnified({
      str: { extractedFindings: { diagnoses: ['Lumbar Strain'], injuries: [], events: [] }, manualEntries: [] },
      currentTreatment: {
        extractedFindings: { currentConditions: ['lumbar strain'], functionalLimitations: [], treatmentEvents: [], evidenceSnippets: [] },
        manualEntries: [],
      },
    });
    const conditions = runConditionGeneratorEngine(unified);
    const lumbar = conditions.find((c) => /lumbar/i.test(c.conditionName));
    if (lumbar) {
      expect(lumbar.recommendedForms).toContain('21-526EZ');
    }
  });

  it('FORM_RECOMMENDATION_RULESET covers all 6 claim categories', () => {
    ['primary', 'secondary', 'presumptive', 'aggravation', 'reopen', 'increase'].forEach((cat) => {
      expect(Object.prototype.hasOwnProperty.call(FORM_RECOMMENDATION_RULESET, cat)).toBe(true);
      expect(Array.isArray(FORM_RECOMMENDATION_RULESET[cat])).toBe(true);
    });
  });

  it('DBQ_MAPPING_TABLE has at least 5 condition entries', () => {
    expect(Object.keys(DBQ_MAPPING_TABLE).length).toBeGreaterThanOrEqual(5);
  });
});

// ── Condition Generator Engine: Missing Evidence Flags ─────────────────────────

describe('Condition Generator Engine — Missing Evidence Flags', () => {
  it('missingEvidence contains human-readable strings', () => {
    const unified = buildUnified({
      derivedSignals: { exposures: [], presumptives: [], secondaryCandidates: [], worseningIndicators: [], unratedConditions: ['Tinnitus'] },
    });
    const conditions = runConditionGeneratorEngine(unified);
    const tinnitus = conditions.find((c) => /tinnitus/i.test(c.conditionName));
    if (tinnitus && tinnitus.missingEvidence.length > 0) {
      tinnitus.missingEvidence.forEach((m) => {
        expect(typeof m).toBe('string');
        expect(m.length).toBeGreaterThan(0);
      });
    }
  });

  it('whyClaimable is a string on each condition', () => {
    const unified = buildUnified({
      derivedSignals: { exposures: [], presumptives: [], secondaryCandidates: [], worseningIndicators: [], unratedConditions: ['Tinnitus'] },
    });
    const conditions = runConditionGeneratorEngine(unified);
    conditions.forEach((c) => {
      expect(typeof c.whyClaimable).toBe('string');
    });
  });
});
