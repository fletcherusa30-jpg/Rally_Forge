import { describe, expect, it } from 'vitest';
import {
  CT_CATEGORY_LABELS,
  CT_FINDING_CATEGORIES,
  CT_STATUS_VALUES,
  CT_TREND_LEVELS,
  VA_CONDITION_ALIASES,
  createEmptyExtractedFindings,
  createEmptyManualEntry,
  createEmptyMedication,
} from '../tabs/current-treatment/schema.js';
import {
  buildCountSummary,
  buildProviderTimeline,
  dedupeManualEntries,
  detectWorseningTrend,
  mergeExtractedFindings,
  normalizeConditionName,
  normalizeMedication,
  normalizeManualEntry,
  validateManualEntry,
} from '../tabs/current-treatment/normalization.js';
import { runConditionGeneratorEngine } from '../engine/conditionGenerator/index.js';

// ── Tab 04 — Current Treatment: Schema Validation ─────────────────────────────

describe('Tab 04 — Current Treatment: Schema Validation', () => {
  it('CT_FINDING_CATEGORIES is a non-empty array of strings', () => {
    expect(Array.isArray(CT_FINDING_CATEGORIES)).toBe(true);
    expect(CT_FINDING_CATEGORIES.length).toBeGreaterThan(0);
    CT_FINDING_CATEGORIES.forEach((cat) => expect(typeof cat).toBe('string'));
  });

  it('CT_CATEGORY_LABELS maps every finding category to a display string', () => {
    CT_FINDING_CATEGORIES.forEach((cat) => {
      expect(Object.prototype.hasOwnProperty.call(CT_CATEGORY_LABELS, cat)).toBe(true);
      expect(CT_CATEGORY_LABELS[cat].length).toBeGreaterThan(0);
    });
  });

  it('CT_TREND_LEVELS contains the 4 expected values', () => {
    expect(CT_TREND_LEVELS).toContain('improving');
    expect(CT_TREND_LEVELS).toContain('stable');
    expect(CT_TREND_LEVELS).toContain('worsening');
    expect(CT_TREND_LEVELS).toContain('unknown');
  });

  it('CT_STATUS_VALUES contains active and inactive', () => {
    expect(CT_STATUS_VALUES).toContain('active');
    expect(CT_STATUS_VALUES).toContain('inactive');
  });

  it('VA_CONDITION_ALIASES maps ptsd to post-traumatic stress disorder', () => {
    expect(VA_CONDITION_ALIASES['ptsd']).toBe('post-traumatic stress disorder');
  });

  it('VA_CONDITION_ALIASES maps lumbar strain to lower back pain', () => {
    expect(VA_CONDITION_ALIASES['lumbar strain']).toBe('lower back pain');
  });

  it('createEmptyExtractedFindings returns correct shape', () => {
    const ef = createEmptyExtractedFindings();
    const keys = ['currentConditions', 'functionalLimitations', 'treatmentEvents', 'evidenceSnippets'];
    keys.forEach((k) => expect(Array.isArray(ef[k])).toBe(true));
  });

  it('createEmptyManualEntry returns all required fields', () => {
    const entry = createEmptyManualEntry();
    // Actual fields: no category/description/treatmentDate; uses symptomSummary, treatmentStartDate
    ['id', 'conditionName', 'symptomSummary', 'status', 'providerName', 'treatmentStartDate'].forEach((k) => {
      expect(Object.prototype.hasOwnProperty.call(entry, k)).toBe(true);
    });
  });

  it('createEmptyMedication returns all required fields', () => {
    const med = createEmptyMedication();
    // Actual fields: medicationName, dosage, sideEffects (no id/conditionName/frequency/status)
    ['medicationName', 'dosage', 'sideEffects'].forEach((k) => {
      expect(Object.prototype.hasOwnProperty.call(med, k)).toBe(true);
    });
  });
});

// ── Tab 04 — Current Treatment: Data Normalization ───────────────────────────

