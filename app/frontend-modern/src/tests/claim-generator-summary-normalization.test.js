import { describe, expect, it } from 'vitest';
import {
  buildUnifiedSummaryJson,
  buildUnifiedSummaryPayload,
  formatUnifiedSummaryTxt,
  synthesizeGeneratedConditions,
} from '../tabs/claim-generator-summary/normalization.js';

function createBaseWorkflow() {
  return {
    serviceSummary: {
      presumptiveMatches: 2,
      combatVeteran: true,
      serviceRecords: [
        {
          id: 'svc-1',
          branch: 'Army',
          mos: { primary: '11B' },
          combatStatus: true,
          likelyExposures: ['Burn pits'],
          exposures: ['Burn pits'],
          autoMappedExposures: ['Airborne hazards (dust, sand, PM2.5)'],
          mosFamilyExposures: ['Infantry'],
          exposureNotes: 'Burn pit and dust exposure',
        },
      ],
    },
    nextActions: ['Collect private treatment records.'],
    conditionRecords: [],
  };
}

function evidenceRow(label, sourceName, summaryText = '') {
  return { label, sourceName, summaryText, date: '2024-01-01' };
}

function createUnified(workspace = {}, workflow = createBaseWorkflow()) {
  const workspaceProfile = workspace.profile || {};
  return {
    profile: {
      identity: {
        firstName: workspaceProfile?.identity?.firstName || 'Pat',
        lastName: workspaceProfile?.identity?.lastName || 'Veteran',
      },
      preferredContactMethod: workspaceProfile?.preferredContactMethod || 'email',
      contact: {
        email: workspaceProfile?.contact?.email || 'pat@example.com',
      },
      representation: {
        type: workspaceProfile?.representation?.type || 'VSO',
      },
    },
    service: workflow.serviceSummary.serviceRecords,
    str: {
      manualEntries: [],
      extractedFindings: {
        diagnoses: [],
        injuries: [],
        events: [],
        presumptiveSignals: [],
        audiogramSignals: [],
        radiationIndicators: [],
        evidenceSnippets: [],
      },
    },
    currentTreatment: {
      manualEntries: [],
      extractedFindings: {
        currentConditions: [],
        functionalLimitations: [],
        treatmentEvents: [],
        providerSignals: [],
        medicationMentions: [],
        worseningIndicators: [],
        evidenceSnippets: [],
      },
      ...(workspace.currentTreatment || {}),
    },
    ratingDecision: {
      manualEntries: [],
      extractedFindings: {
        serviceConnectedConditions: [],
        deniedConditions: [],
      },
    },
    derivedSignals: {
      exposures: ['burn pits'],
      presumptives: [],
      secondaryCandidates: [],
      worseningIndicators: [],
      unratedConditions: [],
      conditionRecords: workflow.conditionRecords,
      nextActions: workflow.nextActions,
      ...(workspace.derivedSignals || {}),
    },
    generatedConditions: [],
    layStatement: '',
    evidenceIndex: [],
    claimGeneratorSummary: {
      generatedConditions: [],
      readinessScore: 0,
      evidenceIndex: [],
      recommendedActions: [],
      followUpChecklist: [],
      layStatement: '',
      layStatementTemplate: '',
      updatedAt: null,
    },
  };
}

