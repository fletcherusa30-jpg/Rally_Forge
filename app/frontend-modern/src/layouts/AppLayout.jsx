import React from 'react';
import { NavLink } from 'react-router-dom';

export function AppLayout({ children }) {
  const linkStyle = ({ isActive }) => ({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    color: isActive ? '#0f172a' : '#cbd5e1',
    textDecoration: 'none',
    padding: '0.5rem',
    border: '1px solid #334155',
    borderRadius: '0.375rem',
    backgroundColor: isActive ? '#14b8a6' : '#0f172a',
    fontSize: '0.875rem',
    fontWeight: isActive ? '600' : '400'
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#0f172a', color: '#f1f5f9' }}>
      <aside style={{ width: '256px', backgroundColor: '#0f172a', borderRight: '1px solid #1e293b', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1.5rem' }}>Rally Forge</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', flex: 1 }}>
          <NavLink to='/military-service' style={linkStyle}>🚀 Military Service</NavLink>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', marginTop: '0.5rem', marginBottom: '0.25rem', paddingLeft: '0.5rem' }}>SCANNERS</div>
          <NavLink to='/va-decision' style={linkStyle}>📄 VA Rating Decision</NavLink>
          <NavLink to='/service-records' style={linkStyle}>🏥 Service Treatment Records</NavLink>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', marginTop: '0.5rem', marginBottom: '0.25rem', paddingLeft: '0.5rem' }}>TOOLS</div>
          <NavLink to='/financial-planner' style={linkStyle}>💰 Financial Planner</NavLink>
          <NavLink to='/knowledge-base' style={linkStyle}>📚 Knowledge Base</NavLink>
          <NavLink to='/system-health' style={linkStyle}>🔧 System Health</NavLink>
          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #1e293b' }}>
            <NavLink to='/dashboard' style={linkStyle}>📊 Dashboard</NavLink>
          </div>
        </nav>
      </aside>
      <main style={{ flex: 1, padding: '1.5rem' }}>
        {children}
      </main>
    </div>
  );
}
