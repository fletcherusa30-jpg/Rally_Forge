import React from 'react';
import { NavLink } from 'react-router-dom';

const primaryLinks = [
  { to: '/military-service', icon: '01', label: 'Military Service' },
  { to: '/va-decision', icon: '02', label: 'VA Rating Decision' },
  { to: '/service-records', icon: '03', label: 'Service Treatment Records' },
];

const toolLinks = [
  { to: '/financial-planner', icon: '04', label: 'Financial Planner' },
  { to: '/knowledge-base', icon: '05', label: 'Knowledge Base' },
  { to: '/system-health', icon: '06', label: 'System Health' },
];

function renderLink({ to, icon, label }) {
  return (
    <NavLink key={to} to={to} className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
      <span className='app-nav-icon'>{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export function AppLayout({ children }) {
  return (
    <div className='app-shell'>
      <aside className='app-sidebar'>
        <div className='app-brand'>
          <div className='app-brand-kicker'>Veteran Claims Workspace</div>
          <div className='app-brand-title'>Rally Forge</div>
          <p className='app-brand-copy'>
            A working console for evidence review, rating analysis, scanner output, and benefit planning.
          </p>
        </div>

        <nav className='app-nav'>
          {primaryLinks.map(renderLink)}
          <div className='app-nav-section'>Operations</div>
          {toolLinks.map(renderLink)}
          <div className='app-nav-meta'>
            {renderLink({ to: '/dashboard', icon: '07', label: 'Dashboard' })}
          </div>
        </nav>
      </aside>

      <main className='app-main'>
        {children}
      </main>
    </div>
  );
}
