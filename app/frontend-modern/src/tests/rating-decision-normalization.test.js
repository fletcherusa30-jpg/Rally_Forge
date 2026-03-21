import { describe, expect, it } from 'vitest';
import {
  buildRatingTimeline,
  detectRatingConflicts,
  normalizeRatingDecisionUploadResult,
  normalizeManualEntry,
  validateManualEntry,
} from '../tabs/rating-decision/normalization.js';

describe('rating-decision normalization', () => {
  it('normalizes upload extraction payload into new extractedFindings schema', () => {
    const result = normalizeRatingDecisionUploadResult(
      {
        success: true,
        data: {
          metadata: { ratingDecisionDate: '2024-01-05' },
          ratingCalculation: { calculatedCombinedRating: 80 },
          serviceConnected: [
            {
              condition: 'PTSD',
              percentage: 70,
              effectiveDate: '2023-11-10',
              confidence: { score: 0.93 },
            },
          ],
          denied: [
            {
              condition: 'Sleep apnea',
              denialReason: 'No nexus',
              confidenceScore: 0.44,
            },
          ],
          smc: { explicit: ['SMC-K'] },
          dependentAdjustments: [{ label: 'Spouse added', effectiveDate: '2023-11-10' }],
          extractionContract: {
            evidenceSpans: [
              {
                section: 'serviceConnectedConditions',
                text: 'Service connection for PTSD is granted at 70 percent.',
                confidenceScore: 0.82,
              },
            ],
          },
        },
        quality: {
          sectionConfidence: {
            serviceConnected: 0.92,
            denied: 0.55,
            smc: 0.84,
            dependents: 0.83,
            combinedRating: 0.95,
            effectiveDates: 0.9,
          },
        },
      },
      'rating-decision.pdf'
    );

    expect(result.findings.combinedRating).toBe(80);
    expect(result.findings.serviceConnectedConditions).toHaveLength(1);
    expect(result.findings.serviceConnectedConditions[0].conditionName).toBe('post-traumatic stress disorder');
    expect(result.findings.serviceConnectedConditions[0].confidenceLevel).toBe('high');
    expect(result.findings.deniedConditions).toHaveLength(1);
    expect(result.findings.smcAdjustments[0].code).toBe('K');
    expect(result.findings.evidenceSpans).toHaveLength(1);
    expect(result.findings.decisionMetadata.fileName).toBe('rating-decision.pdf');
    expect(result.findings.confidenceBySection.serviceConnectedConditions).toBeCloseTo(0.92, 2);
  });

  it('detects percentage, date, and status conflicts between manual and scanned entries', () => {
    const manual = [
      normalizeManualEntry({
        conditionName: 'PTSD',
        percentage: '70',
        effectiveDate: '2023-01-01',
        isServiceConnected: true,
        isDenied: false,
      }),
      normalizeManualEntry({
        conditionName: 'Sleep apnea',
        percentage: '',
        effectiveDate: '2022-01-01',
        isServiceConnected: true,
        isDenied: false,
      }),
    ];

    const conflicts = detectRatingConflicts(manual, {
      serviceConnectedConditions: [
        {
          conditionName: 'post-traumatic stress disorder',
          percentage: 50,
          effectiveDate: '2022-06-01',
        },
      ],
      deniedConditions: [{ conditionName: 'sleep apnea' }],
    });

    const conflictTypes = conflicts.map((item) => item.conflictType);
    expect(conflictTypes).toContain('percentage-mismatch');
    expect(conflictTypes).toContain('effective-date-mismatch');
    expect(conflictTypes).toContain('status-mismatch');
  });

  it('builds timeline rows and marks staged ratings', () => {
    const timeline = buildRatingTimeline({
      manualEntries: [
        {
          conditionName: 'PTSD',
          percentage: 50,
          effectiveDate: '2021-01-01',
          isDenied: false,
        },
      ],
      extractedFindings: {
        serviceConnectedConditions: [
          {
            conditionName: 'post-traumatic stress disorder',
            percentage: 70,
            effectiveDate: '2023-01-01',
          },
        ],
        deniedConditions: [],
      },
    });

    expect(timeline).toHaveLength(1);
    expect(timeline[0].conditionName).toBe('post-traumatic stress disorder');
    expect(timeline[0].events).toHaveLength(2);
    expect(timeline[0].staged).toBe(true);
  });

  it('validates mutually exclusive service-connected and denied flags', () => {
    const errors = validateManualEntry(
      {
        conditionName: 'PTSD',
        percentage: '70',
        effectiveDate: '2023-01-01',
        isServiceConnected: true,
        isDenied: true,
      },
      []
    );

    expect(errors.serviceConnection).toMatch(/cannot both be true/i);
  });

  it('validates duplicate manual entries by normalized condition', () => {
    const existing = [
      normalizeManualEntry({
        id: 'a',
        conditionName: 'PTSD',
        percentage: '70',
        effectiveDate: '2023-01-01',
        isServiceConnected: true,
      }),
    ];

    const errors = validateManualEntry(
      normalizeManualEntry({
        conditionName: 'post-traumatic stress disorder',
        percentage: '50',
        effectiveDate: '2024-01-01',
        isServiceConnected: true,
      }),
      existing
    );

    expect(errors.duplicate).toBeTruthy();
  });
});
