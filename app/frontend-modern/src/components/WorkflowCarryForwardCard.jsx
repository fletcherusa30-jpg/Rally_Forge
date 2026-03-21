import React from 'react';

function normalizeDisplayValue(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ');
  }

  return String(value || '').trim();
}

export function WorkflowCarryForwardCard({ title = 'Carry Forward', description = '', items = [] }) {
  const visibleItems = (items || [])
    .map((item) => ({
      ...item,
      value: normalizeDisplayValue(item?.value),
    }))
    .filter((item) => item.value);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <article
      className='rf-card'
      style={{
        marginBottom: '1rem',
        border: '1px solid rgba(77, 182, 172, 0.28)',
        background: 'linear-gradient(135deg, rgba(19, 78, 74, 0.45), rgba(15, 23, 42, 0.92))',
      }}
    >
      <h2 className='rf-card-title'>{title}</h2>
      <div className='rf-card-body' style={{ display: 'grid', gap: '0.85rem' }}>
        {description && (
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.6 }}>
            {description}
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
          {visibleItems.map((item) => (
            <div
              key={item.label}
              style={{
                padding: '0.7rem',
                borderRadius: '0.75rem',
                border: '1px solid rgba(148, 163, 184, 0.22)',
                backgroundColor: 'rgba(15, 23, 42, 0.72)',
              }}
            >
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '0.35rem' }}>
                {item.label}
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: item.color || '#e2e8f0', lineHeight: 1.45 }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}