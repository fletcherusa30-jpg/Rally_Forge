import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const workspaceRef = { current: null };

const updateWorkspaceMock = vi.fn((updater) => {
  workspaceRef.current = typeof updater === 'function' ? updater(workspaceRef.current) : updater;
});

vi.mock('../context/ClaimWorkspaceContext.jsx', () => ({
  useClaimWorkspace: () => ({
    workspace: workspaceRef.current,
    workflow: {
      profileSummary: { fullName: 'Pat Veteran' },
      strsSummary: { uploadedCount: 2, manualCount: 1, diagnoses: [], injuries: [] },
      treatmentSummary: { uploadedCount: 1, manualCount: 1 },
      conditionReadiness: [{ condition: 'Migraine', alreadyRated: false }],
    },
    updateWorkspace: updateWorkspaceMock,
  }),
}));

// eslint-disable-next-line no-unused-vars
import { RatingDecisionTab } from '../tabs/rating-decision/RatingDecisionTab.jsx';

function createWorkspace(overrides = {}) {
  return {
    vaDecision: {
      manualEntries: [],
      extractedFindings: {
        combinedRating: '',
        decisionMetadata: {},
        serviceConnectedConditions: [],
        deniedConditions: [],
        smcAdjustments: [],
        dependentAdjustments: [],
        effectiveDates: [],
        confidenceBySection: {},
        evidenceSpans: [],
      },
      conflicts: [],
      updatedAt: null,
    },
    ...overrides,
  };
}

function applyLastWorkspaceUpdate() {
  const call = updateWorkspaceMock.mock.calls[updateWorkspaceMock.mock.calls.length - 1];
  const updater = call?.[0];
  workspaceRef.current = typeof updater === 'function' ? updater(workspaceRef.current) : updater;
}

