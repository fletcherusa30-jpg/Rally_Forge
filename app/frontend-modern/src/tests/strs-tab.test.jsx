import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const workspaceRef = { current: null };

const updateWorkspaceMock = vi.fn((updater) => {
  workspaceRef.current = typeof updater === 'function' ? updater(workspaceRef.current) : updater;
});

vi.mock('../context/ClaimWorkspaceContext.jsx', () => ({
  useClaimWorkspace: () => ({
    workspace: workspaceRef.current,
    workflow: {
      profileSummary: {
        fullName: 'Pat Veteran',
      },
      serviceSummary: {
        branches: ['Army'],
        mosCodes: ['11B'],
        presumptiveMatches: 1,
      },
    },
    updateWorkspace: updateWorkspaceMock,
  }),
}));

vi.mock('../api/client.js', () => ({
  getStrsJobStatus: vi.fn(async () => ({ status: 'completed', progress: 100, result: {} })),
}));

vi.mock('../components/scanner/scannerActivityStore.js', () => ({
  startScannerActivity: vi.fn(() => 'activity-id'),
  updateScannerActivity: vi.fn(),
}));

// eslint-disable-next-line no-unused-vars
import { StrsTab } from '../tabs/strs/StrsTab.jsx';

function createWorkspace(overrides = {}) {
  return {
    serviceTreatmentRecords: {
      extractedFindings: [
        {
          id: 'finding-high',
          findingType: 'diagnosis',
          conditionName: 'Lumbar Strain',
          dateOfEvent: '2010-03-01',
          dates: ['2010-03-01'],
          description: 'Chronic lumbar pain noted after training injury.',
          sourceFileName: 'strs-a.pdf',
          confidenceLevel: 'high',
          confidenceScore: 0.91,
          manualEntry: false,
        },
        {
          id: 'finding-low',
          findingType: 'event',
          conditionName: 'Knee pain complaint',
          dateOfEvent: '2011-08-15',
          dates: ['2011-08-15'],
          description: 'Intermittent right knee pain after ruck march.',
          sourceFileName: 'strs-b.pdf',
          confidenceLevel: 'low',
          confidenceScore: 0.4,
          manualEntry: false,
        },
      ],
      manualEntries: [],
      uploadedDocuments: [],
      confidenceLevels: {
        high: 1,
        medium: 0,
        low: 1,
        manual: 0,
      },
      updatedAt: null,
    },
    currentTreatment: {
      manualEntries: [],
      updatedAt: null,
      summary: null,
    },
    ...overrides,
  };
}

describe('StrsTab', () => {
  beforeEach(() => {
    workspaceRef.current = createWorkspace();
    updateWorkspaceMock.mockClear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('filters findings by confidence chip', async () => {
    const user = userEvent.setup();
    render(<StrsTab />);

    expect(screen.getAllByText('Lumbar Strain').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Knee pain complaint').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /high \(1\)/i }));

    const findingsCard = screen.getByRole('heading', { name: 'Extracted Findings' }).closest('section');
    expect(findingsCard).toBeTruthy();
    expect(within(findingsCard).getByText('Lumbar Strain')).toBeTruthy();
    expect(within(findingsCard).queryByText('Knee pain complaint')).toBeNull();
  });

  it('hides empty findings and timeline cards when there is no content', () => {
    workspaceRef.current = createWorkspace({
      serviceTreatmentRecords: {
        extractedFindings: [],
        manualEntries: [],
        uploadedDocuments: [],
        confidenceLevels: {
          high: 0,
          medium: 0,
          low: 0,
          manual: 0,
        },
        updatedAt: null,
      },
    });

    render(<StrsTab />);

    expect(screen.queryByRole('heading', { name: 'Extracted Findings' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Merged Timeline' })).toBeNull();
  });

  it('validates manual entry and dedupes duplicate saves', async () => {
    const user = userEvent.setup();
    render(<StrsTab />);

    await user.click(screen.getByRole('button', { name: 'Manual Entry' }));
    await user.click(screen.getByRole('button', { name: 'Save Manual Entry' }));
    expect(screen.getByText(/Date of event is required/i)).toBeTruthy();

    await user.type(screen.getByLabelText('Manual condition name'), 'Migraine headaches');
    fireEvent.change(screen.getByLabelText('Manual date of event'), { target: { value: '2012-04-10' } });
    await user.type(screen.getByLabelText('Manual description'), 'Recurring migraines after blast exposure.');

    await user.click(screen.getByRole('button', { name: 'Save Manual Entry' }));
    await user.click(screen.getByRole('button', { name: 'Save Manual Entry' }));

    expect(screen.getByText('1 manual entry saved')).toBeTruthy();
  });

  it('converts findings into current treatment drafts without duplicates', async () => {
    const user = userEvent.setup();
    render(<StrsTab />);

    const convertButton = screen.getAllByRole('button', { name: 'Convert to Condition Draft' })[0];
    await user.click(convertButton);
    await user.click(convertButton);

    const drafts = workspaceRef.current?.currentTreatment?.manualEntries || [];
    expect(drafts.length).toBe(1);
    expect(drafts[0].conditionName).toBe('Lumbar Strain');
    expect(drafts[0].diagnosisDate).toBe('2010-03-01');
  });
});
