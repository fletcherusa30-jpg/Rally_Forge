import { describe, expect, it } from 'vitest';
import { buildSuggestedDecisionEntries, buildSuggestedTreatmentEntries } from '../context/workspaceDerivations.js';

describe('buildSuggestedTreatmentEntries', () => {
  it('builds structured current-treatment suggestions from in-service evidence', () => {
    const suggestions = buildSuggestedTreatmentEntries([
      {
        condition: 'Lumbar strain',
        hasInServiceEvidence: true,
        hasCurrentDiagnosis: false,
        sourceEvidence: {
          inService: [
            {
              label: 'Lumbar strain',
              sourceName: 'STR upload 1',
              date: '2012-04-09',
              provider: 'Battalion Aid Station',
              severity: 'severe',
              summaryText: 'Low back pain after lifting equipment with limited range of motion.',
            },
          ],
        },
      },
    ]);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].conditionName).toBe('Lumbar strain');
    expect(suggestions[0].diagnosisDate).toBe('2012-04-09');
    expect(suggestions[0].provider).toBe('Battalion Aid Station');
    expect(suggestions[0].severity).toBe('severe');
    expect(suggestions[0].symptomSummary).toContain('Low back pain after lifting equipment');
  });
});

describe('buildSuggestedDecisionEntries', () => {
  it('builds structured VA manual-entry suggestions with evidence context', () => {
    const suggestions = buildSuggestedDecisionEntries([
      {
        condition: 'Sleep apnea',
        hasCurrentDiagnosis: true,
        alreadyRated: false,
        deniedPreviously: true,
        recommendedLane: 'Supplemental claim',
        readinessState: 'Developing',
        readinessScore: 74,
        readinessReason: 'Current diagnosis exists and prior denial may be overcome with stronger nexus evidence.',
        evidenceGaps: ['Medical nexus letter linking condition to service'],
        sourceEvidence: {
          current: [
            {
              label: 'Sleep apnea',
              sourceName: 'Pulmonary clinic note',
              summaryText: 'CPAP issued after sleep study confirmed obstructive sleep apnea.',
              date: '2023-08-15',
            },
          ],
          inService: [
            {
              label: 'Sleep apnea symptoms',
              sourceName: 'STR upload 2',
              summaryText: 'Snoring and daytime fatigue documented during active service.',
              date: '2011-02-10',
            },
          ],
        },
      },
    ]);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].condition).toBe('Sleep apnea');
    expect(suggestions[0].status).toBe('denied');
    expect(suggestions[0].suggestedLane).toBe('Supplemental claim');
    expect(suggestions[0].evidenceSummary).toContain('CPAP issued after sleep study');
    expect(suggestions[0].evidenceSummary).toContain('Snoring and daytime fatigue');
    expect(suggestions[0].evidenceGaps).toContain('Medical nexus letter linking condition to service');
  });
});