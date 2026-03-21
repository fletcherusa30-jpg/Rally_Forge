import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ClaimGeneratorSummaryTab } from '../tabs/claim-generator-summary/ClaimGeneratorSummaryTab.jsx';
import { buildClaimDataUnified } from '../state/claimDataUnified/index.js';

const workspaceRef = { current: null };
const workflowRef = { current: null };
const claimDataUnifiedRef = { current: null };

function syncClaimDataUnified() {
  claimDataUnifiedRef.current = buildClaimDataUnified(workspaceRef.current, workflowRef.current);
}

const updateWorkspaceMock = vi.fn((updater) => {
  workspaceRef.current = typeof updater === 'function' ? updater(workspaceRef.current) : updater;
  syncClaimDataUnified();
});

function createWorkflow(overrides = {}) {
  return {
    readiness: {
      profile: true,
      militaryService: true,
      serviceTreatmentRecords: true,
      currentTreatment: true,
      vaDecision: true,
    },
    profileSummary: {
      fullName: 'Pat Veteran',
      branchSummary: 'Army',
      mosSummary: '11B',
    },
    strsSummary: { diagnoses: ['Tinnitus'], injuries: [], events: [] },
    treatmentSummary: { currentDiagnoses: ['Tinnitus'], currentSymptoms: ['Ringing'] },
    vaSummary: { serviceConnectedConditions: ['PTSD'], deniedConditions: ['Migraine'] },
    serviceSummary: {
      presumptiveMatches: 1,
      combatVeteran: true,
      serviceRecords: [
        {
          id: 'svc-1',
          branch: 'Army',
          mos: '11B',
          exposures: ['Burn pits'],
          autoMappedExposures: ['Airborne hazards (dust, sand, PM2.5)'],
          mosFamilyExposures: ['Infantry'],
          exposureNotes: 'Burn pit exposure',
        },
      ],
    },
    nextActions: ['Gather private records.'],
    conditionRecords: [
      {
        condition: 'Migraine headaches',
        readinessScore: 68,
        recommendedLane: 'Supplemental claim',
        alreadyRated: false,
        deniedPreviously: true,
        presumptivePathPossible: false,
        sourceEvidence: {
          inService: [{ label: 'Headache event', sourceName: 'STR', summaryText: 'Documented in service' }],
          current: [],
          rated: [],
          denied: [{ label: 'Prior denial', sourceName: 'Decision', summaryText: 'Denied in prior decision' }],
        },
        secondaryConnections: [],
      },
    ],
    ...overrides,
  };
}

vi.mock('../context/ClaimWorkspaceContext.jsx', () => ({
  useClaimWorkspace: () => ({
    workspace: workspaceRef.current,
    workflow: workflowRef.current,
    claimDataUnified: claimDataUnifiedRef.current,
    updateWorkspace: updateWorkspaceMock,
  }),
}));

