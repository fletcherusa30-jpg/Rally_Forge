import React, { useState } from 'react';
import { Card } from '../components/Card';
import { BudgetPlanner } from '../components/BudgetPlanner';
import { RetirementPlanner } from '../components/RetirementPlanner';
import resources from '../config/resources.json';

export function FinancialPlannerPage() {
  const [activeTab, setActiveTab] = useState('budget');

  return (
    <div className='page-shell'>
      <section className='page-header'>
        <div>
          <div className='page-eyebrow'>Planning</div>
          <h1 className='page-title'>Financial Planner</h1>
          <p className='page-copy'>
            Switch between budget and retirement tools with a common VA-oriented planning workflow.
          </p>
        </div>
        <div className='page-badge'>Dual planner mode</div>
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
              onClick={() => setActiveTab('retirement')}
              className={`tab-btn ${activeTab === 'retirement' ? 'active' : ''}`}
            >
              Retirement Planner
            </button>
        </div>

        {activeTab === 'budget' && <BudgetPlanner />}
        {activeTab === 'retirement' && <RetirementPlanner />}

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
