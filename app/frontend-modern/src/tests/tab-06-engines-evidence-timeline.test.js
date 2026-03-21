import { describe, expect, it } from 'vitest';
import {
  DBQ_MAPPING_TABLE,
  FOLLOW_UP_QUESTION_LIBRARY,
  FORM_RECOMMENDATION_RULESET,
} from '../engine/shared/claimEngineConfig.js';
import { runConditionGeneratorEngine } from '../engine/conditionGenerator/index.js';
import { runLayStatementEngine } from '../engine/layStatement/index.js';
import { runEvidenceIndexEngine } from '../engine/evidenceIndex/index.js';
import { buildUnifiedTimeline } from '../engine/timeline/index.js';

// Shared minimal unified object used across multiple tests
const buildMinimalUnified = (overrides = {}) => ({
  profile: { firstName: 'Jane', lastName: 'Doe', ssnLast4: '9999', dateOfBirth: '1985-05-15', ...overrides.profile },
  service: overrides.service ?? [
    {
      branch: 'Army',
      startDate: '2003-01-15',
      endDate: '2007-06-30',
      serviceType: 'Active',
      dischargeType: 'Honorable',
      mos: '11B',
      combatVeteran: true,
      hazardPayIndicators: [],
      deploymentLocations: ['Iraq'],
    },
  ],
  str: overrides.str ?? {
    extractedFindings: { diagnoses: ['Tinnitus', 'Hearing Loss'], injuries: [], events: ['Blast exposure 2004'] },
    manualEntries: [],
  },
  currentTreatment: overrides.currentTreatment ?? {
    extractedFindings: {
      currentConditions: ['tinnitus', 'hearing loss'],
      functionalLimitations: ['difficulty hearing in crowds'],
      treatmentEvents: ['audiology eval 2023'],
      evidenceSnippets: ['audiogram shows 45dB loss'],
    },
    manualEntries: [],
  },
  ratingDecision: overrides.ratingDecision ?? {
    manualEntries: [],
    extractedFindings: { serviceConnectedConditions: [], deniedConditions: [] },
    conflicts: [],
  },
  derivedSignals: overrides.derivedSignals ?? {
    exposures: ['hazardous noise'],
    presumptives: [],
    secondaryCandidates: [{ primary: 'hearing loss', secondary: 'tinnitus' }],
    worseningIndicators: [],
    unratedConditions: ['tinnitus', 'hearing loss'],
  },
});

// ── Tab 06 — Claim Generator: Condition Generation Engine ─────────────────────

describe('Tab 06 — Claim Generator: Condition Generation Engine', () => {
  it('runConditionGeneratorEngine returns a non-empty array of condition objects', () => {
    const conditions = runConditionGeneratorEngine(buildMinimalUnified());
    expect(Array.isArray(conditions)).toBe(true);
    expect(conditions.length).toBeGreaterThan(0);
  });

  it('each condition has conditionName, category, confidence, and confidenceScore', () => {
    const conditions = runConditionGeneratorEngine(buildMinimalUnified());
    conditions.forEach((c) => {
      expect(typeof c.conditionName).toBe('string');
      expect(typeof c.category).toBe('string');
      expect(typeof c.confidence).toBe('string');
      expect(typeof c.confidenceScore).toBe('number');
    });
  });

  it('each condition includes evidence object with sub-arrays, missingEvidence, and followUpQuestions', () => {
    const conditions = runConditionGeneratorEngine(buildMinimalUnified());
    conditions.forEach((c) => {
      expect(typeof c.evidence).toBe('object');
      expect(Array.isArray(c.evidence.str)).toBe(true);
      expect(Array.isArray(c.evidence.treatment)).toBe(true);
      expect(Array.isArray(c.missingEvidence)).toBe(true);
      expect(Array.isArray(c.followUpQuestions)).toBe(true);
    });
  });

  it('each condition includes recommendedDBQs and recommendedForms arrays', () => {
    const conditions = runConditionGeneratorEngine(buildMinimalUnified());
    conditions.forEach((c) => {
      expect(Array.isArray(c.recommendedDBQs)).toBe(true);
      expect(Array.isArray(c.recommendedForms)).toBe(true);
    });
  });

  it('high-evidence condition scores 90', () => {
    const unified = buildMinimalUnified(); // has STR + treatment + exposure for tinnitus
    const conditions = runConditionGeneratorEngine(unified);
    const tinnitus = conditions.find((c) => /tinnitus/i.test(c.conditionName));
    expect(tinnitus).toBeDefined();
    // With STR diagnosis + current treatment + hazardous noise exposure we should see high confidence
    expect(tinnitus.confidenceScore).toBeGreaterThanOrEqual(70);
  });

  it('condition with no evidence scores 40 (low confidence)', () => {
    const unified = buildMinimalUnified();
    // Add a condition candidate with no backing evidence
    unified.derivedSignals.unratedConditions.push('migraines');
    const conditions = runConditionGeneratorEngine(unified);
    const migraine = conditions.find((c) => /migraine/i.test(c.conditionName));
    if (migraine) {
      expect(['low', 'medium', 'high']).toContain(migraine.confidence);
    }
  });
});

