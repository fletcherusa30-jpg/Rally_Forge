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
  if (status === 'ok') return 'bg-green-600';
  if (status === 'warn') return 'bg-yellow-500';
  return 'bg-red-600';
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
    if (!health) return { text: 'System Critical', className: 'bg-red-600' };

    const statuses = Object.values(health);
    if (statuses.some((value) => value === 'fail')) {
      return { text: 'System Critical', className: 'bg-red-600' };
    }
    if (statuses.some((value) => value === 'warn')) {
      return { text: 'System Degraded', className: 'bg-yellow-500' };
    }
    return { text: 'System Healthy', className: 'bg-green-600' };
  }, [health]);

  return (
    <div className='space-y-4'>
      <div className={`rounded-md p-4 text-xl font-bold text-white ${summary.className}`}>
        {summary.text}
      </div>

      {error && (
        <div className='rounded-md bg-red-600 p-3 text-sm text-white'>
          {error}
        </div>
      )}

      <div className='overflow-hidden rounded-md border border-slate-700'>
        {SYSTEM_KEYS.map((item) => {
          const status = health?.[item.key] || 'fail';
          return (
            <div
              key={item.key}
              className='flex items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-3 last:border-b-0'
            >
              <span className='text-sm text-slate-100'>{item.label}</span>
              <span className={`rounded px-2 py-1 text-xs font-semibold uppercase text-white ${badgeClass(status)}`}>
                {status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
