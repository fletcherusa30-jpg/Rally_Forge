import React, { useState } from 'react';
import { Card } from '../components/Card';
import { BudgetPlanner } from '../components/BudgetPlanner';
import { RetirementPlanner } from '../components/RetirementPlanner';
import resources from '../config/resources.json';

export function FinancialPlannerPage() {
  const [activeTab, setActiveTab] = useState('budget');

  const tabStyle = (isActive) => ({
    padding: '0.75rem 1.5rem',
    backgroundColor: isActive ? '#3b82f6' : '#1e293b',
    color: isActive ? 'white' : '#94a3b8',
    border: 'none',
    borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600',
    transition: 'all 0.2s ease'
  });

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card title='Financial Planner'>
        <div style={{ borderBottom: '1px solid #334155', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('budget')}
              style={tabStyle(activeTab === 'budget')}
            >
              Budget Planner
            </button>
            <button
              onClick={() => setActiveTab('retirement')}
              style={tabStyle(activeTab === 'retirement')}
            >
              Retirement Planner
            </button>
          </div>
        </div>

        {activeTab === 'budget' && <BudgetPlanner />}
        {activeTab === 'retirement' && <RetirementPlanner />}

        <div style={{ 
          marginTop: '2rem', 
          paddingTop: '1.5rem', 
          borderTop: '1px solid #334155'
        }}>
          <h3 style={{ 
            fontSize: '1rem', 
            fontWeight: '600', 
            marginBottom: '0.75rem',
            color: '#e2e8f0'
          }}>
            Helpful Federal Tools
          </h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a 
              href={resources.externalTools.gsPayCalculator}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#1e293b',
                color: '#60a5fa',
                textDecoration: 'none',
                borderRadius: '0.375rem',
                border: '1px solid #334155',
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#334155';
                e.target.style.borderColor = '#60a5fa';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#1e293b';
                e.target.style.borderColor = '#334155';
              }}
            >
              <span>🧮</span>
              <span>GS Pay Calculator (FederalPay.org)</span>
              <span style={{ fontSize: '0.75rem' }}>↗</span>
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
