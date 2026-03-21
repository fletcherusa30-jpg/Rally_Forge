import React from 'react';
import { ReadinessMeter } from '../ReadinessMeter.jsx';
import { FormRecommendationBadges } from '../FormRecommendationBadges.jsx';
import { ScoreFactorList } from '../ScoreFactorList.jsx';
import { SourceEvidenceGrid } from '../SourceEvidenceGrid.jsx';
import { EvidenceGapList } from '../EvidenceGapList.jsx';

export function ConditionDetailPanel({ condition, compact = false }) {
  if (!condition) return null;

  const baseStyle = compact
    ? { backgroundColor: '#0b1220', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem' }
    : { border: '1px solid rgba(131, 169, 194, 0.22)', borderRadius: '12px', padding: '1rem', backgroundColor: 'rgba(11, 18, 32, 0.5)' };

  return (
    <div style={baseStyle}>
      <div
        style={{
          fontWeight: 700,
          color: '#e8f1f7',
          marginBottom: '0.75rem',
          fontSize: compact ? '0.9rem' : '1rem',
        }}
      >
        Condition Detail: {condition.condition}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '0.6rem',
          marginBottom: '0.75rem',
          fontSize: '0.75rem',
          color: '#9db1c2',
        }}
      >
        <div>Lane: {condition.recommendedLane}</div>
        <div>Aliases: {condition.aliases.join(', ') || 'None'}</div>
        <div>Manual sources: {condition.manualSourceCount}</div>
        <div>Uploaded: {condition.uploadedSourceCount}</div>
      </div>

      <div style={{ marginBottom: '0.85rem' }}>
        <ReadinessMeter score={condition.readinessScore} state={condition.readinessState} />
      </div>

      <div style={{ marginBottom: '0.85rem' }}>
        <FormRecommendationBadges lane={condition.recommendedLane} />
      </div>

      <div style={{ marginBottom: '0.85rem' }}>
        <div style={{ fontWeight: 700, color: '#e8f1f7', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
          Why this score
        </div>
        <ScoreFactorList scoreFactors={condition.scoreFactors} />
      </div>

      <div style={{ marginBottom: '0.85rem' }}>
        <div style={{ fontWeight: 700, color: '#e8f1f7', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
          Evidence Gaps
        </div>
        <EvidenceGapList evidenceGaps={condition.evidenceGaps} />
      </div>

      {condition.secondaryConnections?.length > 0 && (
        <div style={{ marginBottom: '0.85rem' }}>
          <div style={{ fontWeight: 700, color: '#e8f1f7', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
            Secondary Pathways
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {condition.secondaryConnections.map((item) => (
              <div
                key={`${condition.condition}-${item.primaryCondition}-${item.ruleId}`}
                style={{
                  border: '1px solid rgba(246, 180, 76, 0.26)',
                  borderRadius: '10px',
                  padding: '0.55rem 0.65rem',
                  backgroundColor: 'rgba(246, 180, 76, 0.08)',
                }}
              >
                <div style={{ color: '#fff2db', fontSize: '0.78rem', fontWeight: 600 }}>
                  Potential primary: {item.primaryCondition}
                </div>
                <div style={{ color: '#cbd5e1', fontSize: '0.75rem', marginTop: '0.25rem', lineHeight: 1.5 }}>
                  {item.rationale}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: '0.65rem' }}>
        <div style={{ fontWeight: 700, color: '#e8f1f7', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
          Evidence Sources
        </div>
        <SourceEvidenceGrid sourceEvidence={condition.sourceEvidence} />
      </div>

      <div style={{ fontSize: '0.8rem', color: '#d8e4ee', lineHeight: 1.6, borderTop: '1px solid rgba(131, 169, 194, 0.12)', paddingTop: '0.6rem' }}>
        {condition.readinessReason}
      </div>
    </div>
  );
}
