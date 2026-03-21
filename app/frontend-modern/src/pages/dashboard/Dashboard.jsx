import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/Card';
import { getCompensationData } from '../../api/client';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function buildPriorityQueue(summary) {
  const hasDependentsLoaded = Number(summary?.dependentMonthly || 0) > 0;
  const hasSmc = Number(summary?.smcMonthly || 0) > 0;

  return [
    {
      title: hasDependentsLoaded ? 'Confirm dependent details are current' : 'Review dependent eligibility now',
      priority: 'high',
      copy: hasDependentsLoaded
        ? 'Dependent compensation is active. Verify spouse/child details and effective dates are still accurate.'
        : 'No dependent compensation is showing. If you have eligible dependents, this can materially increase monthly pay.',
    },
    {
      title: hasSmc ? 'Validate SMC entitlement evidence' : 'Screen for SMC opportunities',
      priority: hasSmc ? 'medium' : 'high',
      copy: hasSmc
        ? 'SMC appears in your current estimate. Make sure the supporting evidence remains complete for continuation.'
        : 'No SMC is reflected. Check for qualifying loss-of-use, aid and attendance, or housebound criteria.',
    },
    {
      title: 'Build evidence packet for top denied condition',
      priority: 'medium',
      copy: 'Focus on one condition at a time: diagnosis + in-service event + nexus. This is the fastest way to improve claim quality.',
    },
  ];
}

export function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const priorityQueue = buildPriorityQueue(summary);

  useEffect(() => {
    getCompensationData()
      .then((data) => setSummary(data))
      .catch((err) => setError(err.message || 'Failed to load dashboard summary'));
  }, []);

  return (
    <div className='page-shell'>
      <section className='page-header'>
        <div>
          <div className='page-eyebrow'>Mission Control</div>
          <h1 className='page-title'>Dashboard</h1>
          <p className='page-copy'>
            A quick read on compensation output and the current operating posture of the Rally Forge workspace.
          </p>
        </div>
        <div className='page-badge'>Live backend summary</div>
      </section>

      <section className='dashboard-grid'>
        <div className='dashboard-hero'>
          <Card title='Compensation Snapshot'>
            {error ? <p className='inline-error'>{error}</p> : null}
            {!error && !summary ? <p>Loading summary...</p> : null}
            {summary ? (
              <div className='dashboard-metrics'>
                <div className='metric-chip'>
                  <div className='metric-label'>Base Monthly</div>
                  <div className='metric-value'>{formatCurrency(summary.baseMonthly)}</div>
                  <div className='metric-note'>Core monthly disability compensation.</div>
                </div>
                <div className='metric-chip'>
                  <div className='metric-label'>SMC Monthly</div>
                  <div className='metric-value'>{formatCurrency(summary.smcMonthly)}</div>
                  <div className='metric-note'>Special monthly compensation currently applied.</div>
                </div>
                <div className='metric-chip'>
                  <div className='metric-label'>Total Monthly</div>
                  <div className='metric-value'>{formatCurrency(summary.totalMonthly)}</div>
                  <div className='metric-note'>Current monthly payout estimate.</div>
                </div>
                <div className='metric-chip'>
                  <div className='metric-label'>Total Yearly</div>
                  <div className='metric-value'>{formatCurrency(summary.totalYearly)}</div>
                  <div className='metric-note'>Projected annualized benefit value.</div>
                </div>
              </div>
            ) : null}
          </Card>
        </div>

        <div className='dashboard-stack'>
          <Card title='Priority Queue'>
            <ul className='priority-list'>
              {priorityQueue.map((item, idx) => (
                <li key={`priority-${idx}`} className='priority-item'>
                  <div className='priority-topline'>
                    <span className='priority-title'>{item.title}</span>
                    <span className={`priority-badge ${item.priority}`}>{item.priority}</span>
                  </div>
                  <p className='priority-copy'>{item.copy}</p>
                </li>
              ))}
            </ul>
          </Card>
          <Card title='Operating Focus'>
            <p>Review scanner output, validate the claim narrative, then move directly into compensation and planning tools.</p>
          </Card>
          <Card title='Workspace Updates'>
            <p>Track newly generated artifacts, cleanup actions, and metadata health without leaving the app workflow.</p>
            <div style={{ marginTop: '14px' }}>
              <Link className='app-nav-link' to='/workspace-updates'>
                <span className='app-nav-icon'>UP</span>
                <span>Open Workspace Updates</span>
              </Link>
            </div>
          </Card>
          <Card title='Veteran Workflow Tip'>
            <p>Use the new Evidence Gap Finder inside STR and VA Decision pages to see exactly what missing evidence to gather next.</p>
          </Card>
        </div>
      </section>
    </div>
  );
}

