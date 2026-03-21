import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

async function renderAt(path) {
  window.history.pushState({}, '', path);
  await act(async () => {
    render(<App />);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('App navigation interactions', () => {
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

  it('navigates from Profile to Military Service through sidebar link', async () => {
    const user = userEvent.setup();
    await renderAt('/profile');

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeTruthy();
    await user.click(screen.getByRole('link', { name: /Military Service/i }));

    expect(await screen.findByRole('heading', { name: 'Military Service' })).toBeTruthy();
  });

  it('moves forward through workflow using the Next control', async () => {
    const user = userEvent.setup();
    await renderAt('/military-service');

    expect(await screen.findByRole('heading', { name: 'Military Service' })).toBeTruthy();
    await user.click(screen.getByRole('link', { name: /Next/i }));

    expect(await screen.findByRole('heading', { name: 'Service Treatment Records' })).toBeTruthy();
  });

  it('opens Workspace Updates from the Resources card link', async () => {
    const user = userEvent.setup();
    await renderAt('/resources');

    expect(await screen.findByRole('heading', { name: 'Resources' })).toBeTruthy();
    await user.click(screen.getByRole('link', { name: /Open Workspace Updates/i }));

    expect(await screen.findByRole('heading', { name: 'Workspace Updates' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Refresh Metadata' })).toBeTruthy();
  });
});
