import React from 'react';

export function RagToggle({ enabled, onToggle, disabled = false }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
      <input
        type='checkbox'
        checked={Boolean(enabled)}
        disabled={disabled}
        onChange={(event) => onToggle?.(event.target.checked)}
      />
      Use RAG mode
    </label>
  );
}
