import React from 'react';
import { Link } from 'react-router-dom';

const developerCards = [
  {
    title: 'Developer Tools Workbench',
    copy: 'Open isolated in-browser tooling: Monaco editor, schema validator, diff, regex, data explorer, and internal logger.',
    to: '/developer-tools-workbench',
    icon: 'DT',
    action: 'Open Developer Tools Workbench',
  },
  {
    title: 'System Health',
    copy: 'Inspect runtime health, audit freshness, unresolved issues, and modernization drift from one developer-facing dashboard.',
    to: '/system-health',
    icon: 'SH',
    action: 'Open System Health',
  },
  {
    title: 'Workspace Updates',
    copy: 'Review audit metadata, architecture scan output, auto-remediation status, and stored scanner false positives.',
    to: '/workspace-updates',
    icon: 'WU',
    action: 'Open Workspace Updates',
  },
];

export function DevelopersPage() {
  return (
    <section className='page-shell'>
      <header className='page-header'>
        <div>
          <div className='page-eyebrow'>Developers</div>
          <h1 className='page-title'>Developer Tools</h1>
          <p className='page-copy'>
            Runtime diagnostics, audit review, and scanner feedback tools that support maintenance and extraction tuning.
          </p>
        </div>
        <div className='page-badge'>Internal use</div>
      </header>

      <div className='dashboard-grid'>
        {developerCards.map((card) => (
          <article key={card.to} className='rf-card'>
            <h2 className='rf-card-title'>{card.title}</h2>
            <div className='rf-card-body'>{card.copy}</div>
            <div style={{ marginTop: '14px' }}>
              <Link className='app-nav-link' to={card.to}>
                <span className='app-nav-icon'>{card.icon}</span>
                <span>{card.action}</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}