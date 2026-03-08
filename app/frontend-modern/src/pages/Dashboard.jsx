import React, { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { getCompensationData } from '../api/client';

export function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getCompensationData()
      .then((data) => setSummary(data))
      .catch((err) => setError(err.message || 'Failed to load dashboard summary'));
  }, []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
      <Card title='Dashboard Summary'>
        {error && <p style={{ color: '#f87171' }}>{error}</p>}
        {!error && !summary && <p>Loading summary...</p>}
        {summary && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p>Base Monthly: ${summary.baseMonthly}</p>
            <p>SMC Monthly: ${summary.smcMonthly}</p>
            <p>Total Monthly: ${summary.totalMonthly}</p>
            <p>Total Yearly: ${summary.totalYearly}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