describe('ClaimGeneratorSummaryTab', () => {
  beforeEach(() => {
    workflowRef.current = createWorkflow();
    workspaceRef.current = {
      exposureProfile: {
        wizardStatus: 'not-started',
        completedAt: null,
        answers: {},
      },
      serviceTreatmentRecords: {
        extractedFindings: [
          {
            findingType: 'diagnosis',
            conditionName: 'Migraine headaches',
            label: 'Migraine headaches',
            summaryText: 'Headache event documented in service records',
          },
        ],
        manualEntries: [],
      },
      currentTreatment: {
        extractedFindings: {
          currentConditions: ['Migraine headaches'],
          functionalLimitations: ['Migraine headaches impacts concentration'],
          treatmentEvents: ['Migraine headaches follow-up visit'],
          providerSignals: [],
          medicationMentions: [],
          worseningIndicators: [],
          evidenceSnippets: ['Migraine headaches ongoing treatment'],
        },
        manualEntries: [],
      },
      vaDecision: {
        extractedFindings: {
          combinedRating: '',
          decisionMetadata: {},
          serviceConnectedConditions: [],
          deniedConditions: [{ conditionName: 'Migraine headaches' }],
          smcAdjustments: [],
          dependentAdjustments: [],
          effectiveDates: [],
          confidenceBySection: {},
          evidenceSpans: [],
        },
        manualEntries: [],
        conflicts: [],
      },
      claimGeneratorSummary: {
        generatedConditions: [],
        readinessScore: 0,
        evidenceIndex: [],
        recommendedActions: [],
        followUpChecklist: [],
        layStatement: '',
        updatedAt: null,
      },
    };
    syncClaimDataUnified();
    updateWorkspaceMock.mockClear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders unified header, dashboard cards, condition cards, and export controls', () => {
    render(<ClaimGeneratorSummaryTab />);

    expect(screen.getByText('Claim Generator & Summary')).toBeTruthy();
    expect(screen.getByText('Final Synthesis')).toBeTruthy();
    expect(screen.getByText('Workflow Readiness')).toBeTruthy();
    expect(screen.getByText('Claim Signals')).toBeTruthy();
    expect(screen.getByText('Recommended Next Actions')).toBeTruthy();
    expect(screen.getByText('Filing Readiness Score')).toBeTruthy();
    expect(screen.getByText('Evidence Index')).toBeTruthy();
    expect(screen.getByText('Follow-Up Checklist')).toBeTruthy();
    expect(screen.getByText('Auto-Generated Lay Statement')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Export TXT/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Export JSON/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Print/i })).toBeTruthy();
    expect(screen.getByText('Generated Claimable Conditions')).toBeTruthy();
  });

  it('shows missing-evidence follow-up questions for denied conditions', () => {
    render(<ClaimGeneratorSummaryTab />);

    expect(screen.getAllByText(/new and relevant evidence since the last va decision/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/migraine headaches: do you have new and relevant evidence since the last va decision\?/i)).toBeTruthy();
  });

  it('hides empty evidence and generated-condition cards when there is no synthesized output', () => {
    workflowRef.current = createWorkflow({
      readiness: {
        profile: false,
        militaryService: false,
        serviceTreatmentRecords: false,
        currentTreatment: false,
        vaDecision: false,
      },
      profileSummary: {
        fullName: 'Pat Veteran',
        branchSummary: '',
        mosSummary: '',
      },
      strsSummary: { diagnoses: [], injuries: [], events: [] },
      treatmentSummary: { currentDiagnoses: [], currentSymptoms: [] },
      vaSummary: { serviceConnectedConditions: [], deniedConditions: [] },
      serviceSummary: {
        presumptiveMatches: 0,
        combatVeteran: false,
        serviceRecords: [],
      },
      nextActions: [],
      conditionRecords: [],
    });
    workspaceRef.current = {
      exposureProfile: {
        wizardStatus: 'not-started',
        completedAt: null,
        answers: {},
      },
      serviceTreatmentRecords: {
        extractedFindings: [],
        manualEntries: [],
      },
      currentTreatment: {
        extractedFindings: {
          currentConditions: [],
          functionalLimitations: [],
          treatmentEvents: [],
          providerSignals: [],
          medicationMentions: [],
          worseningIndicators: [],
          evidenceSnippets: [],
        },
        manualEntries: [],
      },
      vaDecision: {
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
        manualEntries: [],
        conflicts: [],
      },
      claimGeneratorSummary: {
        generatedConditions: [],
        readinessScore: 0,
        evidenceIndex: [],
        recommendedActions: [],
        followUpChecklist: [],
        layStatement: '',
        updatedAt: null,
      },
    };
    syncClaimDataUnified();

    render(<ClaimGeneratorSummaryTab />);

    expect(screen.queryByText('Evidence Index')).toBeNull();
    expect(screen.queryByText('Follow-Up Checklist')).toBeNull();
    expect(screen.queryByText('Auto-Generated Lay Statement')).toBeNull();
    expect(screen.queryByText('Generated Claimable Conditions')).toBeNull();
  });
});
