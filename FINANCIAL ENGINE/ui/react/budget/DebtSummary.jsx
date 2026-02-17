import React from 'react';

export function DebtSummary({ debts }) {
  if (!debts || debts.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: '0.95rem', marginBottom: 4 }}>Debt Overview (Snowball)</h3>
      <ul style={{ fontSize: '0.85rem', paddingLeft: 16 }}>
        {debts.map((d, idx) => (
          <li key={idx}>
            {d.Name}: Balance 
          </li>
        ))}
      </ul>
    </div>
  );
}
