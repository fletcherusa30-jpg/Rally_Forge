import React from 'react';

export function ResponseDisplay({ response, error }) {
  if (error) {
    return (
      <div style={{ border: '1px solid #7f1d1d', backgroundColor: '#450a0a', color: '#fecaca', borderRadius: '0.375rem', padding: '0.75rem' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #334155', backgroundColor: '#0f172a', color: '#e2e8f0', borderRadius: '0.375rem', padding: '0.75rem', minHeight: '120px' }}>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.875rem' }}>
        {response || 'No response yet.'}
      </pre>
    </div>
  );
}
