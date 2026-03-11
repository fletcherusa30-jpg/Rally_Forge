import React, { useEffect, useMemo, useState } from 'react';

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
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  const loadHealth = async () => {
    try {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error(`Health fetch failed: ${response.status}`);
      const data = await response.json();
      setHealth(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to load system health');
    }
  };

  useEffect(() => {
    loadHealth();
    const id = setInterval(loadHealth, 10000);
    return () => clearInterval(id);
  }, []);

  const summary = useMemo(() => {
    if (!health) return { text: 'System Critical', className: 'fail' };

    const statuses = Object.values(health);
    if (statuses.some((value) => value === 'fail')) {
      return { text: 'System Critical', className: 'fail' };
    }
    if (statuses.some((value) => value === 'warn')) {
      return { text: 'System Degraded', className: 'warn' };
    }
    return { text: 'System Healthy', className: 'ok' };
  }, [health]);

  return (
    <div className='page-shell'>
      <section className='page-header'>
        <div>
          <div className='page-eyebrow'>Operations</div>
          <h1 className='page-title'>System Health</h1>
          <p className='page-copy'>Live status for backend dependencies and runtime components.</p>
        </div>
        <div className='page-badge'>Auto-refresh 10s</div>
      </section>

      <div className={`system-summary ${summary.className}`}>
        {summary.text}
      </div>

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
    </div>
  );
}
