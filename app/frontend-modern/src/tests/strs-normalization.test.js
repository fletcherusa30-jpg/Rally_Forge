import { describe, expect, it } from 'vitest';
import {
  buildConfidenceLevels,
  buildDedupedTimeline,
  dedupeFindings,
  normalizeUploadResultToFindings,
  scoreToConfidenceLevel,
} from '../tabs/strs/normalization.js';

describe('STR normalization helpers', () => {
  it('assigns confidence levels from numeric score', () => {
    expect(scoreToConfidenceLevel(0.85)).toBe('high');
    expect(scoreToConfidenceLevel(0.7)).toBe('medium');
    expect(scoreToConfidenceLevel(0.4)).toBe('low');
  });

  it('normalizes upload results and extracts all required categories', () => {
    const findings = normalizeUploadResultToFindings({
      metadata: { fileName: 'strs.pdf' },
      Extracted: {
        Diagnoses: [{ label: 'Lumbar strain', confidence: { score: 0.91 } }],
        Injuries: [{ label: 'Shoulder injury', confidence: { score: 0.66 } }],
        Events: [{ label: 'Blast exposure event', confidence: { score: 0.58 } }],
        PresumptiveLocations: [{ location: 'Camp Lejeune', confidence: { score: 0.47 } }],
      },
    });

    expect(findings.length).toBe(4);
    expect(findings.map((item) => item.findingType)).toEqual(
      expect.arrayContaining(['diagnosis', 'injury', 'event', 'presumptive-location'])
    );
  });

  it('dedupes findings and merges timeline points', () => {
    const deduped = dedupeFindings([
      {
        id: 'a',
        findingType: 'diagnosis',
        conditionName: 'Tinnitus',
        dateOfEvent: '2014-01-01',
        dates: ['2014-01-01'],
        confidenceLevel: 'medium',
        confidenceScore: 0.65,
      },
      {
        id: 'b',
        findingType: 'diagnosis',
        conditionName: 'Tinnitus',
        dateOfEvent: '2014-01-01',
        dates: ['2014-01-01', '2014-02-01'],
        confidenceLevel: 'high',
        confidenceScore: 0.9,
      },
    ]);

    expect(deduped.length).toBe(1);
    expect(deduped[0].confidenceLevel).toBe('high');

    const timeline = buildDedupedTimeline(deduped);
    expect(timeline.length).toBe(2);

    const confidence = buildConfidenceLevels(deduped);
    expect(confidence.high).toBe(1);
  });
});
