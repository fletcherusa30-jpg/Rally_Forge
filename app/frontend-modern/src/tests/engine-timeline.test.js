import { describe, expect, it } from 'vitest';
import { buildUnifiedTimeline } from '../engine/timeline/index.js';

// ── Test fixture helpers ───────────────────────────────────────────────────────

function buildUnified(overrides = {}) {
  return {
    profile: { firstName: 'Carlos', lastName: 'Rivera', ...overrides.profile },
    service: overrides.service ?? [
      {
        branch: 'Navy',
        startDate: '1995-07-01',
        endDate: '2001-06-30',
        serviceType: 'Active',
        dischargeType: 'Honorable',
        mos: 'BM',
        combatVeteran: false,
        hazardPayIndicators: ['hazardous noise'],
        deploymentLocations: ['Mediterranean'],
      },
    ],
    str: overrides.str ?? {
      extractedFindings: {
        diagnoses: ['Tinnitus'],
        injuries: ['Shoulder strain'],
        events: ['shipboard machinery noise exposure 1998'],
      },
      manualEntries: [
        { conditionName: 'Hearing Loss', description: "Documented by ship's corpsman", dateOfEvent: '1999-03-15', findingType: 'diagnosis' },
      ],
    },
    currentTreatment: overrides.currentTreatment ?? {
      extractedFindings: {
        currentConditions: ['tinnitus', 'hearing loss'],
        functionalLimitations: ['difficulty hearing'],
        treatmentEvents: ['audiology consult 2020'],
        evidenceSnippets: [],
      },
      manualEntries: [
        { conditionName: 'Tinnitus', description: 'Ongoing ringing', treatmentDate: '2021-04-10', provider: 'VAMC ENT' },
      ],
    },
    ratingDecision: overrides.ratingDecision ?? {
      manualEntries: [
        { conditionName: 'Tinnitus', percentage: '10', isServiceConnected: true, isDenied: false, effectiveDate: '2015-08-01' },
      ],
      extractedFindings: { serviceConnectedConditions: ['tinnitus'], deniedConditions: [] },
      conflicts: [],
    },
    derivedSignals: overrides.derivedSignals ?? {
      exposures: ['hazardous noise'],
      presumptives: [],
      secondaryCandidates: [],
      worseningIndicators: [],
      unratedConditions: ['hearing loss'],
    },
  };
}

// ── Timeline Engine: Output Shape ─────────────────────────────────────────────

