import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../context/ClaimWorkspaceContext', () => ({
  useClaimWorkspace: () => ({
    workspace: { profileEditor: { hasUnsavedChanges: false } },
    workflow: {
      readiness: {
        profile: true,
        militaryService: true,
        serviceTreatmentRecords: true,
        currentTreatment: true,
        vaDecision: true,
        analyzer: true,
        caseSummary: true,
        resources: true,
      },
    },
  }),
}));

vi.mock('../services/profile/profileNavigationGuard.js', () => ({
  shouldAllowNavigation: () => true,
}));

import { AppLayout } from '../layouts/AppLayout.jsx';

describe('AppLayout operations navigation', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders direct operations links for system health and workspace updates', () => {
    render(
      <MemoryRouter
        initialEntries={['/profile']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AppLayout>
          <div>Child content</div>
        </AppLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /System Health/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Workspace Updates/i })).toBeTruthy();
  });
});