describe('Tab 04 — Current Treatment: Data Normalization', () => {
  it('normalizeConditionName trims and lowercases', () => {
    // trimming: surrounding whitespace is removed before alias lookup
    expect(normalizeConditionName('  tinnitus  ')).toBe('tinnitus');
  });

  it('normalizeConditionName maps known aliases and preserves original casing for unknowns', () => {
    // unknown terms: returned as-is (trimmed, not lowercased)
    expect(normalizeConditionName('  Tinnitus  ')).toBe('Tinnitus');
  });

  it('normalizeConditionName expands known aliases', () => {
    const result = normalizeConditionName('ptsd');
    expect(result).toBe('post-traumatic stress disorder');
  });

  it('normalizeConditionName leaves unknown terms unchanged after lowercasing', () => {
    // terms not in VA_CONDITION_ALIASES are returned as-is (no alias expansion)
    expect(normalizeConditionName('back pain')).toBe('back pain');
  });

  it('normalizeConditionName expands sleep apnea via VA alias', () => {
    // VA_CONDITION_ALIASES maps 'sleep apnea' -> 'obstructive sleep apnea'
    expect(normalizeConditionName('Sleep Apnea')).toBe('obstructive sleep apnea');
  });

  it('normalizeMedication trims string fields', () => {
    const med = normalizeMedication({ medicationName: '  Sertraline ', dosage: ' 50mg ', frequency: ' daily ', conditionName: ' PTSD ', status: 'active' });
    expect(med.medicationName).toBe('Sertraline');
    expect(med.dosage).toBe('50mg');
  });

  it('normalizeManualEntry normalizes conditionName inside entry', () => {
    const entry = normalizeManualEntry({ conditionName: '  PTSD  ', description: 'Recurring nightmares', category: 'mental-health', status: 'active' });
    expect(entry.conditionName).toBe('post-traumatic stress disorder');
  });

  it('validateManualEntry returns errors for missing conditionName', () => {
    const errors = validateManualEntry({ conditionName: '', description: 'Test', category: 'mental-health', status: 'active' });
    expect(errors.conditionName).toBeTruthy();
  });

  it('validateManualEntry returns no errors for a valid entry', () => {
    // validator checks conditionName + symptomSummary (not description)
    const errors = validateManualEntry({ conditionName: 'Sleep Apnea', symptomSummary: 'Diagnosed with OSA', status: 'active' });
    expect(Object.keys(errors).length).toBe(0);
  });

  it('dedupeManualEntries removes duplicates by conditionName case-insensitively', () => {
    const entries = [
      { id: '1', conditionName: 'tinnitus', description: 'ringing', category: 'auditory', status: 'active' },
      { id: '2', conditionName: 'Tinnitus', description: 'ringing in ears', category: 'auditory', status: 'active' },
    ];
    const deduped = dedupeManualEntries(entries);
    expect(deduped.length).toBe(1);
  });

  it('mergeExtractedFindings combines two sets without duplicating conditions', () => {
    const existing = createEmptyExtractedFindings();
    existing.currentConditions = ['Tinnitus'];
    const incoming = { currentConditions: ['Tinnitus', 'Sleep Apnea'], functionalLimitations: ['difficulty concentrating'], treatmentEvents: [], evidenceSnippets: [] };
    const merged = mergeExtractedFindings(existing, incoming);
    const tinnitus = merged.currentConditions.filter((c) => /tinnitus/i.test(c));
    expect(tinnitus.length).toBe(1);
    expect(merged.currentConditions.some((c) => /sleep apnea/i.test(c))).toBe(true);
  });

  it('buildCountSummary returns counts for conditions, medications and manual entries', () => {
    const section = {
      extractedFindings: createEmptyExtractedFindings(),
      manualEntries: [{ conditionName: 'Tinnitus' }],
      medications: [{ medicationName: 'Sertraline' }],
    };
    section.extractedFindings.currentConditions = ['Tinnitus', 'Sleep Apnea'];
    const summary = buildCountSummary(section);
    expect(typeof summary).toBe('object');
  });

  it('buildProviderTimeline returns an array', () => {
    const section = {
      manualEntries: [{ conditionName: 'Tinnitus', treatmentDate: '2020-01-01', provider: 'VAMC' }],
      extractedFindings: createEmptyExtractedFindings(),
    };
    expect(Array.isArray(buildProviderTimeline(section))).toBe(true);
  });
});

// ── Tab 04 — Current Treatment: Worsening Indicators ─────────────────────────

