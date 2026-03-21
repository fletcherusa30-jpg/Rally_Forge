import React from 'react';
import { Link } from 'react-router-dom';
import { useClaimWorkspace } from '../context/ClaimWorkspaceContext.jsx';

export function ToolsPage() {
  const { workspace } = useClaimWorkspace();
  const layStatementTemplate = workspace?.claimGeneratorSummary?.layStatementTemplate
    || workspace?.claimGeneratorSummary?.layStatement
    || '';

  return (
    <section className='page-shell'>
      <header className='page-header'>
        <div>
          <div className='page-eyebrow'>Resources</div>
          <h1 className='page-title'>Resources</h1>
          <p className='page-copy'>
            Open supporting research and planning tools after reviewing the case summary.
          </p>
        </div>
        <div className='page-badge'>Step 8 tools</div>
      </header>

      <div className='dashboard-grid'>
        <article className='rf-card'>
          <h2 className='rf-card-title'>Financial Planner</h2>
          <div className='rf-card-body'>
            Estimate monthly and annual compensation scenarios from rating outcomes and dependency assumptions.
          </div>
          <div style={{ marginTop: '14px' }}>
            <Link className='app-nav-link' to='/financial-planner'>
              <span className='app-nav-icon'>01</span>
              <span>Open Financial Planner</span>
            </Link>
          </div>
        </article>

        <article className='rf-card'>
          <h2 className='rf-card-title'>Knowledge Base</h2>
          <div className='rf-card-body'>
            Review policy references, conditions, and prior guidance in one searchable workspace.
          </div>
          <div style={{ marginTop: '14px' }}>
            <Link className='app-nav-link' to='/knowledge-base'>
              <span className='app-nav-icon'>02</span>
              <span>Open Knowledge Base</span>
            </Link>
          </div>
        </article>

        <article className='rf-card'>
          <h2 className='rf-card-title'>State Benefits</h2>
          <div className='rf-card-body'>
            Track state and territory veteran benefit opportunities and document eligibility requirements.
          </div>
          <div style={{ marginTop: '14px' }}>
            <Link className='app-nav-link' to='/state-benefits'>
              <span className='app-nav-icon'>03</span>
              <span>Open State Benefits</span>
            </Link>
          </div>
        </article>

        <article className='rf-card'>
          <h2 className='rf-card-title'>Review Queue</h2>
          <div className='rf-card-body'>
            Inspect low-confidence extraction submissions, filter by status, and jump back to VA Decision review.
          </div>
          <div style={{ marginTop: '14px' }}>
            <Link className='app-nav-link' to='/review-queue'>
              <span className='app-nav-icon'>04</span>
              <span>Open Review Queue</span>
            </Link>
          </div>
        </article>

        <article className='rf-card'>
          <h2 className='rf-card-title'>Scanner Activity</h2>
          <div className='rf-card-body'>
            Watch uploads and scanner jobs in one place, including queued, processing, completed, and failed status.
          </div>
          <div style={{ marginTop: '14px' }}>
            <Link className='app-nav-link' to='/scanner-activity'>
              <span className='app-nav-icon'>05</span>
              <span>Open Scanner Activity</span>
            </Link>
          </div>
        </article>

        <article className='rf-card'>
          <h2 className='rf-card-title'>Workspace Updates</h2>
          <div className='rf-card-body'>
            Review newly generated audit artifacts, gated cleanup actions, and current metadata health in one place.
          </div>
          <div style={{ marginTop: '14px' }}>
            <Link className='app-nav-link' to='/workspace-updates'>
              <span className='app-nav-icon'>06</span>
              <span>Open Workspace Updates</span>
            </Link>
          </div>
        </article>

        <article className='rf-card' style={{ gridColumn: '1 / -1' }}>
          <h2 className='rf-card-title'>Claim Lay Statement Template</h2>
          <div className='rf-card-body'>
            This template is auto-populated from the unified claim dataset and generated conditions from Claim Generator.
          </div>
          <div
            style={{
              marginTop: '0.8rem',
              border: '1px solid rgba(148, 163, 184, 0.28)',
              borderRadius: '0.75rem',
              background: 'rgba(15, 23, 42, 0.72)',
              padding: '0.9rem',
              maxHeight: '26rem',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
              color: '#d8e4ee',
              fontSize: '0.86rem',
            }}
          >
            {layStatementTemplate || 'No lay statement template available yet. Open Claim Generator & Summary to synthesize conditions first.'}
          </div>
        </article>
      </div>
    </section>
  );
}
