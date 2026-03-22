import React, { useState } from 'react';
import { placeholders } from '../../system/placeholders/index.js';

export function PromptInput({ onSubmit, disabled = false, loading = false }) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || typeof onSubmit !== 'function') return;

    await onSubmit(trimmed);
    setPrompt('');
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <textarea
        value={prompt}
        disabled={disabled || loading}
        onChange={(event) => setPrompt(event.target.value)}
        rows={4}
        placeholder={placeholders.ai.promptTextarea}
        style={{
          width: '100%',
          borderRadius: '0.375rem',
          border: '1px solid #334155',
          backgroundColor: '#0f172a',
          color: '#e2e8f0',
          padding: '0.625rem',
          fontSize: '0.875rem'
        }}
      />
      <button
        type='submit'
        disabled={disabled || loading || !prompt.trim()}
        style={{
          alignSelf: 'flex-start',
          padding: '0.5rem 0.875rem',
          borderRadius: '0.375rem',
          border: 'none',
          backgroundColor: '#14b8a6',
          color: '#0f172a',
          fontWeight: 600,
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          opacity: disabled || loading ? 0.6 : 1
        }}
      >
        {loading ? 'Running...' : 'Submit'}
      </button>
    </form>
  );
}
