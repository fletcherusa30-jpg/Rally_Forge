import React from 'react';
import { ReadinessMeter } from '../ReadinessMeter.jsx';

const STATE_COLORS = {
  'Claim-Ready': '#4db6ac',
  Developing: '#f6b44c',
  'Needs Evidence': '#9db1c2',
};

export function ConditionCard({ item, isSelected, onClick, compact = false }) {
  const stateColor = STATE_COLORS[item.readinessState] || STATE_COLORS['Needs Evidence'];

  return (
    <button
      type='button'
      onClick={onClick}
      style={{
        textAlign: 'left',
        border: isSelected ? `1px solid ${stateColor}` : '1px solid rgba(131, 169, 194, 0.22)',
        borderRadius: compact ? '0.5rem' : '12px',
        padding: compact ? '0.8rem' : '0.85rem',
        backgroundColor: isSelected ? `rgba(77, 182, 172, 0.08)` : 'transparent',
        cursor: 'pointer',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.75rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '0.4rem',
        }}
      >
        <div style={{ fontWeight: 700, color: '#e8f1f7', fontSize: compact ? '0.85rem' : '0.9rem' }}>
          {item.condition}
        </div>
        <div style={{ fontSize: '0.72rem', color: stateColor, fontWeight: 600 }}>
          {item.readinessState} · {item.readinessScore}%
        </div>
      </div>

      <ReadinessMeter score={item.readinessScore} state={item.readinessState} />

      <div
        style={{
          marginTop: '0.45rem',
          fontSize: compact ? '0.72rem' : '0.75rem',
          color: '#9db1c2',
          lineHeight: 1.6,
        }}
      >
        <div>Lane: {item.recommendedLane}</div>
        <div>
          Evidence: {item.currentEvidence.length} current · {item.inServiceEvidence.length} in-service
        </div>
        <div>
          History:{' '}
          {item.alreadyRated ? 'Rated' : item.deniedPreviously ? 'Previously denied' : 'No rating history'}
        </div>
        {item.secondaryConnections?.length > 0 && (
          <div>
            Secondary links: {item.secondaryConnections.length}
          </div>
        )}
      </div>

      {item.evidenceGaps.length > 0 && (
        <div
          style={{
            marginTop: '0.4rem',
            fontSize: '0.72rem',
            color: '#f6b44c',
            lineHeight: 1.5,
          }}
        >
          {item.evidenceGaps[0]}
        </div>
      )}
    </button>
  );
}
