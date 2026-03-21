import { describe, expect, it } from 'vitest';
import { runDerivedSignalsEngine } from '../engine/derivedSignals/index.js';
import { EXPOSURE_CONDITION_MAP } from '../engine/shared/claimEngineConfig.js';

// Helper: build a minimal input for the engine
const empty = () => ({ service: [], str: {}, currentTreatment: {}, ratingDecision: {} });

// ── Derived Signals Engine: Output Shape ──────────────────────────────────────

describe('Derived Signals Engine — Output Shape', () => {
  it('returns the five required output fields', () => {
    const result = runDerivedSignalsEngine(empty());
    const keys = ['exposures', 'presumptives', 'secondaryCandidates', 'worseningIndicators', 'unratedConditions'];
    keys.forEach((k) => expect(Object.prototype.hasOwnProperty.call(result, k)).toBe(true));
  });

  it('all five output fields are arrays', () => {
    const result = runDerivedSignalsEngine(empty());
    expect(Array.isArray(result.exposures)).toBe(true);
    expect(Array.isArray(result.presumptives)).toBe(true);
    expect(Array.isArray(result.secondaryCandidates)).toBe(true);
    expect(Array.isArray(result.worseningIndicators)).toBe(true);
    expect(Array.isArray(result.unratedConditions)).toBe(true);
  });

  it('returns empty arrays for completely empty input', () => {
    const result = runDerivedSignalsEngine(empty());
    expect(result.exposures).toHaveLength(0);
    expect(result.presumptives).toHaveLength(0);
    expect(result.secondaryCandidates).toHaveLength(0);
    expect(result.worseningIndicators).toHaveLength(0);
    expect(result.unratedConditions).toHaveLength(0);
  });
});

// ── Derived Signals Engine: Exposures ─────────────────────────────────────────

describe('Derived Signals Engine — Exposures', () => {
  it('hazardPayIndicators on service record generate exposures', () => {
    const result = runDerivedSignalsEngine({
      service: [{ hazardPayIndicators: ['burn pits'], deploymentLocations: [], combatVeteran: false }],
    });
    expect(result.exposures.some((e) => /burn pits/i.test(e))).toBe(true);
  });

  it('combatVeteran flag adds combat service exposure', () => {
    const result = runDerivedSignalsEngine({
      service: [{ combatVeteran: true, hazardPayIndicators: [], deploymentLocations: [] }],
    });
    expect(result.exposures.some((e) => /combat/i.test(e))).toBe(true);
  });

  it('radiationExposure as array on service record adds radiation exposure', () => {
    const result = runDerivedSignalsEngine({
      // radiationExposure must be an array of strings (not a boolean)
      service: [{ radiationExposure: ['nuclear weapons test site'], hazardPayIndicators: [], deploymentLocations: [], combatVeteran: false }],
    });
    expect(result.exposures.some((e) => /radiation|nuclear/i.test(e))).toBe(true);
  });

  it('STR radiationIndicators add radiation to exposures', () => {
    const result = runDerivedSignalsEngine({
      str: { extractedFindings: { radiationIndicators: ['nuclear test site'], diagnoses: [], injuries: [], events: [] } },
    });
    expect(result.exposures.some((e) => /radiation/i.test(e))).toBe(true);
  });

  it('treatment evidenceSnippets containing known hazard add to exposures', () => {
    const result = runDerivedSignalsEngine({
      currentTreatment: {
        extractedFindings: { evidenceSnippets: ['exposed to burn pit smoke during deployment'], currentConditions: [], functionalLimitations: [], treatmentEvents: [] },
      },
    });
    expect(result.exposures.some((e) => /burn pit/i.test(e))).toBe(true);
  });

  it('deploymentLocations on service record produce location-based exposures', () => {
    const result = runDerivedSignalsEngine({
      service: [{ deploymentLocations: ['Camp Lejeune'], hazardPayIndicators: [], combatVeteran: false }],
    });
    expect(result.exposures.some((e) => /camp lejeune/i.test(e))).toBe(true);
  });
});

// ── Derived Signals Engine: Presumptives ──────────────────────────────────────

describe('Derived Signals Engine — Presumptives', () => {
  it('burn pit exposure generates respiratory presumptive conditions', () => {
    const result = runDerivedSignalsEngine({
      service: [{ hazardPayIndicators: ['burn pits'], deploymentLocations: [], combatVeteran: false }],
    });
    const burnPitConditions = EXPOSURE_CONDITION_MAP['burn pits'] || [];
    const hasAtLeastOne = burnPitConditions.some((cond) =>
      result.presumptives.some((p) => p.toLowerCase().includes(cond.toLowerCase()))
    );
    expect(hasAtLeastOne).toBe(true);
  });

  it('agent orange exposure generates diabetes mellitus type 2 as presumptive', () => {
    const result = runDerivedSignalsEngine({
      service: [{ hazardPayIndicators: ['agent orange'], deploymentLocations: [], combatVeteran: false }],
    });
    expect(result.presumptives.some((p) => /diabetes/i.test(p))).toBe(true);
  });

  it('STR presumptiveSignals pass through to presumptives', () => {
    const result = runDerivedSignalsEngine({
      str: {
        extractedFindings: { presumptiveSignals: ['ischemic heart disease'], diagnoses: [], injuries: [], events: [] },
      },
    });
    expect(result.presumptives.some((p) => /ischemic heart/i.test(p))).toBe(true);
  });

  it('hazardous noise exposure produces tinnitus and hearing loss as presumptives', () => {
    const result = runDerivedSignalsEngine({
      service: [{ hazardPayIndicators: ['hazardous noise'], deploymentLocations: [], combatVeteran: false }],
    });
    const noiseConditions = EXPOSURE_CONDITION_MAP['hazardous noise'] || [];
    const hasAtLeastOne = noiseConditions.some((cond) =>
      result.presumptives.some((p) => p.toLowerCase().includes(cond.toLowerCase()))
    );
    expect(hasAtLeastOne).toBe(true);
  });
});

