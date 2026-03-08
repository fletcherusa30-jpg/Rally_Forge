import React from 'react';

export function Card({ title, children }) {
  return (
    <section style={{
      backgroundColor: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '0.5rem',
      padding: '1rem',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
    }}>
      {title && <h2 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#f1f5f9', marginBottom: '0.5rem' }}>{title}</h2>}
      <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
        {children}
      </div>
    </section>
  );
}
