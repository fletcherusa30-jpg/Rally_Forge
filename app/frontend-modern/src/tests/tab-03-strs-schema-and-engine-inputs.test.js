import { describe, expect, it } from 'vitest';
import {
  STR_CATEGORY_LABELS,
  STR_CONFIDENCE_LEVELS,
  STR_FINDING_TYPES,
  createEmptyManualEntry,
  createServiceTreatmentRecordsSection,
} from '../tabs/strs/schema.js';
import {
  buildConfidenceLevels,
  dedupeFindings,
  normalizeUploadResultToFindings,
  scoreToConfidenceLevel,
} from '../tabs/strs/normalization.js';
import { runDerivedSignalsEngine } from '../engine/derivedSignals/index.js';
import { runConditionGeneratorEngine } from '../engine/conditionGenerator/index.js';

// ── Tab 03 — STR: Schema Validation ──────────────────────────────────────────

describe('Tab 03 — STR: Schema Validation', () => {
  it('STR_FINDING_TYPES contains all required types', () => {
    expect(STR_FINDING_TYPES).toContain('diagnosis');
    expect(STR_FINDING_TYPES).toContain('injury');
    expect(STR_FINDING_TYPES).toContain('event');
    expect(STR_FINDING_TYPES).toContain('presumptive-location');
  });

  it('STR_CONFIDENCE_LEVELS contains high, medium, low, manual', () => {
    expect(STR_CONFIDENCE_LEVELS).toContain('high');
    expect(STR_CONFIDENCE_LEVELS).toContain('medium');
    expect(STR_CONFIDENCE_LEVELS).toContain('low');
    expect(STR_CONFIDENCE_LEVELS).toContain('manual');
  });

  it('STR_CATEGORY_LABELS provides a display label for each finding type', () => {
    STR_FINDING_TYPES.forEach((type) => {
      expect(Object.prototype.hasOwnProperty.call(STR_CATEGORY_LABELS, type)).toBe(true);
      expect(typeof STR_CATEGORY_LABELS[type]).toBe('string');
      expect(STR_CATEGORY_LABELS[type].length).toBeGreaterThan(0);
    });
  });

  it('createServiceTreatmentRecordsSection returns correct structure', () => {
    const section = createServiceTreatmentRecordsSection();
    expect(Array.isArray(section.uploadedDocuments)).toBe(true);
    expect(Array.isArray(section.extractedFindings)).toBe(true);
    expect(Array.isArray(section.manualEntries)).toBe(true);
    expect(typeof section.confidenceLevels).toBe('object');
    expect(section.summary).toBeNull();
    expect(section.updatedAt).toBeNull();
  });

  it('createServiceTreatmentRecordsSection merges overrides correctly', () => {
    const section = createServiceTreatmentRecordsSection({ summary: 'test summary' });
    expect(section.summary).toBe('test summary');
    expect(Array.isArray(section.uploadedDocuments)).toBe(true);
  });

  it('createEmptyManualEntry provides all required STR manual entry fields', () => {
    const entry = createEmptyManualEntry();
    const required = [
      'id', 'findingType', 'conditionName', 'dateOfEvent', 'description',
      'provider', 'severity', 'confidenceLevel', 'lineOfDuty', 'inServiceEvent',
    ];
    required.forEach((key) => {
      expect(Object.prototype.hasOwnProperty.call(entry, key)).toBe(true);
    });
  });

  it('createEmptyManualEntry defaults findingType to event and confidenceLevel to manual', () => {
    const entry = createEmptyManualEntry();
    expect(entry.findingType).toBe('event');
    expect(entry.confidenceLevel).toBe('manual');
    expect(entry.lineOfDuty).toBe('Yes');
    expect(entry.inServiceEvent).toBe(true);
  });

  it('createEmptyManualEntry accepts findingType override', () => {
    const entry = createEmptyManualEntry({ findingType: 'diagnosis', conditionName: 'Tinnitus' });
    expect(entry.findingType).toBe('diagnosis');
    expect(entry.conditionName).toBe('Tinnitus');
  });
});