// ── Derived Signals Engine: Secondary Candidates ──────────────────────────────

describe('Derived Signals Engine — Secondary Candidates', () => {
  it('each secondaryCandidates entry has primary and secondary fields', () => {
    const result = runDerivedSignalsEngine({
      str: { extractedFindings: { diagnoses: ['post-traumatic stress disorder'], injuries: [], events: [] } },
      currentTreatment: {
        extractedFindings: { currentConditions: ['post-traumatic stress disorder', 'sleep apnea'], functionalLimitations: [], treatmentEvents: [], evidenceSnippets: [] },
      },
    });
    result.secondaryCandidates.forEach((pair) => {
      expect(Object.prototype.hasOwnProperty.call(pair, 'primary')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(pair, 'secondary')).toBe(true);
    });
  });

  it('PTSD primary condition generates sleep apnea as a secondary candidate', () => {
    // PTSD must be in ratedConditions (ratingDecision) for secondary linkage to trigger
    const result = runDerivedSignalsEngine({
      str: { extractedFindings: { diagnoses: ['post-traumatic stress disorder'], injuries: [], events: [] } },
      currentTreatment: {
        extractedFindings: { currentConditions: ['post-traumatic stress disorder', 'sleep apnea'], functionalLimitations: [], treatmentEvents: [], evidenceSnippets: [] },
      },
      ratingDecision: {
        // Use 'ptsd' so it normalizes via SYNONYM_MAP to 'post-traumatic stress disorder',
        // matching the exact linkageTable key (stripping 'disorder' would otherwise miss it)
        manualEntries: [{ conditionName: 'ptsd', isServiceConnected: true, isDenied: false }],
        extractedFindings: { serviceConnectedConditions: [], deniedConditions: [] },
      },
    });
    const pair = result.secondaryCandidates.find(
      (p) => /ptsd|post-traumatic/i.test(p.primary) && /sleep apnea/i.test(p.secondary)
    );
    expect(pair).toBeDefined();
  });

  it('hearing loss primary condition generates tinnitus as secondary candidate', () => {
    // hearing loss must be rated (in ratingDecision) for secondary linkage to trigger
    const result = runDerivedSignalsEngine({
      str: { extractedFindings: { diagnoses: ['hearing loss'], injuries: [], events: [] } },
      currentTreatment: {
        extractedFindings: { currentConditions: ['hearing loss', 'tinnitus'], functionalLimitations: [], treatmentEvents: [], evidenceSnippets: [] },
      },
      ratingDecision: {
        manualEntries: [{ conditionName: 'hearing loss', isServiceConnected: true, isDenied: false }],
        extractedFindings: { serviceConnectedConditions: [], deniedConditions: [] },
      },
    });
    const pair = result.secondaryCandidates.find(
      (p) => /hearing loss/i.test(p.primary) && /tinnitus/i.test(p.secondary)
    );
    expect(pair).toBeDefined();
  });
});

// ── Derived Signals Engine: Worsening Indicators ──────────────────────────────

describe('Derived Signals Engine — Worsening Indicators', () => {
  it('treatment worseningIndicators array flows into worseningIndicators output', () => {
    const result = runDerivedSignalsEngine({
      currentTreatment: {
        extractedFindings: {
          worseningIndicators: ['audiogram shows progression 2023'],
          currentConditions: [],
          functionalLimitations: [],
          treatmentEvents: [],
          evidenceSnippets: [],
        },
      },
    });
    expect(result.worseningIndicators.some((w) => /audiogram|progression/i.test(w))).toBe(true);
  });

  it('treatment manual entries with worsening language contribute worseningIndicators', () => {
    // engine reads symptomSummary/treatmentDetails (not description)
    const result = runDerivedSignalsEngine({
      currentTreatment: {
        manualEntries: [{ conditionName: 'Tinnitus', symptomSummary: 'Tinnitus is worsening significantly', treatmentStartDate: '2023-06-01' }],
        extractedFindings: { currentConditions: [], functionalLimitations: [], treatmentEvents: [], evidenceSnippets: [] },
      },
    });
    expect(result.worseningIndicators.some((w) => /tinnitus/i.test(w))).toBe(true);
  });
});

// ── Derived Signals Engine: Unrated Conditions ────────────────────────────────

describe('Derived Signals Engine — Unrated Conditions', () => {
  it('STR diagnoses not in ratedConditions appear in unratedConditions', () => {
    const result = runDerivedSignalsEngine({
      str: { extractedFindings: { diagnoses: ['Tinnitus'], injuries: [], events: [] } },
      ratingDecision: { manualEntries: [], extractedFindings: { serviceConnectedConditions: [], deniedConditions: [] } },
    });
    expect(result.unratedConditions.some((c) => /tinnitus/i.test(c))).toBe(true);
  });

  it('conditions already in serviceConnectedConditions are excluded from unratedConditions', () => {
    const result = runDerivedSignalsEngine({
      str: { extractedFindings: { diagnoses: ['Tinnitus'], injuries: [], events: [] } },
      ratingDecision: {
        manualEntries: [{ conditionName: 'Tinnitus', isServiceConnected: true, isDenied: false }],
        extractedFindings: { serviceConnectedConditions: ['tinnitus'], deniedConditions: [] },
      },
    });
    expect(result.unratedConditions.some((c) => /tinnitus/i.test(c))).toBe(false);
  });
});
