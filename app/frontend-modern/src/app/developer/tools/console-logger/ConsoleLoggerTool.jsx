import React from 'react';

export function ConsoleLoggerTool({ entries = [], onClear }) {
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem' }}>
        <div style={{ color: 'var(--rf-text-soft)', fontSize: '0.82rem' }}>Internal tool log stream (not connected to browser console).</div>
        <button type='button' className='kb-button' onClick={onClear}>Clear Logs</button>
      </div>

      <div style={{ border: '1px solid var(--rf-border)', borderRadius: '0.65rem', background: 'rgba(8, 18, 28, 0.84)', minHeight: '260px', maxHeight: '420px', overflow: 'auto', padding: '0.7rem' }}>
        {entries.length === 0 ? (
          <div style={{ color: 'var(--rf-text-soft)', fontSize: '0.85rem' }}>No log entries yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            {entries.map((entry) => (
              <div key={entry.id} style={{ border: '1px solid rgba(148, 163, 184, 0.14)', borderRadius: '0.5rem', padding: '0.45rem', background: 'rgba(15, 23, 42, 0.6)' }}>
                <div style={{ fontSize: '0.72rem', color: '#bae6fd' }}>{entry.timestamp} | {entry.source}</div>
                <div style={{ marginTop: '0.2rem', color: 'var(--rf-text-muted)', fontSize: '0.84rem' }}>{entry.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
