import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    expect(screen.getByDisplayValue('11B')).toBeTruthy();
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

  it('adds, edits, deletes, and saves service records', async () => {
    const user = userEvent.setup();
    render(<MilitaryServiceTab />);

    await user.selectOptions(screen.getByLabelText('branchOfService'), 'Army');
    await user.selectOptions(screen.getByLabelText('serviceType'), 'Active');
    await user.type(screen.getByLabelText('startDate'), '2001-01-01');
    await user.type(screen.getByLabelText('endDate'), '2005-01-01');
    await user.selectOptions(screen.getByLabelText('dischargeType'), 'Honorable');
    await user.type(screen.getByLabelText('primaryMOS'), '11b');

    await user.click(screen.getByRole('button', { name: 'Add Record' }));
    expect(screen.getByText(/Primary MOS: 11B/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('primaryMOS'));
    await user.type(screen.getByLabelText('primaryMOS'), '11C');
    await user.click(screen.getByRole('button', { name: 'Update Record' }));
    expect(screen.getByText(/Primary MOS: 11C/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('No service records yet.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Save Records' }));
    expect(updateWorkspaceMock).toHaveBeenCalled();
  });
});
