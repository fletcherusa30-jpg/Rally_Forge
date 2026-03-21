import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useClaimWorkspace } from '../context/ClaimWorkspaceContext';
import { shouldAllowNavigation } from '../services/profile/profileNavigationGuard.js';

const primaryLinks = [
  { to: '/profile', icon: '01', label: 'Profile' },
  { to: '/military-service', icon: '02', label: 'Military Service' },
  { to: '/service-records', icon: '03', label: 'Service Treatment Records' },
  { to: '/current-treatment', icon: '04', label: 'Current Treatment' },
  { to: '/va-decision', icon: '05', label: 'VA Rating Decision' },
  { to: '/claim-generator-summary', icon: '06', label: 'Claim Generator & Summary' },
  { to: '/resources', icon: '07', label: 'Resources' },
];

const developerLinks = [
  { to: '/developers', icon: 'DV', label: 'Developers' },
];

function renderLink({ to, icon, label }, readiness, onNavigateAttempt) {
  const isComplete = Boolean(readiness?.[to]);
  const isOptionalStep = to === '/va-decision';
  const status = isComplete ? 'complete' : (isOptionalStep ? 'optional' : 'pending');
  const statusLabel = isComplete ? 'Ready' : (isOptionalStep ? 'Optional' : 'Pending');
  return (
    <NavLink
      key={to}
      to={to}
      onClick={(event) => onNavigateAttempt(event, to)}
      className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
    >
      <span className='app-nav-icon'>{icon}</span>
      <span className='app-nav-main'>
        <span className='app-nav-label'>{label}</span>
        <span className={`app-nav-status ${status}`}>
          {statusLabel}
        </span>
      </span>
    </NavLink>
  );
}

export function AppLayout({ children }) {
  const location = useLocation();
  const { workspace, workflow } = useClaimWorkspace();
  const hasUnsavedProfileChanges = Boolean(workspace?.profileEditor?.hasUnsavedChanges);

  const onNavigateAttempt = (event, targetPath) => {
    const allowed = shouldAllowNavigation({
      hasUnsavedChanges: hasUnsavedProfileChanges,
      currentPath: location.pathname,
      targetPath,
      confirmLeave: () => window.confirm('You have unsaved profile changes. Leave this page and discard unsaved edits?'),
    });

    if (!allowed) {
      event.preventDefault();
    }
  };
  const readinessByRoute = {
    '/profile': workflow.readiness.profile,
    '/military-service': workflow.readiness.militaryService,
    '/service-records': workflow.readiness.serviceTreatmentRecords,
    '/current-treatment': workflow.readiness.currentTreatment,
    '/va-decision': workflow.readiness.vaDecision,
    '/claim-generator-summary': workflow.readiness.claimGeneratorSummary,
    '/analyzer': workflow.readiness.claimGeneratorSummary,
    '/case-summary': workflow.readiness.claimGeneratorSummary,
    '/resources': workflow.readiness.resources,
  };
  const currentStepIndex = primaryLinks.findIndex((item) => item.to === location.pathname);
  const currentStepNumber = currentStepIndex >= 0 ? currentStepIndex + 1 : null;
  const previousStep = currentStepIndex > 0 ? primaryLinks[currentStepIndex - 1] : null;
  const nextStep = currentStepIndex >= 0 && currentStepIndex < primaryLinks.length - 1
    ? primaryLinks[currentStepIndex + 1]
    : null;

  return (
    <div className='app-shell'>
      <aside className='app-sidebar'>
        <div className='app-sidebar-scroll'>
          <div className='app-brand'>
            <div className='app-brand-kicker'>Veteran Claims Workspace</div>
            <div className='app-brand-title'>Rally Forge</div>
            <p className='app-brand-copy'>
              A working console for evidence review, rating analysis, scanner output, and benefit planning.
            </p>
          </div>

          <nav className='app-nav'>
            {primaryLinks.map((item) => renderLink(item, readinessByRoute, onNavigateAttempt))}
          </nav>

          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--rf-border)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--rf-text-soft)', marginBottom: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Developer Tools
            </div>
            <nav className='app-nav'>
              {developerLinks.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={(event) => onNavigateAttempt(event, item.to)}
                  className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
                >
                  <span className='app-nav-icon'>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        {currentStepNumber && (
          <div className='app-sidebar-footer'>
            <p style={{ fontSize: '0.72rem', color: 'var(--rf-text-soft)', marginBottom: '0.35rem' }}>
              Workflow Step {currentStepNumber} of {primaryLinks.length}
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--rf-text-muted)', marginBottom: '0.55rem' }}>
              {primaryLinks[currentStepIndex]?.label}
            </p>
            <p style={{ fontSize: '0.72rem', color: readinessByRoute[location.pathname] ? 'var(--rf-accent-cool)' : 'var(--rf-text-soft)', marginBottom: '0.55rem' }}>
              {readinessByRoute[location.pathname] ? 'Step has enough data to feed later tabs.' : 'This step still needs input before later tabs can fully synthesize it.'}
            </p>
            <div style={{ display: 'flex', gap: '0.45rem' }}>
              {previousStep ? (
                <Link
                  to={previousStep.to}
                  onClick={(event) => onNavigateAttempt(event, previousStep.to)}
                  className='app-nav-link'
                  style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}
                >
                  <span className='app-nav-icon'>{previousStep.icon}</span>
                  <span>Back</span>
                </Link>
              ) : (
                <div style={{ flex: 1 }} />
              )}

              {nextStep && (
                <Link
                  to={nextStep.to}
                  onClick={(event) => onNavigateAttempt(event, nextStep.to)}
                  className='app-nav-link'
                  style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}
                >
                  <span className='app-nav-icon'>{nextStep.icon}</span>
                  <span>Next</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </aside>

      <main className='app-main'>
        {children}
      </main>
    </div>
  );
}
