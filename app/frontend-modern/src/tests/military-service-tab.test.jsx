import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const updateWorkspaceMock = vi.fn();
const workspaceRef = { current: {} };

vi.mock('../context/ClaimWorkspaceContext.jsx', () => ({
  useClaimWorkspace: () => ({
    workspace: workspaceRef.current,
    workflow: {
      profileSummary: {
        fullName: 'Pat Veteran',
        location: 'Austin, TX',
        email: 'pat@example.com',
        phone: '555-123-4567',
      },
    },
    updateWorkspace: updateWorkspaceMock,
  }),
}));

vi.mock('../api/client.js', () => ({
  getPresumptiveKnowledge: vi.fn(async () => ({ data: {} })),
  getMilitaryMosOptions: vi.fn(async (branch) => {
    const byBranch = {
      Army: [
        { code: '11B', label: '11B - Infantryman', type: 'enlisted' },
        { code: '11C', label: '11C - Indirect Fire Infantryman', type: 'enlisted' },
        { code: '153A', label: '153A - Rotary Wing Aviator', type: 'warrant' },
        { code: '18A', label: '18A - Special Forces Officer', type: 'officer' },
      ],
      Navy: [
        { code: 'BM', label: 'BM - Boatswains Mate', type: 'enlisted' },
      ],
    };
    return { data: { branch, options: byBranch[branch] || [] } };
  }),
}));

vi.mock('../utils/presumptiveMatching.js', () => ({
  getDropdownLocations: vi.fn(() => [
    { value: 'Iraq' },
    { value: 'Afghanistan' },
    { value: 'Kuwait' },
  ]),
}));

// eslint-disable-next-line no-unused-vars
import { MilitaryServiceTab } from '../tabs/military-service/MilitaryServiceTab.jsx';

function createExtractionPayload() {
  return {
    success: true,
    data: {
      extractionMeta: {
        confidence: 0.93,
      },
      dd214: {
        serviceIdentity: {
          branchOfService: 'Army',
          component: 'active',
        },
        servicePeriods: {
          entryDate: '2003-01-02',
          separationDate: '2009-03-04',
          totalPriorActiveService: { years: 4, months: 10, days: 7 },
          totalPriorInactiveService: { years: 0, months: 3, days: 1 },
          seaService: { years: 2, months: 4, days: 28 },
        },
        gradeSpecialty: {
          payGrade: 'E-6',
          primaryMOSOrAFSCOrRating: '11B',
          mosDetails: [{ code: '11C' }],
        },
        characterAndSeparation: {
          characterOfService: 'Honorable',
          separationCode: 'KBK',
          reentryCode: 'RE-1',
          separationAuthority: 'AR 635-200',
          narrativeReasonForSeparation: 'Completion of required service',
        },
        dd214Analysis: {
          combatVeteran: true,
          deployments: [
            { location: 'Iraq', hazardousDutyIndicator: true, source: 'Hostile fire pay' },
          ],
          confidenceScores: {
            fields: {
              branchOfService: 0.97,
              separationCode: 0.81,
            },
          },
        },
        decorationsAndService: {
          foreignServiceTotal: { years: 1, months: 1, days: 0 },
          foreignServiceLocationsIfListed: ['Iraq'],
          decorationsAndAwards: ['CIB'],
        },
        intelligentExtraction: {
          hazardIndicators: ['IMMINENT DANGER PAY', 'AFGHANISTAN', 'Afghanistan'],
          stationAtSeparation: 'Fort Bliss',
          installationExposures: ['Burn pit'],
        },
        lastDutyAssignment: {
          lastDutyAssignmentTitle: '1-8 IN',
          majorCommand: 'FORSCOM',
        },
        transferCommand: {
          postServiceComponent: 'USAR',
        },
        specialProgramsRemarks: {
          reenlistments: [],
        },
      },
    },
  };
}