describe('claim generator summary normalization', () => {
  it('generates categories for secondary, presumptive, reopen, aggravation, and increase lanes', () => {
    const workflow = createBaseWorkflow();
    workflow.conditionRecords = [
      {
        condition: 'Condition A',
        readinessScore: 86,
        recommendedLane: 'Direct service connection',
        alreadyRated: false,
        deniedPreviously: false,
        presumptivePathPossible: false,
        sourceEvidence: {
          inService: [evidenceRow('In-service event', 'STR-1')],
          current: [evidenceRow('Current diagnosis', 'VA Clinic')],
          rated: [],
          denied: [],
        },
        secondaryConnections: [],
      },
      {
        condition: 'Sleep apnea',
        readinessScore: 77,
        recommendedLane: 'Secondary service connection',
        alreadyRated: false,
        deniedPreviously: false,
        presumptivePathPossible: false,
        sourceEvidence: {
          inService: [evidenceRow('Snoring complaints', 'STR-2')],
          current: [evidenceRow('Diagnosed OSA', 'Sleep Clinic')],
          rated: [],
          denied: [],
        },
        secondaryConnections: [{ primaryCondition: 'PTSD', rationale: 'May be caused by chronic PTSD symptoms.' }],
      },
      {
        condition: 'Chronic rhinitis',
        readinessScore: 74,
        recommendedLane: 'Presumptive pathway review',
        alreadyRated: false,
        deniedPreviously: false,
        presumptivePathPossible: true,
        sourceEvidence: {
          inService: [],
          current: [evidenceRow('Rhinitis diagnosis', 'Pulmonary')],
          rated: [],
          denied: [],
        },
        secondaryConnections: [],
      },
      {
        condition: 'Migraine headaches',
        readinessScore: 90,
        recommendedLane: 'Supplemental claim',
        alreadyRated: false,
        deniedPreviously: true,
        presumptivePathPossible: false,
        sourceEvidence: {
          inService: [evidenceRow('In-service headache episodes', 'STR-3')],
          current: [evidenceRow('Current migraine treatment', 'Neurology')],
          rated: [],
          denied: [evidenceRow('Denied migraine claim', 'Rating Decision')],
        },
        secondaryConnections: [],
      },
      {
        condition: 'GERD',
        readinessScore: 72,
        recommendedLane: 'Secondary service connection',
        alreadyRated: false,
        deniedPreviously: false,
        presumptivePathPossible: false,
        sourceEvidence: {
          inService: [evidenceRow('GI complaints', 'STR-4')],
          current: [evidenceRow('Current GERD care', 'GI Clinic')],
          rated: [],
          denied: [],
        },
        secondaryConnections: [{ primaryCondition: 'PTSD', rationale: 'Primary condition can aggravate reflux symptoms.' }],
      },
      {
        condition: 'Lumbar strain',
        readinessScore: 79,
        recommendedLane: 'Increase or secondary review',
        alreadyRated: true,
        deniedPreviously: false,
        presumptivePathPossible: false,
        sourceEvidence: {
          inService: [evidenceRow('Back injury in service', 'STR-5')],
          current: [evidenceRow('Progressive pain', 'Physical Therapy')],
          rated: [evidenceRow('Already service connected', 'Rating Decision')],
          denied: [],
        },
        secondaryConnections: [],
      },
    ];

    const unified = createUnified({
      derivedSignals: {
        worseningIndicators: ['Lumbar strain'],
      },
      currentTreatment: {
        extractedFindings: {
          currentConditions: [],
          functionalLimitations: [],
          treatmentEvents: [],
          providerSignals: [],
          medicationMentions: [],
          worseningIndicators: ['Lumbar strain'],
          evidenceSnippets: [],
        },
        manualEntries: [],
      },
    }, workflow);

    const generated = synthesizeGeneratedConditions(unified);
    const categorySet = new Set(generated.map((item) => item.category));

    expect(categorySet.has('secondary')).toBe(true);
    expect(categorySet.has('presumptive')).toBe(true);
    expect(categorySet.has('reopen')).toBe(true);
    expect(categorySet.has('aggravation')).toBe(true);
    expect(categorySet.has('increase')).toBe(true);
  });

  it('merges evidence across STR, treatment, service, and rating decision sources', () => {
    const workflow = createBaseWorkflow();
    workflow.conditionRecords = [
      {
        condition: 'PTSD',
        readinessScore: 88,
        recommendedLane: 'Direct service connection',
        alreadyRated: false,
        deniedPreviously: false,
        presumptivePathPossible: false,
        sourceEvidence: {
          inService: [evidenceRow('Combat stressor event', 'STR-10')],
          current: [evidenceRow('Current PTSD diagnosis', 'Psychiatry')],
          rated: [evidenceRow('Prior PTSD rating review', 'Decision A')],
          denied: [evidenceRow('Prior denial context', 'Decision B')],
        },
        secondaryConnections: [],
      },
    ];

    const [generated] = synthesizeGeneratedConditions(createUnified({}, workflow));

    expect(generated.evidence.str.length).toBeGreaterThan(0);
    expect(generated.evidence.treatment.length).toBeGreaterThan(0);
    expect(generated.evidence.service.length).toBeGreaterThan(0);
    expect(generated.evidence.ratingDecision.length).toBeGreaterThan(0);
  });

  it('creates targeted follow-up questions when evidence is missing', () => {
    const workflow = createBaseWorkflow();
    workflow.conditionRecords = [
      {
        condition: 'Knee pain',
        readinessScore: 48,
        recommendedLane: 'Current diagnosis, linkage needed',
        alreadyRated: false,
        deniedPreviously: true,
        presumptivePathPossible: false,
        sourceEvidence: {
          inService: [evidenceRow('Knee event in STR', 'STR-20')],
          current: [],
          rated: [],
          denied: [evidenceRow('Denied previously', 'Decision C')],
        },
        secondaryConnections: [],
      },
    ];

    const [generated] = synthesizeGeneratedConditions(createUnified({}, workflow));

    expect(generated.missingEvidence.length).toBeGreaterThan(0);
    expect(generated.followUpQuestions.length).toBeGreaterThan(0);
    expect(generated.followUpQuestions.join(' ')).toMatch(/treated for knee pain recently/i);
    expect(generated.followUpQuestions.join(' ')).toMatch(/new and relevant evidence/i);
  });

  it('produces export payload and text/json output with required sections', () => {
    const workflow = createBaseWorkflow();
    workflow.conditionRecords = [
      {
        condition: 'Tinnitus',
        readinessScore: 85,
        recommendedLane: 'Direct service connection',
        alreadyRated: false,
        deniedPreviously: false,
        presumptivePathPossible: false,
        sourceEvidence: {
          inService: [evidenceRow('Noise injury', 'STR-9')],
          current: [evidenceRow('Current ringing', 'ENT')],
          rated: [],
          denied: [],
        },
        secondaryConnections: [],
      },
    ];

    const payload = buildUnifiedSummaryPayload(createUnified({}, workflow));
    const txt = formatUnifiedSummaryTxt(payload);
    const json = buildUnifiedSummaryJson(payload);

    expect(payload.generatedConditions.length).toBe(1);
    expect(payload.readinessScore).toBeGreaterThan(0);
    expect(Array.isArray(payload.followUpChecklist)).toBe(true);
    expect(payload.layStatement).toContain('Tinnitus');
    expect(payload.layStatement).toContain('I. Veteran Identity and Service');
    expect(payload.layStatement).toContain('VII. Closing Statement');
    expect(payload.layStatementTemplate).toContain('I. Veteran Identity and Service');
    expect(txt).toContain('GENERATED CONDITIONS');
    expect(txt).toContain('Tinnitus');
    expect(txt).toContain('RECOMMENDED ACTIONS');
    expect(txt).toContain('AUTO-GENERATED LAY STATEMENT');
    expect(Array.isArray(json.generatedConditions)).toBe(true);
    expect(Array.isArray(json.evidenceIndex)).toBe(true);
    expect(Array.isArray(json.recommendedActions)).toBe(true);
    expect(Array.isArray(json.followUpChecklist)).toBe(true);
    expect(json.layStatement).toContain('Tinnitus');
    expect(json.layStatementTemplate).toContain('VII. Closing Statement');
  });

  it('keeps readiness scoring consistent with underlying condition readiness scores', () => {
    const workflow = createBaseWorkflow();
    workflow.conditionRecords = [
      {
        condition: 'Condition A',
        readinessScore: 80,
        recommendedLane: 'Direct service connection',
        alreadyRated: false,
        deniedPreviously: false,
        presumptivePathPossible: false,
        sourceEvidence: {
          inService: [evidenceRow('A', 'STR')],
          current: [evidenceRow('A2', 'Tx')],
          rated: [],
          denied: [],
        },
        secondaryConnections: [],
      },
      {
        condition: 'Condition B',
        readinessScore: 60,
        recommendedLane: 'Current diagnosis, linkage needed',
        alreadyRated: false,
        deniedPreviously: false,
        presumptivePathPossible: false,
        sourceEvidence: {
          inService: [evidenceRow('B', 'STR')],
          current: [evidenceRow('B2', 'Tx')],
          rated: [],
          denied: [],
        },
        secondaryConnections: [],
      },
    ];

    const payload = buildUnifiedSummaryPayload(createUnified({}, workflow));
    expect(payload.readinessScore).toBe(70);
  });
});