describe('Timeline Engine — Output Shape', () => {
  it('returns an array', () => {
    expect(Array.isArray(buildUnifiedTimeline(buildUnified()))).toBe(true);
  });

  it('returns empty array for completely empty input', () => {
    const result = buildUnifiedTimeline({
      service: [],
      str: { extractedFindings: { diagnoses: [], injuries: [], events: [] }, manualEntries: [] },
      currentTreatment: { extractedFindings: { currentConditions: [], functionalLimitations: [], treatmentEvents: [], evidenceSnippets: [] }, manualEntries: [] },
      ratingDecision: { manualEntries: [], extractedFindings: { serviceConnectedConditions: [], deniedConditions: [] } },
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it('each event has source, summary, and sourceTag fields', () => {
    buildUnifiedTimeline(buildUnified()).forEach((ev) => {
      expect(Object.prototype.hasOwnProperty.call(ev, 'source')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(ev, 'summary')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(ev, 'sourceTag')).toBe(true);
    });
  });

  it('each event has a date field (may be null/empty)', () => {
    buildUnifiedTimeline(buildUnified()).forEach((ev) => {
      expect(Object.prototype.hasOwnProperty.call(ev, 'date')).toBe(true);
    });
  });

  it('each event source is a non-empty string', () => {
    buildUnifiedTimeline(buildUnified()).forEach((ev) => {
      expect(typeof ev.source).toBe('string');
      expect(ev.source.length).toBeGreaterThan(0);
    });
  });
});

// ── Timeline Engine: Service Events ───────────────────────────────────────────

describe('Timeline Engine — Service Events', () => {
  it('includes a service start event when service record has startDate', () => {
    const events = buildUnifiedTimeline(buildUnified());
    expect(events.some((ev) => /service|enlist|start/i.test(ev.summary))).toBe(true);
  });

  it('service start event date matches the service record startDate', () => {
    const events = buildUnifiedTimeline(buildUnified());
    const startEvent = events.find((ev) => /service|enlist|start/i.test(ev.summary) && ev.date === '1995-07-01');
    expect(startEvent).toBeDefined();
  });

  it('includes a service end or separation event when service record has endDate', () => {
    const events = buildUnifiedTimeline(buildUnified());
    expect(events.some((ev) => /separat|discharge|end|release/i.test(ev.summary))).toBe(true);
  });

  it('includes deployment location events from service record', () => {
    const events = buildUnifiedTimeline(buildUnified());
    expect(events.some((ev) => /mediterranean|deploy/i.test(ev.summary))).toBe(true);
  });

  it('includes hazard pay / exposure events from service record', () => {
    const events = buildUnifiedTimeline(buildUnified());
    expect(events.some((ev) => /hazard|noise/i.test(ev.summary))).toBe(true);
  });
});

// ── Timeline Engine: STR Events ───────────────────────────────────────────────

describe('Timeline Engine — STR Events', () => {
  it('includes STR diagnosis events', () => {
    const events = buildUnifiedTimeline(buildUnified());
    expect(events.some((ev) => /tinnitus|diagnosis/i.test(ev.summary))).toBe(true);
  });

  it('includes STR injury events', () => {
    const events = buildUnifiedTimeline(buildUnified());
    expect(events.some((ev) => /shoulder|strain|injury/i.test(ev.summary))).toBe(true);
  });

  it('includes STR incident/event entries', () => {
    const events = buildUnifiedTimeline(buildUnified());
    expect(events.some((ev) => /noise|shipboard|exposure/i.test(ev.summary))).toBe(true);
  });

  it('includes STR manual entry events', () => {
    const events = buildUnifiedTimeline(buildUnified());
    expect(events.some((ev) => /hearing loss|corpsman/i.test(ev.summary))).toBe(true);
  });
});

// ── Timeline Engine: Treatment Events ─────────────────────────────────────────

describe('Timeline Engine — Treatment Events', () => {
  it('includes treatment event entries', () => {
    const events = buildUnifiedTimeline(buildUnified());
    expect(events.some((ev) => /audiology|consult|treatment/i.test(ev.summary))).toBe(true);
  });

  it('includes treatment manual entry events', () => {
    const events = buildUnifiedTimeline(buildUnified());
    expect(events.some((ev) => /tinnitus|ringing|vamc/i.test(ev.summary))).toBe(true);
  });
});

// ── Timeline Engine: Rating Decision Events ───────────────────────────────────

describe('Timeline Engine — Rating Decision Events', () => {
  it('includes rating decision manual entries', () => {
    const events = buildUnifiedTimeline(buildUnified());
    expect(events.some((ev) => /rating|decision|10%|grant|service.?connect/i.test(ev.summary))).toBe(true);
  });

  it('rating decision event date matches the input effectiveDate', () => {
    const events = buildUnifiedTimeline(buildUnified());
    const rdEvent = events.find((ev) => ev.date === '2015-08-01');
    expect(rdEvent).toBeDefined();
  });
});

// ── Timeline Engine: Sorting and Deduplication ────────────────────────────────

describe('Timeline Engine — Sorting and Deduplication', () => {
  it('dated events are sorted ascending by date', () => {
    const events = buildUnifiedTimeline(buildUnified());
    const dated = events.filter((ev) => ev.date && ev.date.length === 10);
    for (let i = 1; i < dated.length; i++) {
      expect(dated[i].date >= dated[i - 1].date).toBe(true);
    }
  });

  it('null-date events appear after all dated events', () => {
    const events = buildUnifiedTimeline(buildUnified());
    const lastDatedIdx = events.reduce((acc, ev, idx) => (ev.date ? idx : acc), -1);
    const firstNullIdx = events.findIndex((ev) => !ev.date);
    if (firstNullIdx !== -1 && lastDatedIdx !== -1) {
      expect(firstNullIdx).toBeGreaterThan(lastDatedIdx);
    }
  });

  it('no two events share the exact same date|source|summary key', () => {
    const events = buildUnifiedTimeline(buildUnified());
    const keys = events.map((ev) => `${ev.date}|${ev.source}|${ev.summary}`);
    expect(keys.length).toBe(new Set(keys).size);
  });

  it('returns more events for a richer unified object than for a sparse one', () => {
    const richEvents = buildUnifiedTimeline(buildUnified());
    const sparseEvents = buildUnifiedTimeline({
      service: [{ branch: 'Army', startDate: '2000-01-01', endDate: '2004-01-01', hazardPayIndicators: [], deploymentLocations: [], combatVeteran: false }],
      str: { extractedFindings: { diagnoses: [], injuries: [], events: [] }, manualEntries: [] },
      currentTreatment: { extractedFindings: { currentConditions: [], functionalLimitations: [], treatmentEvents: [], evidenceSnippets: [] }, manualEntries: [] },
      ratingDecision: { manualEntries: [], extractedFindings: { serviceConnectedConditions: [], deniedConditions: [] } },
    });
    expect(richEvents.length).toBeGreaterThan(sparseEvents.length);
  });
});