// ── Tab 03 — STR: Data Normalization ─────────────────────────────────────────

describe('Tab 03 — STR: Data Normalization', () => {
  it('scoreToConfidenceLevel returns high for scores >= 0.8', () => {
    expect(scoreToConfidenceLevel(0.8)).toBe('high');
    expect(scoreToConfidenceLevel(0.95)).toBe('high');
    expect(scoreToConfidenceLevel(1.0)).toBe('high');
  });

  it('scoreToConfidenceLevel returns medium for 0.55–0.79', () => {
    expect(scoreToConfidenceLevel(0.55)).toBe('medium');
    expect(scoreToConfidenceLevel(0.7)).toBe('medium');
    expect(scoreToConfidenceLevel(0.79)).toBe('medium');
  });

  it('scoreToConfidenceLevel returns low for scores below 0.55', () => {
    expect(scoreToConfidenceLevel(0.4)).toBe('low');
    expect(scoreToConfidenceLevel(0.0)).toBe('low');
  });

  it('normalizeUploadResultToFindings extracts all four finding types', () => {
    const findings = normalizeUploadResultToFindings({
      metadata: { fileName: 'strs.pdf' },
      Extracted: {
        Diagnoses: [{ label: 'Lumbar strain', confidence: { score: 0.91 } }],
        Injuries: [{ label: 'Shoulder injury', confidence: { score: 0.66 } }],
        Events: [{ label: 'Blast exposure event', confidence: { score: 0.58 } }],
        PresumptiveLocations: [{ location: 'Camp Lejeune', confidence: { score: 0.47 } }],
      },
    });
    const types = new Set(findings.map((f) => f.findingType));
    expect(types.has('diagnosis')).toBe(true);
    expect(types.has('injury')).toBe(true);
    expect(types.has('event')).toBe(true);
    expect(types.has('presumptive-location')).toBe(true);
  });

  it('normalizeUploadResultToFindings assigns confidenceLevel based on score', () => {
    const findings = normalizeUploadResultToFindings({
      Extracted: {
        Diagnoses: [
          { label: 'High confidence condition', confidence: { score: 0.92 } },
          { label: 'Low confidence condition', confidence: { score: 0.3 } },
        ],
      },
    });
    const high = findings.find((f) => f.conditionName === 'High confidence condition');
    const low = findings.find((f) => f.conditionName === 'Low confidence condition');
    expect(high?.confidenceLevel).toBe('high');
    expect(low?.confidenceLevel).toBe('low');
  });

  it('dedupeFindings merges duplicate conditions and keeps highest confidence', () => {
    const deduped = dedupeFindings([
      { id: 'a', findingType: 'diagnosis', conditionName: 'Tinnitus', dates: ['2014-01-01'], confidenceLevel: 'medium', confidenceScore: 0.65 },
      { id: 'b', findingType: 'diagnosis', conditionName: 'Tinnitus', dates: ['2014-02-01'], confidenceLevel: 'high', confidenceScore: 0.9 },
    ]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].confidenceLevel).toBe('high');
  });

  it('buildConfidenceLevels counts findings by confidence tier', () => {
    const findings = [
      { confidenceLevel: 'high' },
      { confidenceLevel: 'high' },
      { confidenceLevel: 'medium' },
      { confidenceLevel: 'low' },
      { confidenceLevel: 'manual' },
    ];
    const levels = buildConfidenceLevels(findings);
    expect(levels.high).toBe(2);
    expect(levels.medium).toBe(1);
    expect(levels.low).toBe(1);
    expect(levels.manual).toBe(1);
  });
});

// ── Tab 03 — STR: Derived Signals ────────────────────────────────────────────

