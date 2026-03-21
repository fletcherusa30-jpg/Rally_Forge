import React from 'react';

export function EvidenceGapList({ evidenceGaps }) {
  const gaps = Array.isArray(evidenceGaps) ? evidenceGaps : [];

  if (gaps.length === 0) {
    return <div style={{ color: '#9db1c2', fontSize: '0.8rem' }}>No major gaps identified.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: '0.35rem' }}>
      {gaps.map((gap) => (
        <div key={gap} style={{ color: '#f6b44c', fontSize: '0.8rem', lineHeight: 1.6 }}>
          {gap}
        </div>
      ))}
    </div>
  );
}
