import React, { useEffect, useMemo, useState } from 'react';
import { clearScannerActivities, listScannerActivities } from '../../components/scanner/scannerActivityStore';

function statusColor(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return '#14b8a6';
  if (normalized === 'failed') return '#ef6f6c';
  if (normalized === 'processing') return '#f59e0b';
  return '#94a3b8';
}

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
}

export function ScannerActivityPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [scannerFilter, setScannerFilter] = useState('');
  const [items, setItems] = useState([]);

  const load = () => {
    setItems(listScannerActivities({ status: statusFilter, scannerType: scannerFilter }));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: synchronously reads localStorage on filter change
    load();
  }, [statusFilter, scannerFilter]);

  useEffect(() => {
    const listener = () => load();
    window.addEventListener('rf-scanner-activity-changed', listener);
    const interval = setInterval(load, 2000);
    return () => {
      window.removeEventListener('rf-scanner-activity-changed', listener);
      clearInterval(interval);
    };
  }, [statusFilter, scannerFilter]);

  const summary = useMemo(() => {
    const counts = { queued: 0, processing: 0, completed: 0, failed: 0 };
    items.forEach((item) => {
      const key = String(item?.status || 'queued').toLowerCase();
      if (counts[key] !== undefined) counts[key] += 1;
    });
    return counts;
  }, [items]);

  const handleClearCompleted = () => {
    if (summary.completed === 0) return;
    const confirmed = window.confirm(`Clear ${summary.completed} completed scanner activit${summary.completed === 1 ? 'y' : 'ies'}?`);
    if (!confirmed) return;
    clearScannerActivities({ status: 'completed' });
    load();
  };

  const handleClearAll = () => {
    if (items.length === 0) return;
    const confirmed = window.confirm(`Clear all ${items.length} scanner activity records? This cannot be undone.`);
    if (!confirmed) return;
    clearScannerActivities({});
    load();
  };

  return (
    <section className='page-shell'>
      <header className='page-header'>
        <div>
          <div className='page-eyebrow'>Scanner Ops</div>
          <h1 className='page-title'>Scanner Activity</h1>
          <p className='page-copy'>
            Unified activity log for all scanner uploads, processing progress, and result states.
          </p>
        </div>
        <div className='page-badge'>{items.length} items</div>
      </header>

      <article className='rf-card' style={{ marginBottom: '1rem' }}>
        <h2 className='rf-card-title'>Filters</h2>
        <div className='rf-card-body' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto', gap: '0.75rem', alignItems: 'end' }}>
          <div>
            <label className='profile-label'>Status</label>
            <select className='str-input' value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value=''>All</option>
              <option value='queued'>Queued</option>
              <option value='processing'>Processing</option>
              <option value='completed'>Completed</option>
              <option value='failed'>Failed</option>
            </select>
          </div>
          <div>
            <label className='profile-label'>Scanner</label>
            <select className='str-input' value={scannerFilter} onChange={(event) => setScannerFilter(event.target.value)}>
              <option value=''>All</option>
              <option value='va-rating-decision'>VA Rating Decision</option>
              <option value='service-treatment-records'>Service Treatment Records</option>
              <option value='scanner-hub'>Scanner Hub</option>
            </select>
          </div>
          <button type='button' className='btn-primary' onClick={load}>Refresh</button>
          <button type='button' className='btn-ghost-danger' onClick={handleClearCompleted} disabled={summary.completed === 0}>
            Clear Completed
          </button>
          <button type='button' className='btn-ghost-danger' onClick={handleClearAll} disabled={items.length === 0}>
            Clear All
          </button>
        </div>
      </article>

      <article className='rf-card' style={{ marginBottom: '1rem' }}>
        <h2 className='rf-card-title'>Summary</h2>
        <div className='rf-card-body' style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', color: 'var(--rf-text-muted)' }}>
          <span>Queued: <strong>{summary.queued}</strong></span>
          <span>Processing: <strong style={{ color: '#f59e0b' }}>{summary.processing}</strong></span>
          <span>Completed: <strong style={{ color: '#14b8a6' }}>{summary.completed}</strong></span>
          <span>Failed: <strong style={{ color: '#ef6f6c' }}>{summary.failed}</strong></span>
        </div>
      </article>

      <article className='rf-card'>
        <h2 className='rf-card-title'>Activity Log</h2>
        <div className='rf-card-body'>
          {items.length === 0 && <div>No scanner activity recorded for current filters.</div>}
          {items.length > 0 && (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {items.map((item) => (
                <div key={item.id} style={{ border: '1px solid var(--rf-border)', borderRadius: '12px', padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: 'var(--rf-text)', fontWeight: 700 }}>{item.fileName}</div>
                      <div style={{ color: 'var(--rf-text-muted)', fontSize: '0.78rem' }}>{item.scannerType}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: statusColor(item.status), fontWeight: 700, textTransform: 'uppercase', fontSize: '0.72rem' }}>{item.status || 'queued'}</div>
                      <div style={{ color: 'var(--rf-text-muted)', fontSize: '0.72rem' }}>{formatDate(item.updatedAt)}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--rf-text-muted)' }}>{item.message || 'No details'}</div>

                  <div style={{ marginTop: '0.5rem', height: '8px', background: '#0f172a', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(0, Math.min(100, Number(item.progress || 0)))}%`, height: '100%', background: statusColor(item.status), transition: 'width 160ms ease' }} />
                  </div>

                  <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--rf-text-soft)' }}>
                    Started: {formatDate(item.startedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
