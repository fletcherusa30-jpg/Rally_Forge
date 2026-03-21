import React from 'react';

export function EvidenceIndexCard({ evidenceIndex }) {
  if (!evidenceIndex || evidenceIndex.length === 0) return null;

  return (
    <article className='rf-card' style={{ marginBottom: '1rem' }}>
      <h2 className='rf-card-title'>Evidence Index</h2>
      <div className='rf-card-body' style={{ display: 'grid', gap: '0.6rem' }}>
        <p style={{ color: '#9db1c2', margin: 0, fontSize: '0.85rem' }}>
          All source documents linked across condition workspaces — each document shown with the conditions it supports.
        </p>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {evidenceIndex.map((entry, i) => (
            <div
              key={`${entry.sourceName}-${i}`}
              style={{ border: '1px solid rgba(131, 169, 194, 0.18)', borderRadius: '8px', padding: '0.65rem' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontWeight: 600, color: '#d8e4ee' }}>{entry.sourceName}</div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: '#9db1c2',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {entry.sourceType}
                </div>
              </div>
              <div style={{ marginTop: '0.35rem', color: '#9db1c2', fontSize: '0.83rem' }}>
                Supports: {entry.conditions.join(' \u00b7 ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