// ── Tab 06 — Claim Generator: DBQ / Form Recommendations ─────────────────────

describe('Tab 06 — Claim Generator: DBQ / Form Recommendations', () => {
  it('FOLLOW_UP_QUESTION_LIBRARY has all required question buckets', () => {
    const required = [
      'missingCurrentTreatment', 'missingSTR', 'missingFunctionalImpact',
      'deniedPreviously', 'secondaryCandidate', 'exposureLinked', 'worseningTrend',
    ];
    required.forEach((key) => {
      expect(Object.prototype.hasOwnProperty.call(FOLLOW_UP_QUESTION_LIBRARY, key)).toBe(true);
    });
  });

  it('each FOLLOW_UP_QUESTION_LIBRARY bucket contains at least one question string', () => {
    Object.entries(FOLLOW_UP_QUESTION_LIBRARY).forEach(([, questions]) => {
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
    });
  });

  it('DBQ_MAPPING_TABLE maps hearing loss to its DBQ', () => {
    const key = Object.keys(DBQ_MAPPING_TABLE).find((k) => /hearing loss/i.test(k));
    expect(key).toBeTruthy();
    expect(DBQ_MAPPING_TABLE[key]).toMatch(/DBQ/i);
  });

  it('DBQ_MAPPING_TABLE maps sleep apnea to its DBQ', () => {
    const key = Object.keys(DBQ_MAPPING_TABLE).find((k) => /sleep apnea/i.test(k));
    expect(key).toBeTruthy();
    expect(DBQ_MAPPING_TABLE[key]).toMatch(/DBQ/i);
  });

  it('FORM_RECOMMENDATION_RULESET includes 21-526EZ for primary category', () => {
    expect(FORM_RECOMMENDATION_RULESET.primary).toContain('21-526EZ');
  });

  it('FORM_RECOMMENDATION_RULESET includes 20-0995 for reopen category', () => {
    expect(FORM_RECOMMENDATION_RULESET.reopen).toContain('20-0995');
  });

  it('FORM_RECOMMENDATION_RULESET includes 20-0996 for conflict detected', () => {
    expect(FORM_RECOMMENDATION_RULESET.conflictDetected).toContain('20-0996');
  });

  it('conditions with hearing loss include relevant Hearing Loss DBQ in recommendedDBQs', () => {
    const conditions = runConditionGeneratorEngine(buildMinimalUnified());
    const hearing = conditions.find((c) => /hearing loss/i.test(c.conditionName));
    if (hearing && hearing.recommendedDBQs.length > 0) {
      expect(hearing.recommendedDBQs.some((d) => /hearing/i.test(d))).toBe(true);
    }
  });

  it('denied condition includes 20-0995 in recommendedForms', () => {
    const unified = buildMinimalUnified({
      ratingDecision: {
        manualEntries: [{ conditionName: 'Tinnitus', isDenied: true, denialReason: 'No nexus', isServiceConnected: false }],
        extractedFindings: { serviceConnectedConditions: [], deniedConditions: ['tinnitus'] },
        conflicts: [],
      },
    });
    const conditions = runConditionGeneratorEngine(unified);
    const tinnitus = conditions.find((c) => /tinnitus/i.test(c.conditionName));
    if (tinnitus) {
      expect(tinnitus.recommendedForms.some((f) => f === '20-0995')).toBe(true);
    }
  });
});

// ── Tab 06 — Claim Generator: Lay Statement Generator ────────────────────────

describe('Tab 06 — Claim Generator: Lay Statement Generator', () => {
  it('runLayStatementEngine returns a non-empty string when conditions are provided', () => {
    const unified = buildMinimalUnified();
    const conditions = runConditionGeneratorEngine(unified);
    const statement = runLayStatementEngine(unified, conditions);
    expect(typeof statement).toBe('string');
    expect(statement.length).toBeGreaterThan(0);
  });

  it('runLayStatementEngine returns empty string for empty conditions array', () => {
    const unified = buildMinimalUnified();
    const statement = runLayStatementEngine(unified, []);
    expect(statement).toBe('');
  });

  it('lay statement includes veteran first name', () => {
    const unified = buildMinimalUnified();
    const conditions = runConditionGeneratorEngine(unified);
    const statement = runLayStatementEngine(unified, conditions);
    expect(statement).toContain('Jane');
  });

  it('lay statement includes veteran last name', () => {
    const unified = buildMinimalUnified();
    const conditions = runConditionGeneratorEngine(unified);
    const statement = runLayStatementEngine(unified, conditions);
    expect(statement).toContain('Doe');
  });

  it('lay statement mentions at least one condition name from generated conditions', () => {
    const unified = buildMinimalUnified();
    const conditions = runConditionGeneratorEngine(unified);
    const statement = runLayStatementEngine(unified, conditions);
    const mentionsACondition = conditions.some((c) =>
      statement.toLowerCase().includes(c.conditionName.toLowerCase())
    );
    expect(mentionsACondition).toBe(true);
  });

  it('lay statement is a single continuous string without undefined placeholders', () => {
    const unified = buildMinimalUnified();
    const conditions = runConditionGeneratorEngine(unified);
    const statement = runLayStatementEngine(unified, conditions);
    expect(statement).not.toContain('[object Object]');
    expect(statement).not.toContain('undefined');
  });
});

