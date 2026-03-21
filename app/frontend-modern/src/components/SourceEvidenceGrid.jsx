import React from 'react';

function EvidenceColumn({ title, entries, emptyMessage }) {
  return (
    <div>
      <div style={{ fontWeight: 700, color: '#e8f1f7', marginBottom: '0.35rem', fontSize: '0.8rem' }}>
        {title}
      </div>
      <div style={{ display: 'grid', gap: '0.3rem' }}>
        {entries.length > 0 ? (
          entries.map((entry) => (
            <div
              key={`${entry.sourceType}-${entry.sourceName}-${entry.label}`}
              style={{ color: '#9db1c2', fontSize: '0.78rem', lineHeight: 1.5 }}
            >
              {entry.label}
              <span style={{ color: '#64748b', marginLeft: '0.35rem' }}>[{entry.sourceName}]</span>
            </div>
          ))
        ) : (
          <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{emptyMessage}</div>
        )}
      </div>
    </div>
  );
}

export function SourceEvidenceGrid({ sourceEvidence }) {
  const { current = [], inService = [], rated = [], denied = [] } = sourceEvidence || {};

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
      <EvidenceColumn title='Current Evidence' entries={current} emptyMessage='No current evidence linked.' />
      <EvidenceColumn title='In-Service Evidence' entries={inService} emptyMessage='No STR or event evidence linked.' />
      <div>
        <div style={{ fontWeight: 700, color: '#e8f1f7', marginBottom: '0.35rem', fontSize: '0.8rem' }}>
          Decision Support
        </div>
        <div style={{ display: 'grid', gap: '0.3rem' }}>
          {rated.length > 0 || denied.length > 0 ? (
            <>
              {rated.map((entry) => (
                <div
                  key={`rated-${entry.sourceName}-${entry.label}`}
                  style={{ color: '#9db1c2', fontSize: '0.78rem', lineHeight: 1.5 }}
                >
                  Rated: {entry.label}
                  <span style={{ color: '#64748b', marginLeft: '0.35rem' }}>[{entry.sourceName}]</span>
                </div>
              ))}
              {denied.map((entry) => (
                <div
                  key={`denied-${entry.sourceName}-${entry.label}`}
                  style={{ color: '#9db1c2', fontSize: '0.78rem', lineHeight: 1.5 }}
                >
                  Denied: {entry.label}
                  <span style={{ color: '#64748b', marginLeft: '0.35rem' }}>[{entry.sourceName}]</span>
                </div>
              ))}
            </>
          ) : (
            <div style={{ color: '#64748b', fontSize: '0.78rem' }}>No decision history linked.</div>
          )}
        </div>
      </div>
      <div>
        {/* Placeholder column to keep the 2-column grid balanced */}
      </div>
    </div>
  );
}
