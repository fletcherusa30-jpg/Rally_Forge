import React from 'react';

export function ScoreFactorList({ scoreFactors }) {
  if (!scoreFactors || scoreFactors.length === 0) return null;

  return (
    <div style={{ display: 'grid', gap: '0.35rem' }}>
      {scoreFactors.map((factor) => {
        const positive = String(factor.impact || '').startsWith('+');
        return (
          <div
            key={`${factor.impact}-${factor.label}`}
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-start',
              fontSize: '0.8rem',
              color: '#d8e4ee',
              lineHeight: 1.5,
            }}
          >
            <span
              style={{
                fontWeight: 700,
                minWidth: '2.6rem',
                color: positive ? '#4db6ac' : '#f6b44c',
                flexShrink: 0,
              }}
            >
              {factor.impact}
            </span>
            <span>{factor.label}</span>
          </div>
        );
      })}
    </div>
  );
}