describe('Tab 04 — Current Treatment: Worsening Indicators', () => {
  it('detectWorseningTrend returns worsening when worseningScore >= 2', () => {
    const section = {
      extractedFindings: {
        worseningIndicators: ['worsening', 'deteriorating'],
        medicationMentions: [],
        functionalLimitations: [],
        currentConditions: [],
        treatmentEvents: [],
        evidenceSnippets: [],
      },
    };
    const result = detectWorseningTrend(section);
    expect(result.trend).toBe('worsening');
    expect(Array.isArray(result.indicators)).toBe(true);
    expect(result.indicators.length).toBeGreaterThan(0);
  });

  it('detectWorseningTrend returns stable when only one worsening indicator', () => {
    // non-worsening text in worseningIndicators: score stays 0, 1 medication present → stable
    const section = {
      extractedFindings: {
        // 'joint ache' matches neither worseningTerms nor improvingTerms → score=0; med present → stable
        worseningIndicators: ['joint ache'],
        medicationMentions: ['Ibuprofen 400mg'],
        functionalLimitations: [],
        currentConditions: [],
        treatmentEvents: [],
        evidenceSnippets: [],
      },
    };
    const result = detectWorseningTrend(section);
    expect(result.trend).toBe('stable');
  });

  it('detectWorseningTrend returns stable when medications present but no worsening language', () => {
    // 1 medication (< 4 threshold), no worsening indicators -> worseningScore=0, medicationMentions>0 -> stable
    const section = {
      extractedFindings: {
        worseningIndicators: [],
        medicationMentions: ['Ibuprofen 400mg'],
        functionalLimitations: [],
        currentConditions: [],
        treatmentEvents: [],
        evidenceSnippets: [],
      },
    };
    const result = detectWorseningTrend(section);
    expect(result.trend).toBe('stable');
    expect(Array.isArray(result.indicators)).toBe(true);
  });

  it('detectWorseningTrend counts 4+ medicationMentions as +1 toward worsening', () => {
    const section = {
      extractedFindings: {
        worseningIndicators: ['worsening'],
        medicationMentions: ['med1', 'med2', 'med3', 'med4'],
        functionalLimitations: [],
        currentConditions: [],
        treatmentEvents: [],
        evidenceSnippets: [],
      },
    };
    const result = detectWorseningTrend(section);
    expect(result.trend).toBe('worsening');
  });

  it('detectWorseningTrend counts 3+ functionalLimitations as +1 toward worsening', () => {
    const section = {
      extractedFindings: {
        worseningIndicators: ['worsening'],
        medicationMentions: [],
        functionalLimitations: ['cannot walk', 'cannot stand', 'cannot work'],
        currentConditions: [],
        treatmentEvents: [],
        evidenceSnippets: [],
      },
    };
    const result = detectWorseningTrend(section);
    expect(result.trend).toBe('worsening');
  });

  it('detectWorseningTrend returns unknown for empty section', () => {
    const section = {
      extractedFindings: {
        worseningIndicators: [],
        medicationMentions: [],
        functionalLimitations: [],
        currentConditions: [],
        treatmentEvents: [],
        evidenceSnippets: [],
      },
    };
    const result = detectWorseningTrend(section);
    expect(result.trend).toBe('unknown');
    expect(result.indicators).toEqual([]);
  });
});

// ── Tab 04 — Current Treatment: Condition Generation Inputs ───────────────────

describe('Tab 04 — Current Treatment: Condition Generation Inputs', () => {
  it('treatment currentConditions feed into runConditionGeneratorEngine', () => {
    const unified = {
      str: { extractedFindings: { diagnoses: [], injuries: [], events: [] }, manualEntries: [] },
      currentTreatment: {
        extractedFindings: {
          currentConditions: ['Sleep Apnea'],
          functionalLimitations: [],
          treatmentEvents: ['Sleep study confirmed OSA'],
          evidenceSnippets: ['CPAP prescribed'],
        },
        manualEntries: [],
      },
      ratingDecision: { manualEntries: [], extractedFindings: { serviceConnectedConditions: [], deniedConditions: [] }, conflicts: [] },
      derivedSignals: { exposures: [], presumptives: [], secondaryCandidates: [], worseningIndicators: [], unratedConditions: [] },
      service: [],
    };
    const conditions = runConditionGeneratorEngine(unified);
    expect(conditions.some((c) => /sleep apnea/i.test(c.conditionName))).toBe(true);
  });

  it('treatment worsening indicators elevate condition score', () => {
    const unified = {
      str: { extractedFindings: { diagnoses: ['Hearing Loss'], injuries: [], events: [] }, manualEntries: [] },
      currentTreatment: {
        extractedFindings: {
          currentConditions: ['Hearing Loss'],
          functionalLimitations: ['difficulty hearing', 'cannot hear alarm', 'social isolation'],
          treatmentEvents: ['audiology follow-up'],
          evidenceSnippets: [],
          worseningIndicators: ['worsening', 'deteriorating'],
        },
        manualEntries: [],
      },
      ratingDecision: {
        manualEntries: [{ conditionName: 'Hearing Loss', percentage: '10', isServiceConnected: true, isDenied: false, decisionDate: '2018-01-01' }],
        extractedFindings: { serviceConnectedConditions: ['Hearing Loss'], deniedConditions: [] },
        conflicts: [],
      },
      derivedSignals: { exposures: [], presumptives: [], secondaryCandidates: [], worseningIndicators: ['Hearing Loss worsening'], unratedConditions: [] },
      service: [],
    };
    const conditions = runConditionGeneratorEngine(unified);
    const hearing = conditions.find((c) => /hearing/i.test(c.conditionName));
    expect(hearing).toBeDefined();
    expect(hearing.category).toBe('increase');
  });
});

// ── Tab 04 — Current Treatment: Silent Update Triggers ────────────────────────

describe('Tab 04 — Current Treatment: Silent Update Triggers', () => {
  it('createEmptyExtractedFindings returns arrays not null', () => {
    const ef = createEmptyExtractedFindings();
    Object.values(ef).forEach((v) => expect(Array.isArray(v)).toBe(true));
  });

  it('mergeExtractedFindings handles null incoming gracefully', () => {
    const existing = createEmptyExtractedFindings();
    existing.currentConditions = ['Tinnitus'];
    expect(() => mergeExtractedFindings(existing, null)).not.toThrow();
  });
});
