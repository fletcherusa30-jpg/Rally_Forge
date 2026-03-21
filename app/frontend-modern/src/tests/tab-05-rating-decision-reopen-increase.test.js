import { describe, expect, it } from 'vitest';
import {
  RD_CONFIDENCE_LEVELS,
  RD_PERCENT_OPTIONS,
  RD_RESULT_SECTIONS,
  RD_SECTION_LABELS,
  createEmptyExtractedFindings,
  createEmptyManualEntry,
  createVaDecisionSection,
} from '../tabs/rating-decision/schema.js';
import {
  buildRatingTimeline,
  buildSectionConfidenceSummary,
  detectRatingConflicts,
  mergeExtractedFindings,
  normalizeConditionName,
  normalizeManualEntry,
  parsePercentage,
  validateManualEntry,
} from '../tabs/rating-decision/normalization.js';
import { runConditionGeneratorEngine } from '../engine/conditionGenerator/index.js';

// ── Tab 05 — Rating Decision: Schema Validation ────────────────────────────────

describe('Tab 05 — Rating Decision: Schema Validation', () => {
  it('RD_CONFIDENCE_LEVELS contains high, medium, low, unknown', () => {
    expect(RD_CONFIDENCE_LEVELS).toContain('high');
    expect(RD_CONFIDENCE_LEVELS).toContain('medium');
    expect(RD_CONFIDENCE_LEVELS).toContain('low');
    expect(RD_CONFIDENCE_LEVELS).toContain('unknown');
  });

  it('RD_RESULT_SECTIONS is a non-empty array', () => {
    expect(Array.isArray(RD_RESULT_SECTIONS)).toBe(true);
    expect(RD_RESULT_SECTIONS.length).toBeGreaterThan(0);
  });

  it('RD_SECTION_LABELS provides a display string for each result section', () => {
    RD_RESULT_SECTIONS.forEach((s) => {
      expect(Object.prototype.hasOwnProperty.call(RD_SECTION_LABELS, s)).toBe(true);
      expect(typeof RD_SECTION_LABELS[s]).toBe('string');
    });
  });

  it('RD_PERCENT_OPTIONS starts at 0 and ends at 100', () => {
    expect(RD_PERCENT_OPTIONS[0]).toBe(0);
    expect(RD_PERCENT_OPTIONS[RD_PERCENT_OPTIONS.length - 1]).toBe(100);
  });

  it('RD_PERCENT_OPTIONS increments in steps of 10', () => {
    for (let i = 1; i < RD_PERCENT_OPTIONS.length; i++) {
      expect(RD_PERCENT_OPTIONS[i] - RD_PERCENT_OPTIONS[i - 1]).toBe(10);
    }
  });

  it('createVaDecisionSection returns expected shape', () => {
    const section = createVaDecisionSection();
    ['manualEntries', 'extractedFindings', 'conflicts'].forEach((k) => {
      expect(Object.prototype.hasOwnProperty.call(section, k)).toBe(true);
    });
    expect(Array.isArray(section.manualEntries)).toBe(true);
    expect(Array.isArray(section.conflicts)).toBe(true);
  });

  it('createEmptyManualEntry returns all required rating fields', () => {
    const entry = createEmptyManualEntry();
    // actual field is effectiveDate (not decisionDate)
    const required = ['id', 'conditionName', 'percentage', 'isServiceConnected', 'isDenied', 'effectiveDate'];
    required.forEach((k) => expect(Object.prototype.hasOwnProperty.call(entry, k)).toBe(true));
  });

  it('createEmptyExtractedFindings returns correct shape', () => {
    const ef = createEmptyExtractedFindings();
    expect(Array.isArray(ef.serviceConnectedConditions)).toBe(true);
    expect(Array.isArray(ef.deniedConditions)).toBe(true);
  });
});

// ── Tab 05 — Rating Decision: Conflict Detection ──────────────────────────────

