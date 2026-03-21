import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Workspace state harness ──────────────────────────────────────────────────
const workspaceRef = { current: null };

const updateWorkspaceMock = vi.fn((updater) => {
  workspaceRef.current = typeof updater === 'function' ? updater(workspaceRef.current) : updater;
});

vi.mock('../context/ClaimWorkspaceContext.jsx', () => ({
  useClaimWorkspace: () => ({
    workspace: workspaceRef.current,
    workflow: {
      profileSummary: { fullName: 'Pat Veteran' },
      strsSummary: { diagnoses: [], injuries: [] },
      suggestedTreatmentEntries: [],
    },
    updateWorkspace: updateWorkspaceMock,
  }),
}));

vi.mock('../api/client.js', () => ({}));

// eslint-disable-next-line no-unused-vars
import { CurrentTreatmentTab } from '../tabs/current-treatment/CurrentTreatmentTab.jsx';

// ── Workspace factory ────────────────────────────────────────────────────────
function createWorkspace(overrides = {}) {
  return {
    currentTreatment: {
      manualEntries: [],
      uploadedDocuments: [],
      extractedFindings: {
        currentConditions: [],
        functionalLimitations: [],
        treatmentEvents: [],
        providerSignals: [],
        medicationMentions: [],
        worseningIndicators: [],
        evidenceSnippets: [],
      },
      updatedAt: null,
    },
    ...overrides,
  };
}

// Helper: switch from Upload tab to Manual Entry tab
async function switchToManualTab(user) {
  await user.click(screen.getByRole('button', { name: 'Manual Entry' }));
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('CurrentTreatmentTab', () => {
  beforeEach(() => {
    workspaceRef.current = createWorkspace();
    updateWorkspaceMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('validates manual entry with an empty form — shows errors for conditionName and symptomSummary', async () => {
    const user = userEvent.setup();
    render(<CurrentTreatmentTab />);

    await switchToManualTab(user);

    // Try to save without filling any fields
    await user.click(screen.getByRole('button', { name: 'Add Entry' }));

    expect(screen.getByText(/Condition name is required/i)).toBeTruthy();
    expect(screen.getByText(/Symptom summary is required/i)).toBeTruthy();
  });

  it('saves an entry and dedupes — same conditionName+providerName saves twice → 1 entry shown', async () => {
    const user = userEvent.setup();
    render(<CurrentTreatmentTab />);

    await switchToManualTab(user);

    // Fill out the form
    await user.type(screen.getByLabelText('Condition name'), 'Tinnitus');
    await user.type(screen.getByLabelText('Symptom summary'), 'Ringing in both ears');

    // Save once — workspace has 1 entry now
    await user.click(screen.getByRole('button', { name: 'Add Entry' }));

    // Patch workspaceRef to simulate saved state being returned via useClaimWorkspace
    workspaceRef.current = updateWorkspaceMock.mock.calls[0][0](createWorkspace());

    cleanup();
    render(<CurrentTreatmentTab />);

    await switchToManualTab(user);

    // Fill out the same form again (same condition + blank providerName = same key)
    await user.type(screen.getByLabelText('Condition name'), 'Tinnitus');
    await user.type(screen.getByLabelText('Symptom summary'), 'Second submission, should dedup');

    await user.click(screen.getByRole('button', { name: 'Add Entry' }));

    // The second save call should have deduped to 1 entry
    const lastCallArg = updateWorkspaceMock.mock.calls[updateWorkspaceMock.mock.calls.length - 1][0];
    const updatedWorkspace = lastCallArg(workspaceRef.current);
    const savedEntries = updatedWorkspace.currentTreatment.manualEntries;

    expect(savedEntries).toHaveLength(1);
    expect(savedEntries[0].conditionName).toBe('Tinnitus');
  });

  it('edit mode pre-fills the form and Update Entry replaces the existing entry', async () => {
    // Pre-seed workspace with one saved entry
    workspaceRef.current = createWorkspace({
      currentTreatment: {
        manualEntries: [
          {
            id: 'ct-manual-test-001',
            conditionName: 'Tinnitus',
            symptomSummary: 'Ringing in ears',
            status: 'active',
            providerName: 'VA Audiology',
            providerType: 'VA',
            treatmentDetails: '',
            treatmentStartDate: '',
            treatmentEndDate: '',
            medications: [],
          },
        ],
        uploadedDocuments: [],
        extractedFindings: {
          currentConditions: [],
          functionalLimitations: [],
          treatmentEvents: [],
          providerSignals: [],
          medicationMentions: [],
          worseningIndicators: [],
          evidenceSnippets: [],
        },
        updatedAt: null,
      },
    });

    const user = userEvent.setup();
    render(<CurrentTreatmentTab />);

    await switchToManualTab(user);

    // Click Edit for the Tinnitus entry
    await user.click(screen.getByRole('button', { name: 'Edit Tinnitus' }));

    // Form should now show "Update Entry" button
    expect(screen.getByRole('button', { name: 'Update Entry' })).toBeTruthy();

    // Verify the condition name pre-fills
    const conditionInput = screen.getByLabelText('Condition name');
    expect(conditionInput.value).toBe('Tinnitus');

    // Change the symptom summary
    const summaryInput = screen.getByLabelText('Symptom summary');
    await user.clear(summaryInput);
    await user.type(summaryInput, 'Updated: severe bilateral tinnitus');

    await user.click(screen.getByRole('button', { name: 'Update Entry' }));

    // After update, mock should have been called; verify result shape
    const lastCallArg = updateWorkspaceMock.mock.calls[updateWorkspaceMock.mock.calls.length - 1][0];
    const updatedWorkspace = lastCallArg(workspaceRef.current);
    const savedEntries = updatedWorkspace.currentTreatment.manualEntries;

    // Still 1 entry, conditionName unchanged, symptomSummary updated
    expect(savedEntries).toHaveLength(1);
    expect(savedEntries[0].conditionName).toBe('Tinnitus');
    expect(savedEntries[0].symptomSummary).toBe('Updated: severe bilateral tinnitus');
  });

  it('displays all 7 category rows when extractedFindings are pre-seeded in workspace', async () => {
    workspaceRef.current = createWorkspace({
      currentTreatment: {
        manualEntries: [],
        uploadedDocuments: [],
        extractedFindings: {
          currentConditions: ['Tinnitus', 'Lower back pain'],
          functionalLimitations: ['Cannot stand more than 30 minutes'],
          treatmentEvents: ['VA audiology appointment 2023-06-15'],
          providerSignals: ['Dr. Smith, VA audiologist'],
          medicationMentions: ['Naproxen 500mg'],
          worseningIndicators: ['Tinnitus worsening over past year'],
          evidenceSnippets: ['Patient reports ringing worsened since separation'],
        },
        updatedAt: null,
      },
    });

    render(<CurrentTreatmentTab />);

    // All 7 category labels should be visible on the Upload tab (default)
    expect(screen.getByText('Current Conditions')).toBeTruthy();
    expect(screen.getByText('Symptoms & Functional Limitations')).toBeTruthy();
    expect(screen.getByText('Appointments & Treatment Events')).toBeTruthy();
    expect(screen.getByText('Provider Continuity Signals')).toBeTruthy();
    expect(screen.getByText('Medication Mentions')).toBeTruthy();
    expect(screen.getByText('Worsening Trend Indicators')).toBeTruthy();
    expect(screen.getByText('Evidence Snippets (AI Context)')).toBeTruthy();
  });
});
