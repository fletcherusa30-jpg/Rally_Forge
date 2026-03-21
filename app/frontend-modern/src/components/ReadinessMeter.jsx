import React from 'react';

const STATE_COLORS = {
  'Claim-Ready': '#4db6ac',
  'Developing': '#f6b44c',
  'Needs Evidence': '#9db1c2',
};

export function ReadinessMeter({ score, state }) {
  const color = STATE_COLORS[state] || STATE_COLORS['Needs Evidence'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '0.78rem', color, fontWeight: 700 }}>{state}</span>
        <span style={{ fontSize: '0.78rem', color: '#d8e4ee', fontWeight: 700 }}>{score}%</span>
      </div>
      <div style={{ height: '6px', background: 'rgba(131, 169, 194, 0.18)', borderRadius: '3px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${score}%`,
            background: color,
            borderRadius: '3px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}
