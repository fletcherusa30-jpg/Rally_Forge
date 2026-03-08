import React, { useEffect, useState } from 'react';

export function ModelSelector({ value, onChange, disabled = false }) {
  const [models, setModels] = useState([]);
  const [defaultModel, setDefaultModel] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadModels() {
      try {
        const response = await fetch('/ai/config.json');
        if (!response.ok) return;

        const config = await response.json();
        if (!isMounted) return;

        const loadedModels = Array.isArray(config?.models) ? config.models : [];
        const loadedDefault = typeof config?.defaultModel === 'string' ? config.defaultModel : loadedModels[0] || '';

        setModels(loadedModels);
        setDefaultModel(loadedDefault);

        if (!value && loadedDefault && typeof onChange === 'function') {
          onChange(loadedDefault);
        }
      } catch {
        if (!isMounted) return;
        setModels([]);
      }
    }

    loadModels();

    return () => {
      isMounted = false;
    };
  }, [onChange, value]);

  const selectedValue = value || defaultModel || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }} htmlFor='ai-model-selector'>
        AI Model
      </label>
      <select
        id='ai-model-selector'
        value={selectedValue}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        style={{
          padding: '0.5rem 0.625rem',
          borderRadius: '0.375rem',
          border: '1px solid #334155',
          backgroundColor: '#0f172a',
          color: '#e2e8f0',
          fontSize: '0.875rem'
        }}
      >
        {models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </div>
  );
}