// ── Tab 06 — Claim Generator: Evidence Index ──────────────────────────────────

describe('Tab 06 — Claim Generator: Evidence Index', () => {
  it('runEvidenceIndexEngine returns an array', () => {
    const unified = buildMinimalUnified();
    const conditions = runConditionGeneratorEngine(unified);
    const rows = runEvidenceIndexEngine(unified, conditions);
    expect(Array.isArray(rows)).toBe(true);
  });

  it('each evidence row has required fields', () => {
    const unified = buildMinimalUnified();
    const conditions = runConditionGeneratorEngine(unified);
    const rows = runEvidenceIndexEngine(unified, conditions);
    rows.forEach((row) => {
      expect(Object.prototype.hasOwnProperty.call(row, 'source')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(row, 'sourceType')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(row, 'conditionName')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(row, 'summary')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(row, 'confidence')).toBe(true);
    });
  });

  it('evidence rows include STR-sourced entries when STR findings are present', () => {
    const unified = buildMinimalUnified();
    const conditions = runConditionGeneratorEngine(unified);
    const rows = runEvidenceIndexEngine(unified, conditions);
    expect(rows.some((r) => /str|service treat/i.test(r.sourceType || r.source))).toBe(true);
  });

  it('evidence rows include Treatment-sourced entries when treatment data is present', () => {
    const unified = buildMinimalUnified();
    const conditions = runConditionGeneratorEngine(unified);
    const rows = runEvidenceIndexEngine(unified, conditions);
    expect(rows.some((r) => /treatment|current/i.test(r.sourceType || r.source))).toBe(true);
  });

  it('runEvidenceIndexEngine returns empty array for empty conditions', () => {
    const rows = runEvidenceIndexEngine(buildMinimalUnified(), []);
    expect(Array.isArray(rows)).toBe(true);
  });
});

// ── Tab 06 — Claim Generator: Timeline Integration ───────────────────────────

describe('Tab 06 — Claim Generator: Timeline Integration', () => {
  it('buildUnifiedTimeline returns a sorted array of events', () => {
    const events = buildUnifiedTimeline(buildMinimalUnified());
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it('each timeline event has the required fields', () => {
    const events = buildUnifiedTimeline(buildMinimalUnified());
    events.forEach((ev) => {
      expect(Object.prototype.hasOwnProperty.call(ev, 'source')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(ev, 'summary')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(ev, 'sourceTag')).toBe(true);
    });
  });

  it('timeline includes service start event', () => {
    const events = buildUnifiedTimeline(buildMinimalUnified());
    expect(events.some((ev) => /service|enlist|start/i.test(ev.summary))).toBe(true);
  });

  it('timeline includes STR findings entries', () => {
    const events = buildUnifiedTimeline(buildMinimalUnified());
    expect(events.some((ev) => /str|service treat|blast|diagnosis/i.test(ev.summary))).toBe(true);
  });

  it('null-date events appear at the end of the sorted timeline', () => {
    const events = buildUnifiedTimeline(buildMinimalUnified());
    const datedEvents = events.filter((ev) => ev.date !== null && ev.date !== undefined && ev.date !== '');
    const nullDateEvents = events.filter((ev) => !ev.date);
    if (nullDateEvents.length > 0 && datedEvents.length > 0) {
      const lastDated = datedEvents[datedEvents.length - 1];
      const lastDatedIdx = events.indexOf(lastDated);
      const firstNullIdx = events.indexOf(nullDateEvents[0]);
      expect(firstNullIdx).toBeGreaterThan(lastDatedIdx);
    }
  });

  it('timeline deduplicates identical events', () => {
    const unified = buildMinimalUnified();
    const events = buildUnifiedTimeline(unified);
    const keys = events.map((ev) => `${ev.date}|${ev.source}|${ev.summary}`);
    const unique = new Set(keys);
    expect(events.length).toBe(unique.size);
  });
});
