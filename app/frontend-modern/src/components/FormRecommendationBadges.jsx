import React from 'react';
import { getLaneRecommendation } from '../services/laneFormMap.js';

export function FormRecommendationBadges({ lane }) {
  const rec = getLaneRecommendation(lane);

  return (
    <div>
      <div
        style={{
          padding: '0.6rem',
          background: 'rgba(77, 182, 172, 0.06)',
          border: '1px solid rgba(77, 182, 172, 0.2)',
          borderRadius: '8px',
        }}
      >
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4db6ac', marginBottom: '0.35rem' }}>
          Required Forms
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.45rem' }}>
          {rec.forms.map((form) => (
            <span
              key={form}
              style={{
                background: 'rgba(77, 182, 172, 0.14)',
                border: '1px solid rgba(77, 182, 172, 0.3)',
                borderRadius: '5px',
                padding: '0.18rem 0.45rem',
                fontSize: '0.72rem',
                color: '#4db6ac',
              }}
            >
              {form}
            </span>
          ))}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9db1c2', lineHeight: 1.6 }}>{rec.tip}</div>
      </div>
    </div>
  );
}