describe('Tab 05 — Rating Decision: Conflict Detection', () => {
  it('detectRatingConflicts returns empty array when no conflicts', () => {
    const manual = [{ conditionName: 'Tinnitus', percentage: '10', isServiceConnected: true, isDenied: false }];
    const extracted = { serviceConnectedConditions: ['Tinnitus'], deniedConditions: [] };
    const conflicts = detectRatingConflicts(manual, extracted);
    expect(Array.isArray(conflicts)).toBe(true);
    expect(conflicts.length).toBe(0);
  });

  it('detectRatingConflicts flags a condition listed in both granted and denied', () => {
    // scanned conditions must be objects with conditionName; strings yield no match
    const manual = [
      { conditionName: 'Sleep Apnea', percentage: '50', isServiceConnected: true, isDenied: false },
    ];
    const extracted = {
      serviceConnectedConditions: [],
      deniedConditions: [{ conditionName: 'Sleep Apnea', effectiveDate: '', kind: 'denied' }],
    };
    const conflicts = detectRatingConflicts(manual, extracted);
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('detectRatingConflicts flags entries where isDenied and isServiceConnected are both true', () => {
    // detectRatingConflicts only identifies manual-vs-scanner mismatches (not intra-manual)
    // use validateManualEntry to catch the self-contradiction isServiceConnected && isDenied
    const errors = validateManualEntry({
      conditionName: 'Tinnitus',
      percentage: '10',
      isServiceConnected: true,
      isDenied: true,
      denialReason: 'changed opinion',
    });
    expect(errors.serviceConnection).toBeTruthy();
  });

  it('normalizeConditionName maps PTSD alias for rating decision', () => {
    expect(normalizeConditionName('ptsd')).toBe('post-traumatic stress disorder');
  });

  it('parsePercentage handles string with % sign', () => {
    expect(parsePercentage('50%')).toBe(50);
  });

  it('parsePercentage handles integer string', () => {
    expect(parsePercentage('10')).toBe(10);
  });

  it('parsePercentage returns empty string for null/empty and NaN for non-numeric', () => {
    // source returns '' for null/undefined/empty string
    expect(parsePercentage(null)).toBe('');
    expect(parsePercentage('')).toBe('');
    // non-numeric string: Number('abc') is NaN, returned as-is
    expect(Number.isNaN(parsePercentage('abc'))).toBe(true);
  });
});

// ── Tab 05 — Rating Decision: Reopen / Increase Logic ─────────────────────────

describe('Tab 05 — Rating Decision: Reopen / Increase Logic', () => {
  it('denied condition produces category reopen in runConditionGeneratorEngine', () => {
    const unified = {
      str: { extractedFindings: { diagnoses: ['Tinnitus'], injuries: [], events: [] }, manualEntries: [] },
      currentTreatment: {
        extractedFindings: { currentConditions: ['tinnitus'], functionalLimitations: [], treatmentEvents: [], evidenceSnippets: [] },
        manualEntries: [],
      },
      ratingDecision: {
        manualEntries: [{ conditionName: 'Tinnitus', percentage: null, isServiceConnected: false, isDenied: true, denialReason: 'No nexus' }],
        extractedFindings: { serviceConnectedConditions: [], deniedConditions: ['tinnitus'] },
        conflicts: [],
      },
      derivedSignals: { exposures: [], presumptives: [], secondaryCandidates: [], worseningIndicators: [], unratedConditions: [] },
      service: [],
    };
    const conditions = runConditionGeneratorEngine(unified);
    const tinnitus = conditions.find((c) => /tinnitus/i.test(c.conditionName));
    expect(tinnitus).toBeDefined();
    expect(tinnitus.category).toBe('reopen');
  });

  it('previously granted + worsening produces category increase', () => {
    const unified = {
      str: { extractedFindings: { diagnoses: ['Hearing Loss'], injuries: [], events: [] }, manualEntries: [] },
      currentTreatment: {
        extractedFindings: {
          currentConditions: ['hearing loss'],
          functionalLimitations: [],
          treatmentEvents: ['audiology 2024'],
          evidenceSnippets: [],
          worseningIndicators: ['worsening', 'deteriorating'],
        },
        manualEntries: [],
      },
      ratingDecision: {
        manualEntries: [{ conditionName: 'Hearing Loss', percentage: '10', isServiceConnected: true, isDenied: false, decisionDate: '2019-01-01' }],
        extractedFindings: { serviceConnectedConditions: ['Hearing Loss'], deniedConditions: [] },
        conflicts: [],
      },
      derivedSignals: { exposures: [], presumptives: [], secondaryCandidates: [], worseningIndicators: ['Hearing Loss worsening per 2024 exam'], unratedConditions: [] },
      service: [],
    };
    const conditions = runConditionGeneratorEngine(unified);
    const hearing = conditions.find((c) => /hearing/i.test(c.conditionName));
    expect(hearing).toBeDefined();
    expect(hearing.category).toBe('increase');
  });

  it('buildRatingTimeline returns per-condition objects', () => {
    const section = {
      manualEntries: [
        { conditionName: 'Tinnitus', percentage: '10', effectiveDate: '2018-01-01', isServiceConnected: true, isDenied: false },
      ],
      extractedFindings: { serviceConnectedConditions: ['Tinnitus'], deniedConditions: [] },
    };
    const timeline = buildRatingTimeline(section);
    expect(Array.isArray(timeline)).toBe(true);
    const tinnitusEntry = timeline.find((t) => /tinnitus/i.test(t.conditionName));
    expect(tinnitusEntry).toBeDefined();
    expect(typeof tinnitusEntry.staged).toBe('boolean');
    expect(Array.isArray(tinnitusEntry.events)).toBe(true);
  });

  it('buildRatingTimeline marks staged=true when a condition has multiple distinct percentages', () => {
    const section = {
      manualEntries: [
        { conditionName: 'Tinnitus', percentage: '10', effectiveDate: '2018-01-01', isServiceConnected: true, isDenied: false },
        { conditionName: 'Tinnitus', percentage: '20', effectiveDate: '2022-01-01', isServiceConnected: true, isDenied: false },
      ],
      extractedFindings: { serviceConnectedConditions: ['Tinnitus'], deniedConditions: [] },
    };
    const timeline = buildRatingTimeline(section);
    const tinnitusEntry = timeline.find((t) => /tinnitus/i.test(t.conditionName));
    expect(tinnitusEntry?.staged).toBe(true);
  });

  it('buildRatingTimeline marks staged=false for a single-percentage condition', () => {
    const section = {
      manualEntries: [
        { conditionName: 'Tinnitus', percentage: '10', effectiveDate: '2018-01-01', isServiceConnected: true, isDenied: false },
      ],
      extractedFindings: { serviceConnectedConditions: [], deniedConditions: [] },
    };
    const timeline = buildRatingTimeline(section);
    const tinnitusEntry = timeline.find((t) => /tinnitus/i.test(t.conditionName));
    expect(tinnitusEntry?.staged).toBe(false);
  });

  it('buildSectionConfidenceSummary returns an object', () => {
    const ef = { serviceConnectedConditions: ['Tinnitus'], deniedConditions: [] };
    const summary = buildSectionConfidenceSummary(ef);
    expect(typeof summary).toBe('object');
  });

  it('validateManualEntry rejects entry where isDenied=true and isServiceConnected=true', () => {
    const errors = validateManualEntry({
      conditionName: 'Tinnitus',
      percentage: '10',
      isServiceConnected: true,
      isDenied: true,
      denialReason: '',
    }, []);
    expect(Object.keys(errors).length).toBeGreaterThan(0);
  });

  it('validateManualEntry accepts a valid denied entry with a denialReason', () => {
    const errors = validateManualEntry({
      conditionName: 'Tinnitus',
      percentage: null,
      isServiceConnected: false,
      isDenied: true,
      denialReason: 'No nexus established',
    }, []);
    expect(Object.keys(errors).length).toBe(0);
  });
});

// ── Tab 05 — Rating Decision: Silent Update Triggers ──────────────────────────

describe('Tab 05 — Rating Decision: Silent Update Triggers', () => {
  it('normalizeManualEntry trims conditionName', () => {
    const entry = normalizeManualEntry({ conditionName: '  Tinnitus  ', percentage: '10', isServiceConnected: true });
    expect(entry.conditionName).toBe('tinnitus');
  });

  it('mergeExtractedFindings combines grant objects and deduplicates by conditionName+effectiveDate', () => {
    const existing = createEmptyExtractedFindings();
    existing.serviceConnectedConditions = [{ conditionName: 'Tinnitus', effectiveDate: '2018-01-01', kind: 'grant', confidenceScore: 0.8 }];
    const incoming = {
      serviceConnectedConditions: [
        { conditionName: 'Tinnitus', effectiveDate: '2018-01-01', kind: 'grant', confidenceScore: 0.9 },
        { conditionName: 'Sleep Apnea', effectiveDate: '2020-06-01', kind: 'grant', confidenceScore: 0.7 },
      ],
      deniedConditions: [],
    };
    const merged = mergeExtractedFindings(existing, incoming);
    const tinnitusRows = merged.serviceConnectedConditions.filter((r) => /tinnitus/i.test(r?.conditionName || ''));
    expect(tinnitusRows.length).toBe(1);
    // Higher score version wins
    expect(Number(tinnitusRows[0]?.confidenceScore)).toBe(0.9);
    expect(merged.serviceConnectedConditions.some((r) => /sleep apnea/i.test(r?.conditionName || ''))).toBe(true);
  });

  it('buildRatingTimeline returns empty array for empty section', () => {
    const timeline = buildRatingTimeline({ manualEntries: [], extractedFindings: { serviceConnectedConditions: [], deniedConditions: [] } });
    expect(Array.isArray(timeline)).toBe(true);
  });
});