describe('MilitaryServiceTab', () => {
  beforeEach(() => {
    updateWorkspaceMock.mockClear();
    workspaceRef.current = {
      workspaceVersion: 1,
      militaryService: {
        records: [],
      },
    };

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => createExtractionPayload(),
    }));

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('uploads DD-214, shows confidence badges, and exposes compare/apply actions', async () => {
    const user = userEvent.setup();
    render(<MilitaryServiceTab />);

    const file = new File(['pdf-bytes'], 'dd214.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText('Upload DD-214');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Overall Confidence: 93%/)).toBeTruthy();
    });

    expect(screen.getByLabelText('Branch confidence').textContent).toContain('97%');
    expect(screen.queryByText('{}')).toBeNull();
    expect(screen.getByText('1 year, 1 month')).toBeTruthy();
    expect(screen.getAllByText(/afghanistan/i).length).toBe(1);
    expect(screen.getByText('4 years, 10 months, 7 days')).toBeTruthy();
    expect(screen.getByText('3 months, 1 day')).toBeTruthy();
    expect(screen.getByText('2 years, 4 months, 28 days')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Compare Extracted vs Current Form' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Apply extracted values to form' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Compare Extracted vs Current Form' }));
    expect(screen.getByRole('dialog', { name: 'Extracted versus current form comparison' })).toBeTruthy();
  });

  it('applies extracted values through diff modal confirmation', async () => {
    const user = userEvent.setup();
    render(<MilitaryServiceTab />);

    const file = new File(['pdf-bytes'], 'dd214.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Upload DD-214'), { target: { files: [file] } });

    await screen.findByText(/Overall Confidence: 93%/);
    await user.click(screen.getByRole('button', { name: 'Compare Extracted vs Current Form' }));
    await user.click(screen.getByRole('button', { name: 'Confirm Apply' }));

    expect(screen.getByDisplayValue('Army')).toBeTruthy();
    // Wait for rank to be applied first (E-6), which enables primaryMOS select
    await waitFor(() => {
      expect(screen.getByLabelText('rankRate').value).toBe('E-6');
    });
    // Then primaryMOS should be set to 11B
    await waitFor(() => {
      expect(screen.getByLabelText('primaryMOS').value).toBe('11B');
    });
    expect(window.confirm).toHaveBeenCalled();
  });

  it('supports analyzer accept and dismiss actions', async () => {
    const user = userEvent.setup();
    render(<MilitaryServiceTab />);

    await user.type(screen.getByPlaceholderText('deploymentLocations[] entry'), 'Iraq');
    await user.click(screen.getByRole('button', { name: 'Add deployment location' }));

    await waitFor(() => {
      expect(screen.getByText('Airborne hazards / burn pit exposure risk')).toBeTruthy();
    });

    await user.click(screen.getAllByRole('button', { name: 'Accept' })[0]);
    await waitFor(() => {
      expect(screen.getByText(/Status: accepted/i)).toBeTruthy();
    });

    await user.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]);
    await waitFor(() => {
      expect(screen.getByText(/Status: dismissed/i)).toBeTruthy();
    });
  });

  it('auto-detects service era from start and end dates when left on auto mode', async () => {
    render(<MilitaryServiceTab />);

    const serviceEraSelect = screen.getByLabelText('serviceEra');
    expect(serviceEraSelect.value).toBe('');

    fireEvent.change(screen.getByLabelText('startDate'), { target: { value: '1965-01-01' } });
    fireEvent.change(screen.getByLabelText('endDate'), { target: { value: '1968-01-01' } });

    await waitFor(() => {
      expect(screen.getByLabelText('serviceEra').value).toBe('Vietnam Era (1964-1975)');
    });
  });

  it('adds, edits, deletes, and saves service records', async () => {
    const user = userEvent.setup();
    render(<MilitaryServiceTab />);

    await user.selectOptions(screen.getByLabelText('branchOfService'), 'Army');
    await user.selectOptions(screen.getByLabelText('serviceType'), 'Active');
    await user.type(screen.getByLabelText('startDate'), '2001-01-01');
    await user.type(screen.getByLabelText('endDate'), '2005-01-01');
    await user.selectOptions(screen.getByLabelText('dischargeType'), 'Honorable');
    await user.selectOptions(screen.getByLabelText('serviceEra'), 'Post-9/11 (2001-Present)');
    expect(screen.getByLabelText('serviceEra').value).toBe('Post-9/11 (2001-Present)');
    // Select rank first (required before primaryMOS can be selected)
    await user.selectOptions(screen.getByLabelText('rankRate'), 'E-3');
    await user.selectOptions(screen.getByLabelText('primaryMOS'), '11B');

    await user.click(screen.getByRole('button', { name: 'Add Record' }));
    expect(screen.getByText(/Primary MOS: 11B/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.selectOptions(screen.getByLabelText('primaryMOS'), '11C');
    await user.click(screen.getByRole('button', { name: 'Update Record' }));
    expect(screen.getByText(/Primary MOS: 11C/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('No service records yet.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Save Records' }));
    expect(updateWorkspaceMock).toHaveBeenCalled();
  });

  it('filters additional MOS choices by branch and selected rank', async () => {
    const user = userEvent.setup();
    render(<MilitaryServiceTab />);

    await user.selectOptions(screen.getByLabelText('branchOfService'), 'Army');

    const additionalMosSelect = screen.getByLabelText('additionalMOS');
    expect(additionalMosSelect.disabled).toBe(true);

    await user.selectOptions(screen.getByLabelText('rankRate'), 'E-6');

    await waitFor(() => {
      expect(within(additionalMosSelect).getByRole('option', { name: '11B - Infantryman' })).toBeTruthy();
    });
    expect(within(additionalMosSelect).queryByRole('option', { name: '18A - Special Forces Officer' })).toBeNull();
    expect(within(additionalMosSelect).queryByRole('option', { name: '153A - Rotary Wing Aviator' })).toBeNull();

    await user.selectOptions(screen.getByLabelText('rankRate'), 'O-3');

    await waitFor(() => {
      expect(within(additionalMosSelect).getByRole('option', { name: '18A - Special Forces Officer' })).toBeTruthy();
    });
    expect(within(additionalMosSelect).queryByRole('option', { name: '11B - Infantryman' })).toBeNull();
    expect(within(additionalMosSelect).queryByRole('option', { name: '153A - Rotary Wing Aviator' })).toBeNull();
  });

  it('filters primary MOS choices by branch and selected rank', async () => {
    const user = userEvent.setup();
    render(<MilitaryServiceTab />);

    await user.selectOptions(screen.getByLabelText('branchOfService'), 'Army');

    const primaryMosSelect = screen.getByLabelText('primaryMOS');
    expect(primaryMosSelect.disabled).toBe(true);

    await user.selectOptions(screen.getByLabelText('rankRate'), 'E-6');
    await user.selectOptions(primaryMosSelect, '11B');

    expect(primaryMosSelect.value).toBe('11B');
    expect(within(primaryMosSelect).queryByRole('option', { name: '18A - Special Forces Officer' })).toBeNull();
    expect(within(primaryMosSelect).queryByRole('option', { name: '153A - Rotary Wing Aviator' })).toBeNull();

    await user.selectOptions(screen.getByLabelText('rankRate'), 'W-3');

    await waitFor(() => {
      expect(within(primaryMosSelect).getByRole('option', { name: '153A - Rotary Wing Aviator' })).toBeTruthy();
    });
    expect(within(primaryMosSelect).queryByRole('option', { name: '11B - Infantryman' })).toBeNull();
    expect(primaryMosSelect.value).toBe('');
  });
});