describe('RatingDecisionTab', () => {
  beforeEach(() => {
    workspaceRef.current = createWorkspace();
    updateWorkspaceMock.mockClear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('runs upload extraction flow and renders confidence badges with section confidence panel', async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            metadata: { ratingDecisionDate: '2024-02-15' },
            ratingCalculation: { calculatedCombinedRating: 80 },
            serviceConnected: [
              {
                condition: 'PTSD',
                percentage: 70,
                effectiveDate: '2023-03-01',
                confidence: { score: 0.91 },
              },
            ],
            denied: [
              {
                condition: 'Sleep apnea',
                denialReason: 'No nexus opinion',
                confidenceScore: 0.5,
              },
            ],
            extractionContract: {
              evidenceSpans: [
                {
                  section: 'serviceConnectedConditions',
                  text: 'Service connection for PTSD is granted with 70 percent evaluation.',
                  confidenceScore: 0.91,
                },
              ],
            },
          },
          quality: {
            sectionConfidence: {
              serviceConnected: 0.9,
              denied: 0.52,
              smc: 0.8,
              dependents: 0.8,
              combinedRating: 0.92,
              effectiveDates: 0.89,
            },
          },
        }),
      }))
    );

    const { rerender } = render(<RatingDecisionTab />);

    const fileInput = screen.getByLabelText('Upload rating decision documents');
    await user.upload(fileInput, new File(['pdf-content'], 'decision.pdf', { type: 'application/pdf' }));

    await waitFor(() => {
      expect(updateWorkspaceMock).toHaveBeenCalled();
    });

    applyLastWorkspaceUpdate();
    rerender(<RatingDecisionTab />);

    expect(screen.getByText('Section-Level Confidence Panel')).toBeTruthy();
    expect(screen.getByText(/Per-Condition Confidence Badges/i)).toBeTruthy();
    expect(screen.getAllByText(/high/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/post-traumatic stress disorder/i).length).toBeGreaterThan(0);
  });

  it('hides empty upload results card when no extraction data exists', () => {
    render(<RatingDecisionTab />);

    expect(screen.queryByText('Results - VA Rating Decision')).toBeNull();
  });

  it('renders evidence span trace panel with expand/collapse spans', async () => {
    const user = userEvent.setup();

    workspaceRef.current = createWorkspace({
      vaDecision: {
        manualEntries: [],
        extractedFindings: {
          combinedRating: 70,
          decisionMetadata: { fileName: 'decision.pdf' },
          serviceConnectedConditions: [
            {
              conditionName: 'post-traumatic stress disorder',
              percentage: 70,
              effectiveDate: '2023-03-01',
              confidenceLevel: 'high',
              confidenceScore: 0.9,
            },
          ],
          deniedConditions: [],
          smcAdjustments: [],
          dependentAdjustments: [],
          effectiveDates: [],
          confidenceBySection: {},
          evidenceSpans: [
            {
              id: 'span-1',
              section: 'serviceConnectedConditions',
              text: 'Service connection for PTSD is granted at 70 percent.',
              confidenceLevel: 'low',
              confidenceScore: 0.4,
            },
          ],
        },
        conflicts: [],
      },
    });

    render(<RatingDecisionTab />);

    expect(screen.getByText('6. Evidence Span Trace Panel')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Show Span' }));
    expect(screen.getByText(/Service connection for PTSD is granted at 70 percent\./i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Hide Span' }));
  });

  it('supports manual entry CRUD operations', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<RatingDecisionTab />);

    await user.click(screen.getByRole('button', { name: 'Manual Entry' }));

    await user.type(screen.getByLabelText('Condition name'), 'PTSD');
    await user.selectOptions(screen.getByLabelText('Percentage'), '70');
    await user.type(screen.getByLabelText('Effective date'), '2023-01-01');
    await user.click(screen.getByLabelText('Is service connected'));
    await user.click(screen.getByRole('button', { name: 'Add Entry' }));

    await waitFor(() => {
      expect(updateWorkspaceMock).toHaveBeenCalled();
    });

    applyLastWorkspaceUpdate();
    rerender(<RatingDecisionTab />);

    expect(screen.getByText(/post-traumatic stress disorder/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Edit post-traumatic stress disorder/i }));
    await user.selectOptions(screen.getByLabelText('Percentage'), '50');
    await user.click(screen.getByRole('button', { name: 'Update Entry' }));

    applyLastWorkspaceUpdate();
    rerender(<RatingDecisionTab />);

    expect(screen.getByText(/50%\s*\|\s*2023-01-01\s*\|\s*Service Connected/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Delete post-traumatic stress disorder/i }));
    applyLastWorkspaceUpdate();
    rerender(<RatingDecisionTab />);

    expect(screen.queryByText(/post-traumatic stress disorder/i)).toBeNull();
  });

  it('shows conflict detector and staged rating timeline when scanner data conflicts with manual entries', async () => {
    const user = userEvent.setup();

    workspaceRef.current = createWorkspace({
      vaDecision: {
        manualEntries: [
          {
            id: 'manual-1',
            conditionName: 'post-traumatic stress disorder',
            percentage: 50,
            effectiveDate: '2022-01-01',
            isServiceConnected: true,
            isDenied: false,
            denialReason: '',
            smcCodes: [],
            dependents: '',
            combinedRating: '',
          },
        ],
        extractedFindings: {
          combinedRating: 80,
          decisionMetadata: { fileName: 'decision.pdf' },
          serviceConnectedConditions: [
            {
              conditionName: 'post-traumatic stress disorder',
              percentage: 70,
              effectiveDate: '2023-01-01',
              confidenceLevel: 'high',
              confidenceScore: 0.91,
            },
          ],
          deniedConditions: [],
          smcAdjustments: [],
          dependentAdjustments: [],
          effectiveDates: [
            {
              conditionName: 'post-traumatic stress disorder',
              effectiveDate: '2023-01-01',
              percentage: 70,
            },
          ],
          confidenceBySection: {},
          evidenceSpans: [],
        },
        conflicts: [
          {
            id: 'conflict-1',
            conditionName: 'post-traumatic stress disorder',
            conflictType: 'percentage-mismatch',
            manualValue: '50%',
            scannedValue: '70%',
            message: 'Manual and scanned percentages are different.',
          },
        ],
      },
    });

    render(<RatingDecisionTab />);

    expect(screen.getByText('Conflict Detector')).toBeTruthy();
    expect(screen.getByText(/percentage-mismatch/i)).toBeTruthy();
    expect(screen.getByText('Rating Timeline Visualization')).toBeTruthy();
    expect(screen.getByText('Staged Rating')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Manual Entry' }));
    expect(screen.getByText('Manual VA Disability Entry')).toBeTruthy();
  });
});
