import React, { useMemo } from 'react';
import { useSystemAudit } from '../../hooks/useSystemAudit';

const SYSTEM_KEYS = [
  { key: 'backend', label: 'Backend' },
  { key: 'frontend', label: 'Frontend' },
  { key: 'scanner', label: 'Scanner' },
  { key: 'compensation', label: 'Compensation' },
  { key: 'financialPlanner', label: 'Financial Planner' },
  { key: 'diagnostic', label: 'Diagnostic' },
  { key: 'startup', label: 'Startup' }
];

function badgeClass(status) {
  if (status === 'ok') return 'ok';
  if (status === 'warn') return 'warn';
  return 'fail';
}

export function SystemHealth() {
  const {
    health,
    audit,
    error,
    loading,
    summary,
    reload = () => {},
    lastUpdated = null,
  } = useSystemAudit({ refreshMs: 10000 });

  const modernizationItems = useMemo(() => {
    const modernization = audit?.modernization || {};
    return Object.entries(modernization).map(([key, value]) => ({
      key,
      label: key === 'ui' ? 'UI' : key === 'caseSummary' ? 'Case Summary' : key.charAt(0).toUpperCase() + key.slice(1),
      status: value?.status || 'unknown',
      missing: Array.isArray(value?.missing) ? value.missing : [],
    }));
  }, [audit]);

  const staleSources = audit?.freshness?.sources || [];
  const unresolvedIssues = audit?.health?.unresolvedIssues || [];

  return (
    <div className='page-shell'>
      <section className='page-header'>
        <div>
          <div className='page-eyebrow'>Developers</div>
          <h1 className='page-title'>System Health</h1>
          <p className='page-copy'>Developer-facing runtime status for backend dependencies, audit freshness, and supporting services.</p>
        </div>
        <div className='page-badge'>{loading ? 'Refreshing...' : 'Auto-refresh 10s'}</div>
      </section>

      <article className='rf-card' style={{ marginBottom: '1rem' }}>
        <div className='rf-card-body' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ color: 'var(--rf-text-muted)' }}>
            Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Waiting for first refresh'}
          </div>
          <button type='button' className='btn-primary' onClick={reload} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh Status'}
          </button>
        </div>
      </article>

      <div className={`system-summary ${summary.className}`}>
        {summary.text}
      </div>

      {audit && (
        <div className='dashboard-grid' style={{ marginBottom: '1rem' }}>
          <article className='rf-card'>
            <h2 className='rf-card-title'>Audit Contract</h2>
            <div className='rf-card-body'>
              Endpoint Version: {audit.endpointVersion}<br />
              Schema Version: {audit.schemaVersion}<br />
              Audit Health: {audit.health?.status || 'unknown'}<br />
              Confidence: {Math.round(Number(audit.confidence?.score || 0) * 100)}%
            </div>
          </article>

          <article className='rf-card'>
            <h2 className='rf-card-title'>Drift Status</h2>
            <div className='rf-card-body'>
              Snapshot Changed: {audit.drift?.snapshot?.changed ? 'Yes' : 'No'}<br />
              Schema Changed: {audit.drift?.snapshot?.schemaVersionChanged ? 'Yes' : 'No'}<br />
              Changed States: {(audit.drift?.snapshot?.changedStates || []).length}<br />
              Schema Gaps: {(audit.drift?.canonicalSchema?.mismatchSignals || []).length}
            </div>
          </article>

          <article className='rf-card'>
            <h2 className='rf-card-title'>Benefits Coverage</h2>
            <div className='rf-card-body'>
              Missing States: {audit.audit?.missingStates?.length || 0}<br />
              Missing Fields: {audit.audit?.missingFields?.length || 0}<br />
              Validation Failures: {audit.audit?.validationFailures?.length || 0}<br />
              Output States: {audit.audit?.counts?.outputStateRecords || 0}
            </div>
          </article>
        </div>
      )}

      {error && (
        <div className='rf-card inline-error'>
          {error}
        </div>
      )}

      <div className='system-list'>
        {SYSTEM_KEYS.map((item) => {
          const status = health?.[item.key] || 'fail';
          return (
            <div key={item.key} className='system-row'>
              <span className='system-label'>{item.label}</span>
              <span className={`system-pill ${badgeClass(status)}`}>
                {status}
              </span>
            </div>
          );
        })}
      </div>

      {audit && (
        <div className='dashboard-grid' style={{ marginTop: '1rem' }}>
          <article className='rf-card'>
            <h2 className='rf-card-title'>Modernization</h2>
            <div className='rf-card-body' style={{ display: 'grid', gap: '0.5rem' }}>
              {modernizationItems.map((item) => (
                <div key={item.key} className='system-row'>
                  <span className='system-label'>{item.label}</span>
                  <span className={`system-pill ${badgeClass(item.status === 'modernized' ? 'ok' : item.status === 'partial' ? 'warn' : 'fail')}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className='rf-card'>
            <h2 className='rf-card-title'>Freshness</h2>
            <div className='rf-card-body' style={{ display: 'grid', gap: '0.5rem' }}>
              {staleSources.length === 0 && <div>All monitored audit sources are within freshness thresholds.</div>}
              {staleSources.map((item) => (
                <div key={item.source} style={{ borderBottom: '1px solid rgba(131, 169, 194, 0.18)', paddingBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 700 }}>{item.source}</div>
                  <div style={{ color: '#9db1c2', fontSize: '0.82rem' }}>
                    {item.path} • {item.found ? `${item.ageMinutes ?? 'n/a'} min old` : 'missing'} • threshold {item.maxAgeMinutes ?? 'n/a'} min
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className='rf-card'>
            <h2 className='rf-card-title'>Unresolved Issues</h2>
            <div className='rf-card-body'>
              {unresolvedIssues.length === 0 ? (
                <div>No unresolved issues reported by the audit endpoint.</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '1rem', lineHeight: 1.6 }}>
                  {unresolvedIssues.slice(0, 8).map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
