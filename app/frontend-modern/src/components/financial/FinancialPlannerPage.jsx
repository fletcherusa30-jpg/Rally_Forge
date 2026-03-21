import React, { useState, lazy, Suspense } from 'react';
import { Card } from '../Card';
import resources from '../../config/resources.json';

const BudgetPlanner = lazy(() => import('./BudgetPlanner').then((m) => ({ default: m.BudgetPlanner })));
const RetirementPlanner = lazy(() => import('./RetirementPlanner').then((m) => ({ default: m.RetirementPlanner })));

function InlineLazyFallback({ message = 'Loading...' }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px',
        color: 'var(--rf-text-secondary)',
        fontSize: '0.875rem',
      }}
    >
      {message}
    </div>
  );
}

export function FinancialPlannerPage() {
  const [activeTab, setActiveTab] = useState('budget');
  const activeTabSubtitle =
    activeTab === 'budget'
      ? 'Track this month\'s income, bills, debt payments, and savings decisions.'
      : activeTab === 'retirement-planning'
        ? 'Build a forward-looking runway from today\'s savings to future retirement income.'
        : 'Stress-test your current retirement income, withdrawals, and longevity coverage.';

  return (
    <div className='page-shell'>
      <section className='page-header'>
        <div>
          <div className='page-eyebrow'>Planning</div>
          <h1 className='page-title'>Financial Planner</h1>
          <p className='page-copy'>
            Use three focused workflows: monthly cash-flow operations, retirement runway planning, and retired drawdown stability.
          </p>
        </div>
        <div className='page-badge'>Cash Flow · Runway · Drawdown</div>
      </section>

      <Card title='Financial Planner'>
        <div className='tab-strip'>
            <button
              onClick={() => setActiveTab('budget')}
              className={`tab-btn ${activeTab === 'budget' ? 'active' : ''}`}
            >
              Budget Planner
            </button>
            <button
              onClick={() => setActiveTab('retirement-planning')}
              className={`tab-btn ${activeTab === 'retirement-planning' ? 'active' : ''}`}
            >
              Planning for Retirement
            </button>
            <button
              onClick={() => setActiveTab('retirement-retired')}
              className={`tab-btn ${activeTab === 'retirement-retired' ? 'active' : ''}`}
            >
              Retired
            </button>
        </div>

        <p style={{ marginTop: '0.9rem', color: 'var(--rf-text-secondary)', fontSize: '0.9rem' }}>
          {activeTabSubtitle}
        </p>

        {activeTab === 'budget' && (
          <Suspense fallback={<InlineLazyFallback message='Loading budget planner...' />}>
            <BudgetPlanner />
          </Suspense>
        )}
        {activeTab === 'retirement-planning' && (
          <Suspense fallback={<InlineLazyFallback message='Loading retirement planning tools...' />}>
            <RetirementPlanner retirementStage='planning' />
          </Suspense>
        )}
        {activeTab === 'retirement-retired' && (
          <Suspense fallback={<InlineLazyFallback message='Loading retired planning tools...' />}>
            <RetirementPlanner retirementStage='retired' />
          </Suspense>
        )}

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(157, 177, 194, 0.14)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--rf-text)' }}>
            Helpful Federal Tools
          </h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a 
              href={resources.externalTools.gsPayCalculator}
              target="_blank"
              rel="noopener noreferrer"
              className='link-chip'
            >
              <span>04</span>
              <span>GS Pay Calculator (FederalPay.org)</span>
              <span style={{ fontSize: '0.75rem' }}>open</span>
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
