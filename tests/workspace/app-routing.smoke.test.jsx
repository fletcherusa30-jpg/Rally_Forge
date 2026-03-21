import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

const getClaimWorkspaceMock = vi.fn();
const saveClaimWorkspaceMock = vi.fn();
const getPresumptiveKnowledgeMock = vi.fn();
const getStrsJobStatusMock = vi.fn();
const getCompensationDataMock = vi.fn();
const analyzeIntelligenceMock = vi.fn();
const submitExtractionReviewMock = vi.fn();

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return {
    ...actual,
    getClaimWorkspace: (...args) => getClaimWorkspaceMock(...args),
    saveClaimWorkspace: (...args) => saveClaimWorkspaceMock(...args),
    getPresumptiveKnowledge: (...args) => getPresumptiveKnowledgeMock(...args),
    getStrsJobStatus: (...args) => getStrsJobStatusMock(...args),
    getCompensationData: (...args) => getCompensationDataMock(...args),
    analyzeIntelligence: (...args) => analyzeIntelligenceMock(...args),
    submitExtractionReview: (...args) => submitExtractionReviewMock(...args),
  };
});

vi.mock('../hooks/useSystemAudit', () => ({
  useSystemAudit: () => ({
    health: {
      backend: 'ok',
      frontend: 'ok',
      scanner: 'ok',
      compensation: 'ok',
      financialPlanner: 'ok',
      diagnostic: 'ok',
      startup: 'ok',
    },
    audit: {
      endpointVersion: '1.0.0',
      schemaVersion: '1.0.0',
      confidence: { score: 1 },
      drift: { snapshot: { changed: false, schemaVersionChanged: false, changedStates: [] }, canonicalSchema: { mismatchSignals: [] } },
      audit: { missingStates: [], missingFields: [], validationFailures: [], counts: { outputStateRecords: 50 } },
      modernization: {},
      freshness: { sources: [] },
      health: { status: 'pass', unresolvedIssues: [] },
    },
    error: '',
    loading: false,
    summary: { className: 'ok', text: 'All systems nominal' },
  }),
}));

import App from '../App.jsx';

async function renderRoute(path) {
  window.history.pushState({}, '', path);
  await act(async () => {
    render(<App />);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('App route smoke tests', () => {
  beforeEach(() => {
    getClaimWorkspaceMock.mockReset();
    saveClaimWorkspaceMock.mockReset();
    getPresumptiveKnowledgeMock.mockReset();
    getStrsJobStatusMock.mockReset();
    getCompensationDataMock.mockReset();
    analyzeIntelligenceMock.mockReset();
    submitExtractionReviewMock.mockReset();

    getClaimWorkspaceMock.mockResolvedValue({ data: null });
    saveClaimWorkspaceMock.mockResolvedValue({ success: true });
    getPresumptiveKnowledgeMock.mockResolvedValue({ data: {} });
    getStrsJobStatusMock.mockResolvedValue({ success: true, status: 'completed', data: {} });
    getCompensationDataMock.mockResolvedValue({
      baseMonthly: 1000,
      smcMonthly: 0,
      totalMonthly: 1000,
      totalYearly: 12000,
      dependentMonthly: 0,
    });
    analyzeIntelligenceMock.mockResolvedValue({ success: true, data: {} });
    submitExtractionReviewMock.mockResolvedValue({ success: true });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input || '');

      if (url.includes('/api/audit/metadata')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              health: { status: 'warn', warnings: ['Current benefits snapshot unavailable'], errors: [] },
              freshness: { staleSources: [] },
            },
          }),
        };
      }

      if (url.includes('/api/military/records')) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        };
      }

      if (url.includes('/api/military/save-records')) {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }

      return {
        ok: true,
        json: async () => ({ success: true, data: {} }),
      };
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it.each([
    ['/profile', 'Profile'],
    ['/military-service', 'Military Service'],
    ['/service-records', 'Service Treatment Records'],
    ['/current-treatment', 'Current Treatment Records'],
    ['/va-decision', 'VA Rating Decision'],
    ['/dashboard', 'Dashboard'],
    ['/case-summary', 'Case Summary'],
    ['/resources', 'Resources'],
    ['/workspace-updates', 'Workspace Updates'],
    ['/system-health', 'System Health'],
  ])('renders %s from the top-level app router', async (path, heading) => {
    await renderRoute(path);

    expect(await screen.findByRole('heading', { name: heading })).toBeTruthy();
  });

  it('keeps the Workspace Updates page actions wired from the app router', async () => {
    await renderRoute('/workspace-updates');

    expect(await screen.findByRole('button', { name: 'Refresh Metadata' })).toBeTruthy();
  });

  it('keeps the Resources route card links wired from the app router', async () => {
    await renderRoute('/resources');

    expect(await screen.findByRole('link', { name: /Open Workspace Updates/i })).toBeTruthy();
  });

  it('keeps the System Health summary wired from the app router', async () => {
    await renderRoute('/system-health');

    expect(await screen.findByText('All systems nominal')).toBeTruthy();
  });
});
