import { useMemo, useState } from 'react';

const jsonFiles = import.meta.glob('../../../../../../../knowledge/{dbq,mos,exposures,cfr,analyzer}/**/*.json', {
  query: '?raw',
  import: 'default'
});

export function DataExplorerTool({ onLog }) {
  const [selectedPath, setSelectedPath] = useState('');
  const [rawJson, setRawJson] = useState('');
  const [parsedJson, setParsedJson] = useState(null);
  const [error, setError] = useState('');
  const [expandedPaths, setExpandedPaths] = useState(() => new Set(['root']));
  const filePaths = useMemo(() => Object.keys(jsonFiles).sort(), []);

  const togglePath = (pathKey) => {
    setExpandedPaths((previous) => {
      const next = new Set(previous);
      if (next.has(pathKey)) {
        next.delete(pathKey);
      } else {
        next.add(pathKey);
      }
      return next;
    });
  };

  const renderNode = (nodeKey, value, depth = 0, pathKey = nodeKey) => {
    const isObject = value !== null && typeof value === 'object';
    if (!isObject) {
      return (
        <div key={pathKey} style={{ paddingLeft: `${depth * 12}px`, fontSize: '0.82rem', color: 'var(--rf-text-muted)' }}>
          <strong style={{ color: 'var(--rf-text)' }}>{nodeKey}:</strong> {String(value)}
        </div>
      );
    }

    const entries = Array.isArray(value)
      ? value.map((entry, index) => [String(index), entry])
      : Object.entries(value);
    const open = expandedPaths.has(pathKey);

    return (
      <div key={pathKey} style={{ paddingLeft: `${depth * 12}px` }}>
        <button
          type='button'
          onClick={() => togglePath(pathKey)}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--rf-text)',
            cursor: 'pointer',
            padding: 0,
            fontSize: '0.82rem'
          }}
        >
          {open ? '[-]' : '[+]'} {nodeKey}
        </button>
        {open && (
          <div style={{ marginTop: '0.2rem', display: 'grid', gap: '0.2rem' }}>
            {entries.map(([key, item]) => renderNode(key, item, depth + 1, `${pathKey}.${key}`))}
          </div>
        )}
      </div>
    );
  };

  const loadFile = async (path) => {
    setSelectedPath(path);
    setError('');
    setRawJson('');
    setParsedJson(null);
    setExpandedPaths(new Set(['root']));

    try {
      const loader = jsonFiles[path];
      if (!loader) {
        throw new Error('Selected file is not available.');
      }
      const content = await loader();
      const parsed = JSON.parse(content);
      setRawJson(content);
      setParsedJson(parsed);
      onLog?.('Data Explorer', `Loaded ${path.replace(/^.*\\knowledge\\/, 'knowledge/')}.`);
    } catch (loadError) {
      setError(loadError.message);
      onLog?.('Data Explorer', `Load failed: ${loadError.message}`);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ fontSize: '0.82rem', color: 'var(--rf-text-soft)' }}>
        Read-only JSON browser for /knowledge/dbq, /knowledge/mos, /knowledge/exposures, /knowledge/cfr, and /knowledge/analyzer.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: '0.75rem' }}>
        <div style={{ border: '1px solid var(--rf-border)', borderRadius: '0.6rem', background: 'rgba(9, 24, 37, 0.64)', maxHeight: '460px', overflow: 'auto' }}>
          {filePaths.length === 0 ? (
            <div style={{ padding: '0.75rem', color: 'var(--rf-text-soft)' }}>No files discovered in the configured knowledge directories.</div>
          ) : (
            <div style={{ display: 'grid' }}>
              {filePaths.map((path) => {
                const display = path.replace(/^.*knowledge\//, 'knowledge/');
                const active = selectedPath === path;
                return (
                  <button
                    key={path}
                    type='button'
                    onClick={() => loadFile(path)}
                    style={{
                      textAlign: 'left',
                      border: 'none',
                      borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
                      background: active ? 'rgba(77, 182, 172, 0.16)' : 'transparent',
                      color: active ? '#d1fae5' : 'var(--rf-text-muted)',
                      padding: '0.55rem 0.65rem',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    {display}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '0.75rem' }}>
          <div style={{ border: '1px solid var(--rf-border)', borderRadius: '0.6rem', padding: '0.7rem', overflow: 'auto', background: 'rgba(9, 24, 37, 0.64)' }}>
            <div style={{ color: 'var(--rf-accent)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.76rem', marginBottom: '0.45rem' }}>Tree Viewer</div>
            {error ? (
              <div style={{ color: '#fecaca' }}>{error}</div>
            ) : parsedJson ? (
              renderNode('root', parsedJson)
            ) : (
              <div style={{ color: 'var(--rf-text-soft)' }}>Choose a JSON file to inspect.</div>
            )}
          </div>

          <div style={{ border: '1px solid var(--rf-border)', borderRadius: '0.6rem', padding: '0.7rem', overflow: 'auto', background: 'rgba(9, 24, 37, 0.64)' }}>
            <div style={{ color: 'var(--rf-accent)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.76rem', marginBottom: '0.45rem' }}>Pretty JSON</div>
            <pre style={{ margin: 0, color: 'var(--rf-text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {parsedJson ? JSON.stringify(parsedJson, null, 2) : ''}
            </pre>
          </div>
        </div>
      </div>

      {rawJson && (
        <div style={{ color: 'var(--rf-text-soft)', fontSize: '0.74rem' }}>
          Loaded size: {rawJson.length.toLocaleString()} characters.
        </div>
      )}
    </div>
  );
}
