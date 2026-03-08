import React, { useState } from 'react';
import { ModelSelector } from './ModelSelector';
import { RagToggle } from './RagToggle';
import { PromptInput } from './PromptInput';
import { ResponseDisplay } from './ResponseDisplay';

export function ChatWindow({ runLocalAI, runRAGQuery }) {
  const [modelName, setModelName] = useState('');
  const [ragEnabled, setRagEnabled] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePromptSubmit = async (prompt) => {
    setLoading(true);
    setError('');

    try {
      if (ragEnabled) {
        if (typeof runRAGQuery !== 'function') {
          throw new Error('runRAGQuery is not configured');
        }
        const result = await runRAGQuery(prompt, { modelName });
        setResponse(result || '');
      } else {
        if (typeof runLocalAI !== 'function') {
          throw new Error('runLocalAI is not configured');
        }
        const result = await runLocalAI(modelName, prompt, 'chat');
        setResponse(result || '');
      }
    } catch (submitError) {
      setError(submitError?.message || 'Failed to run AI request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ minWidth: '220px', flex: '0 0 220px' }}>
          <ModelSelector value={modelName} onChange={setModelName} disabled={loading} />
        </div>
        <RagToggle enabled={ragEnabled} onToggle={setRagEnabled} disabled={loading} />
      </div>

      <PromptInput onSubmit={handlePromptSubmit} disabled={false} loading={loading} />
      <ResponseDisplay response={response} error={error} />
    </section>
  );
}
