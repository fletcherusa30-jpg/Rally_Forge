import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { developerToolsRegistry } from './tools';

export function DeveloperToolsWorkbenchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const validToolIds = useMemo(() => developerToolsRegistry.map((tool) => tool.id), []);
  const requestedToolId = searchParams.get('tool') || '';
  const defaultToolId = developerToolsRegistry[0]?.id || '';
  const activeToolId = validToolIds.includes(requestedToolId) ? requestedToolId : defaultToolId;
  const [entries, setEntries] = useState([]);

  const activeTool = useMemo(
    () => developerToolsRegistry.find((tool) => tool.id === activeToolId) || developerToolsRegistry[0],
    [activeToolId]
  );

  const appendLog = (source, message) => {
    setEntries((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        source,
        message
      },
      ...current
    ]);
  };

  const clearLogs = () => setEntries([]);
  const ActiveComponent = activeTool?.Component;

  useEffect(() => {
    if (!validToolIds.includes(requestedToolId) && defaultToolId) {
      const next = new URLSearchParams(searchParams);
      next.set('tool', defaultToolId);
      setSearchParams(next, { replace: true });
    }
  }, [defaultToolId, requestedToolId, searchParams, setSearchParams, validToolIds]);

  const selectTool = (toolId) => {
    const next = new URLSearchParams(searchParams);
    next.set('tool', toolId);
    setSearchParams(next, { replace: true });
  };

  const copyDeepLink = async () => {
    const relative = `/developer-tools-workbench?tool=${activeTool?.id || ''}`;
    const absolute = `${window.location.origin}${relative}`;
    try {
      await navigator.clipboard.writeText(absolute);
      appendLog('Developer Tools Workbench', `Copied deep link for ${activeTool?.id}.`);
    } catch {
      appendLog('Developer Tools Workbench', 'Copy failed. Clipboard permissions may be blocked.');
    }
  };

  return (
    <section className='page-shell'>
      <header className='page-header'>
        <div>
          <div className='page-eyebrow'>Developers</div>
          <h1 className='page-title'>Developer Tools Workbench</h1>
          <p className='page-copy'>Isolated, client-side tools for editing, validation, diffing, regex testing, dataset exploration, and internal logging.</p>
        </div>
        <div className='page-badge'>Sandboxed tools</div>
      </header>

      <section className='rf-card'>
        <h2 className='rf-card-title'>Tool Navigation</h2>
        <div className='rf-card-body'>
          <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: '0.9rem' }}>
            <aside style={{ border: '1px solid var(--rf-border)', borderRadius: '0.7rem', overflow: 'hidden', background: 'rgba(9, 24, 37, 0.62)' }}>
              {developerToolsRegistry.map((tool) => {
                const active = tool.id === activeTool?.id;
                return (
                  <button
                    key={tool.id}
                    type='button'
                    onClick={() => selectTool(tool.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.65rem 0.7rem',
                      border: 'none',
                      borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
                      background: active ? 'rgba(246, 180, 76, 0.18)' : 'transparent',
                      color: active ? '#fff3dc' : 'var(--rf-text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{tool.title}</div>
                    <div style={{ marginTop: '0.2rem', fontSize: '0.75rem', color: active ? '#fcd59e' : 'var(--rf-text-soft)' }}>{tool.description}</div>
                  </button>
                );
              })}
            </aside>

            <article style={{ border: '1px solid var(--rf-border)', borderRadius: '0.7rem', background: 'rgba(9, 24, 37, 0.62)', padding: '0.8rem' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff3dc' }}>{activeTool?.title}</h3>
                <p style={{ margin: '0.3rem 0 0', color: 'var(--rf-text-soft)', fontSize: '0.84rem' }}>{activeTool?.description}</p>
                <p style={{ margin: '0.4rem 0 0', color: 'var(--rf-text-soft)', fontSize: '0.72rem' }}>
                  Deep link: /developer-tools-workbench?tool={activeTool?.id}
                </p>
                <button
                  type='button'
                  className='kb-button'
                  onClick={copyDeepLink}
                  style={{ marginTop: '0.4rem', padding: '0.35rem 0.6rem', fontSize: '0.72rem' }}
                >
                  Copy Deep Link
                </button>
              </div>

              {ActiveComponent ? (
                <ActiveComponent onLog={appendLog} entries={entries} onClear={clearLogs} />
              ) : (
                <div style={{ color: '#fecaca' }}>No component available for this tool.</div>
              )}
            </article>
          </div>
        </div>
      </section>
    </section>
  );
}
