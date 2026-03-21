import { createElement, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';

const starterByLanguage = {
  json: '{\n  "claimId": "RF-001",\n  "status": "draft"\n}',
  yaml: 'claimId: RF-001\nstatus: draft\n',
  plaintext: 'Type plain text here.'
};

export function MonacoEditorPanelTool({ onLog }) {
  const [language, setLanguage] = useState('json');
  const [value, setValue] = useState(starterByLanguage.json);

  const options = useMemo(
    () => ({
      minimap: { enabled: false },
      fontSize: 13,
      wordWrap: 'on',
      automaticLayout: true,
      scrollBeyondLastLine: false
    }),
    []
  );

  const onChangeLanguage = (event) => {
    const nextLanguage = event.target.value;
    setLanguage(nextLanguage);
    setValue((current) => (current.trim().length > 0 ? current : starterByLanguage[nextLanguage]));
    if (onLog) {
      onLog('Monaco Editor Panel', `Language switched to ${nextLanguage}.`);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: 'var(--rf-text-muted)' }}>
          Language
          <select value={language} onChange={onChangeLanguage} style={{ padding: '0.35rem 0.5rem', borderRadius: '0.45rem', border: '1px solid var(--rf-border)', background: 'rgba(9, 24, 37, 0.84)', color: 'var(--rf-text)' }}>
            <option value='json'>JSON</option>
            <option value='yaml'>YAML</option>
            <option value='plaintext'>Plain Text</option>
          </select>
        </label>
        <div style={{ fontSize: '0.75rem', color: 'var(--rf-text-soft)' }}>Auto-save is disabled.</div>
      </div>

      <div style={{ border: '1px solid var(--rf-border)', borderRadius: '0.7rem', overflow: 'hidden' }}>
        {createElement(Editor, {
          height: '420px',
          language: language === 'plaintext' ? 'plaintext' : language,
          value,
          onChange: (next) => setValue(next ?? ''),
          theme: 'vs-dark',
          options
        })}
      </div>
    </div>
  );
}