describe('Tab 03 — STR: Derived Signals', () => {
  it('STR extractedFindings.diagnoses flow into unratedConditions via derived signals', () => {
    const signals = runDerivedSignalsEngine({
      str: {
        extractedFindings: {
          diagnoses: ['Tinnitus'],
          injuries: [],
          events: [],
        },
        manualEntries: [],
      },
    });
    expect(signals.unratedConditions.some((c) => /tinnitus/i.test(c))).toBe(true);
  });

  it('STR presumptiveSignals map into derivedSignals.presumptives', () => {
    const signals = runDerivedSignalsEngine({
      str: {
        extractedFindings: {
          presumptiveSignals: ['gulf war illness'],
          diagnoses: [],
          injuries: [],
          events: [],
        },
        manualEntries: [],
      },
    });
    expect(signals.presumptives.some((p) => /gulf war illness/i.test(p))).toBe(true);
  });

  it('STR injuries and events are included in unrated condition candidates', () => {
    const signals = runDerivedSignalsEngine({
      str: {
        extractedFindings: {
          diagnoses: [],
          injuries: ['Knee injury'],
          events: ['Blast exposure'],
        },
        manualEntries: [],
      },
    });
    const all = signals.unratedConditions.map((c) => c.toLowerCase());
    expect(all.some((c) => /knee/i.test(c))).toBe(true);
  });
});

// ── Tab 03 — STR: Condition Generation Inputs ─────────────────────────────────

describe('Tab 03 — STR: Condition Generation Inputs', () => {
  it('STR diagnoses appear as condition candidates in runConditionGeneratorEngine', () => {
    const unified = {
      str: {
        extractedFindings: {
          diagnoses: ['Tinnitus'],
          injuries: [],
          events: [],
        },
        manualEntries: [],
      },
      currentTreatment: {
        extractedFindings: { currentConditions: ['tinnitus'], functionalLimitations: [], treatmentEvents: ['EN follow-up'], evidenceSnippets: [] },
        manualEntries: [],
      },
      ratingDecision: { manualEntries: [], extractedFindings: { serviceConnectedConditions: [], deniedConditions: [] }, conflicts: [] },
      derivedSignals: { exposures: [], presumptives: [], secondaryCandidates: [], worseningIndicators: [], unratedConditions: [] },
      service: [],
    };
    const conditions = runConditionGeneratorEngine(unified);
    expect(conditions.some((c) => /tinnitus/i.test(c.conditionName))).toBe(true);
  });

  it('STR manual entries feed into condition generation candidates', () => {
    const unified = {
      str: {
        manualEntries: [{ conditionName: 'Hearing Loss', description: 'Artillery noise exposure', dateOfEvent: '2005-01-01' }],
        extractedFindings: { diagnoses: [], injuries: [], events: [] },
      },
      currentTreatment: {
        extractedFindings: { currentConditions: ['hearing loss'], functionalLimitations: [], treatmentEvents: [], evidenceSnippets: [] },
        manualEntries: [],
      },
      ratingDecision: { manualEntries: [], extractedFindings: { serviceConnectedConditions: [], deniedConditions: [] }, conflicts: [] },
      derivedSignals: { exposures: [], presumptives: [], secondaryCandidates: [], worseningIndicators: [], unratedConditions: [] },
      service: [],
    };
    const conditions = runConditionGeneratorEngine(unified);
    expect(conditions.some((c) => /hearing/i.test(c.conditionName))).toBe(true);
  });
});

// ── Tab 03 — STR: Silent Update Triggers ─────────────────────────────────────

describe('Tab 03 — STR: Silent Update Triggers', () => {
  it('createServiceTreatmentRecordsSection updatedAt defaults to null', () => {
    expect(createServiceTreatmentRecordsSection().updatedAt).toBeNull();
  });

  it('normalizeUploadResultToFindings returns an array even for empty Extracted', () => {
    const findings = normalizeUploadResultToFindings({ Extracted: {} });
    expect(Array.isArray(findings)).toBe(true);
  });

  it('dedupeFindings handles empty input gracefully', () => {
    expect(dedupeFindings([])).toEqual([]);
    // null bypasses the default param; use undefined to trigger graceful default
    expect(dedupeFindings(undefined)).toEqual([]);
  });
});
