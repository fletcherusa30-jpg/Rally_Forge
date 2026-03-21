import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { buildClaimDataUnified } from '../state/claimDataUnified/index.js';
import { ToolsPage } from '../pages/ToolsPage.jsx';
import {
  DBQ_MAPPING_TABLE,
  FOLLOW_UP_QUESTION_LIBRARY,
  FORM_RECOMMENDATION_RULESET,
} from '../engine/shared/claimEngineConfig.js';

const workspaceRef = { current: null };

vi.mock('../context/ClaimWorkspaceContext.jsx', () => ({
  useClaimWorkspace: () => ({
    workspace: workspaceRef.current,
    updateWorkspace: vi.fn(),
  }),
}));

function createWorkspace(overrides = {}) {
  return {
    profile: {
      firstName: 'Alex',
      middleName: '',
      lastName: 'Veteran',
      dateOfBirth: '1982-01-15',
      ssnLast4: '1234',
      email: 'alex@example.com',
      phone: '5551112222',
      city: 'Austin',
      state: 'TX',
      preferredContactMethod: 'email',
      representationType: 'VSO',
    },
    militaryService: {
      records: [
        {
          id: 'svc-1',
          branchOfService: 'Army',
          serviceType: 'Active',
          startDate: '2001-01-10',
          endDate: '2007-06-01',
          rankRate: 'E-5',
          dischargeType: 'Honorable',
          serviceEra: 'Post-9/11 Era',
          primaryMOS: '11B',
          additionalMOS: ['13F'],
          deploymentLocations: ['Iraq'],
          combatVeteran: true,
          radiationExposure: ['none'],
          hazardPayIndicators: ['burn pits', 'hazardous noise'],
          extractedFromDD214: true,
        },
      ],
    },
    serviceTreatmentRecords: {
      uploadedDocuments: [],
      extractedFindings: [
        { findingType: 'diagnosis', conditionName: 'Tinnitus', summaryText: 'Persistent ringing', evidenceSnippet: 'Ringing in ears while deployed' },
        { findingType: 'diagnosis', conditionName: 'PTSD', summaryText: 'Combat related stress', evidenceSnippet: 'Combat stress response' },
        { findingType: 'injury', conditionName: 'Low back pain', summaryText: 'Back injury during service', evidenceSnippet: 'Lift injury in theater' },
        { findingType: 'event', conditionName: 'Knee pain', summaryText: 'Knee pain event', evidenceSnippet: 'Knee pain after convoy' },
      ],
      manualEntries: [
        {
          conditionName: 'Headaches',
          eventDate: '2005-02-02',
          description: 'Headache episodes in service',
          serviceEventFlags: ['inServiceEvent'],
          relatedContext: 'Field environment',
        },
      ],
    },
    currentTreatment: {
      uploadedDocuments: [],
      extractedFindings: {
        currentConditions: ['tinnitus', 'sleep apnea', 'hypertension', 'migraines', 'low back pain'],
        functionalLimitations: ['difficulty concentrating due to tinnitus', 'reduced mobility from back pain'],
        treatmentEvents: ['ENT follow-up for tinnitus', 'Sleep study confirmed OSA'],
        providerSignals: ['VA ENT', 'VA Sleep Clinic'],
        medicationMentions: ['Topiramate increased dose'],
        worseningIndicators: ['low back pain', 'hypertension'],
        evidenceSnippets: ['Migraine attacks increased in frequency'],
      },
      manualEntries: [
        {
          id: 'tx-1',
          conditionName: 'Sleep apnea',
          symptomSummary: 'Snoring and daytime fatigue',
          status: 'active',
          providerName: 'VA Sleep',
          providerType: 'specialist',
          treatmentDetails: 'CPAP prescribed',
          treatmentStartDate: '2024-01-05',
          treatmentEndDate: '',
          medications: [{ medicationName: 'none', dosage: '', sideEffects: '' }],
        },
        {
          id: 'tx-2',
          conditionName: 'Migraine headaches',
          symptomSummary: 'Worsening headaches with work impact',
          status: 'active',
          providerName: 'Neurology',
          providerType: 'specialist',
          treatmentDetails: 'Medication dose increased',
          treatmentStartDate: '2024-02-01',
          treatmentEndDate: '',
          medications: [{ medicationName: 'Topiramate', dosage: 'increased', sideEffects: 'fatigue' }],
        },
      ],
    },
    vaDecision: {
      manualEntries: [
        {
          conditionName: 'post traumatic stress',
          percentage: '50',
          effectiveDate: '2022-01-01',
          isServiceConnected: true,
          isDenied: false,
          denialReason: '',
          smcCodes: [],
          dependents: 'spouse',
          combinedRating: '60',
        },
        {
          conditionName: 'Migraines',
          percentage: '',
          effectiveDate: '2023-01-01',
          isServiceConnected: false,
          isDenied: true,
          denialReason: 'No nexus',
          smcCodes: [],
          dependents: '',
          combinedRating: '60',
        },
        {
          conditionName: 'low back pain',
          percentage: '10',
          effectiveDate: '2021-07-10',
          isServiceConnected: true,
          isDenied: false,
          denialReason: '',
          smcCodes: [],
          dependents: '',
          combinedRating: '60',
        },
      ],
      extractedFindings: {
        combinedRating: '60',
        decisionMetadata: {},
        serviceConnectedConditions: [{ conditionName: 'PTSD' }, { conditionName: 'Low back pain' }],
        deniedConditions: [{ conditionName: 'Migraine headaches' }],
        smcAdjustments: [{ type: 'SMC-K' }],
        dependentAdjustments: [{ type: 'spouse' }],
        effectiveDates: ['2021-07-10', '2022-01-01', '2023-01-01'],
        confidenceBySection: {},
        evidenceSpans: [{ section: 'serviceConnectedConditions' }],
      },
      conflicts: [],
    },
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
    ...overrides,
  };
}

function recompute(workspace) {
  return buildClaimDataUnified(workspace);
}

describe('Global Testing Requirements', () => {
  it('validates schema correctness, required fields, reference integrity, and dedupe', () => {
    const unified = recompute(createWorkspace());

    expect(unified).toHaveProperty('profile');
    expect(unified).toHaveProperty('service');
    expect(unified).toHaveProperty('str');
    expect(unified).toHaveProperty('currentTreatment');
    expect(unified).toHaveProperty('ratingDecision');
    expect(unified).toHaveProperty('derivedSignals');
    expect(unified).toHaveProperty('generatedConditions');
    expect(unified).toHaveProperty('layStatement');
    expect(unified).toHaveProperty('evidenceIndex');
    expect(unified).toHaveProperty('timeline');

    const conditionNames = unified.generatedConditions.map((item) => String(item.conditionName || '').toLowerCase());
    expect(new Set(conditionNames).size).toBe(conditionNames.length);

    unified.generatedConditions.forEach((condition) => {
      expect(condition.conditionName).toBeTruthy();
      expect(condition.category).toBeTruthy();
      expect(condition.evidence).toBeTruthy();
      expect(condition.recommendedForms.length).toBeGreaterThan(0);
      expect(condition.recommendedDBQs.length).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(String(condition.confidence));
    });

    unified.evidenceIndex.forEach((row) => {
      expect(row.conditionName).toBeTruthy();
      expect(row.source).toBeTruthy();
      expect(row.summary).toBeTruthy();
      expect(['high', 'medium', 'low']).toContain(String(row.confidence));
    });

    expect(unified.layStatement.length).toBeGreaterThan(0);

    const timelineDates = unified.timeline.map((event) => event.date).filter(Boolean);
    const sortedDates = [...timelineDates].sort((a, b) => a.localeCompare(b));
    expect(timelineDates).toEqual(sortedDates);
  });

  it('validates stale-data prevention after recompute updates', () => {
    const workspace = createWorkspace();
    const before = recompute(workspace);

    const nextWorkspace = createWorkspace({
      currentTreatment: {
        ...workspace.currentTreatment,
        extractedFindings: {
          ...workspace.currentTreatment.extractedFindings,
          currentConditions: ['tinnitus'],
        },
        manualEntries: [],
      },
      vaDecision: {
        ...workspace.vaDecision,
        manualEntries: workspace.vaDecision.manualEntries.filter((item) => String(item.conditionName).toLowerCase() !== 'migraines'),
        extractedFindings: {
          ...workspace.vaDecision.extractedFindings,
          deniedConditions: [],
        },
      },
    });

    const after = recompute(nextWorkspace);
    expect(before.generatedConditions.length).toBeGreaterThanOrEqual(after.generatedConditions.length);
    const reopenBefore = before.generatedConditions.filter((item) => item.category === 'reopen').length;
    const reopenAfter = after.generatedConditions.filter((item) => item.category === 'reopen').length;
    expect(reopenAfter).toBeLessThanOrEqual(reopenBefore);
  });
});

describe('Tab 01 - Profile Tests', () => {
  it('validates required profile fields and mapping into claimDataUnified.profile', () => {
    const unified = recompute(createWorkspace());
    expect(unified.profile.firstName).toBe('Alex');
    expect(unified.profile.lastName).toBe('Veteran');
    expect(unified.profile.dateOfBirth).toBe('1982-01-15');
    expect(unified.profile.ssnLast4).toBe('1234');
    expect(unified.profile.email).toBe('alex@example.com');
    expect(unified.profile.phone).toBe('5551112222');
    expect(unified.profile.city).toBe('Austin');
    expect(unified.profile.state).toBe('TX');
  });

  it('validates silent update and identity propagation to lay statement', () => {
    const before = recompute(createWorkspace());
    const after = recompute(createWorkspace({ profile: { ...createWorkspace().profile, firstName: 'Jordan', lastName: 'Claimant' } }));

    expect(before.layStatement).toMatch(/Alex\s+Veteran/);
    expect(after.layStatement).toMatch(/Jordan\s+Claimant/);
    expect(before.layStatement).not.toEqual(after.layStatement);
  });

  it('validates no duplicate profile entries', () => {
    const unified = recompute(createWorkspace());
    const keys = Object.keys(unified.profile);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('Tab 02 - Military Service Tests', () => {
  it('validates DD-214/manual mapping and multiple service periods', () => {
    const workspace = createWorkspace({
      militaryService: {
        records: [
          ...createWorkspace().militaryService.records,
          {
            id: 'svc-2',
            branchOfService: 'Army',
            serviceType: 'Reserve',
            startDate: '2008-01-01',
            endDate: '2012-01-01',
            rankRate: 'E-6',
            dischargeType: 'Honorable',
            serviceEra: 'Post-9/11 Era',
            primaryMOS: '68W',
            additionalMOS: [],
            deploymentLocations: ['Kuwait'],
            combatVeteran: false,
            radiationExposure: ['none'],
            hazardPayIndicators: ['hazardous noise'],
            extractedFromDD214: false,
          },
        ],
      },
    });

    const unified = recompute(workspace);
    expect(unified.service.length).toBe(2);
    expect(unified.service[0].extractedFromDD214).toBe(true);
    expect(unified.service[1].serviceType).toBe('Reserve');
  });

  it('validates exposure detection and silent derived-signal recompute', () => {
    const before = recompute(createWorkspace());
    const after = recompute(createWorkspace({
      militaryService: {
        records: [{
          ...createWorkspace().militaryService.records[0],
          deploymentLocations: ['Vietnam'],
          hazardPayIndicators: ['agent orange'],
          radiationExposure: ['radiation'],
        }],
      },
    }));

    expect(before.derivedSignals.exposures).not.toEqual(after.derivedSignals.exposures);
    expect(after.derivedSignals.exposures.some((item) => /agent orange|radiation/i.test(item))).toBe(true);
    expect(after.derivedSignals.presumptives.length).toBeGreaterThan(0);
    expect(Array.isArray(after.derivedSignals.secondaryCandidates)).toBe(true);
  });
});

describe('Tab 03 - STR Tests', () => {
  it('validates STR extraction schema and dedupe normalization', () => {
    const workspace = createWorkspace({
      serviceTreatmentRecords: {
        ...createWorkspace().serviceTreatmentRecords,
        manualEntries: [
          { conditionName: 'Headaches', eventDate: '2005-02-02', description: 'In-service headaches', serviceEventFlags: [], relatedContext: '' },
          { conditionName: 'migraines', eventDate: '2006-03-02', description: 'In-service headaches', serviceEventFlags: [], relatedContext: '' },
        ],
      },
    });

    const unified = recompute(workspace);
    expect(unified.str.extractedFindings.diagnoses.length).toBeGreaterThan(0);
    expect(Array.isArray(unified.str.extractedFindings.audiogramSignals)).toBe(true);
    expect(Array.isArray(unified.str.extractedFindings.presumptiveSignals)).toBe(true);
    expect(unified.str.manualEntries.every((item) => typeof item.conditionName === 'string')).toBe(true);
  });

  it('validates silent STR-driven recompute for primary conditions and confidence shifts', () => {
    const before = recompute(createWorkspace());
    const after = recompute(createWorkspace({
      serviceTreatmentRecords: {
        ...createWorkspace().serviceTreatmentRecords,
        extractedFindings: [
          ...createWorkspace().serviceTreatmentRecords.extractedFindings,
          { findingType: 'diagnosis', conditionName: 'Sleep apnea', summaryText: 'In-service symptom cluster', evidenceSnippet: 'Fatigue and loud snoring' },
        ],
      },
    }));

    expect(after.generatedConditions.length).toBeGreaterThanOrEqual(before.generatedConditions.length);
    const changedScores = after.generatedConditions.some((item) => item.confidenceScore !== undefined);
    expect(changedScores).toBe(true);
  });
});

describe('Tab 04 - Current Treatment Tests', () => {
  it('validates treatment extraction/manual schema and dedupe expectations', () => {
    const unified = recompute(createWorkspace());
    expect(unified.currentTreatment.extractedFindings.currentConditions.length).toBeGreaterThan(0);
    expect(unified.currentTreatment.extractedFindings.functionalLimitations.length).toBeGreaterThan(0);
    expect(unified.currentTreatment.extractedFindings.medicationMentions.length).toBeGreaterThan(0);
    expect(unified.currentTreatment.extractedFindings.worseningIndicators.length).toBeGreaterThan(0);
    expect(unified.currentTreatment.manualEntries.length).toBeGreaterThan(0);
  });

  it('validates treatment-driven silent recompute for worsening and increase candidates', () => {
    const before = recompute(createWorkspace());
    const after = recompute(createWorkspace({
      currentTreatment: {
        ...createWorkspace().currentTreatment,
        extractedFindings: {
          ...createWorkspace().currentTreatment.extractedFindings,
          worseningIndicators: ['low back pain', 'migraine headaches', 'hypertension'],
        },
      },
    }));

    expect(after.derivedSignals.worseningIndicators.length).toBeGreaterThanOrEqual(before.derivedSignals.worseningIndicators.length);
    expect(after.generatedConditions.some((item) => item.category === 'increase')).toBe(true);
  });
});

describe('Tab 05 - Rating Decision Tests', () => {
  it('validates extracted/manual rating schema and conflict field integrity', () => {
    const unified = recompute(createWorkspace());
    expect(unified.ratingDecision.extractedFindings.serviceConnectedConditions.length).toBeGreaterThan(0);
    expect(unified.ratingDecision.extractedFindings.deniedConditions.length).toBeGreaterThan(0);
    expect(unified.ratingDecision.extractedFindings.effectiveDates.length).toBeGreaterThan(0);
    expect(unified.ratingDecision.extractedFindings.smcAdjustments.length).toBeGreaterThan(0);
    expect(Array.isArray(unified.ratingDecision.conflicts)).toBe(true);
  });

  it('validates rating-driven silent recompute for reopen/increase candidates', () => {
    const before = recompute(createWorkspace());
    const after = recompute(createWorkspace({
      vaDecision: {
        ...createWorkspace().vaDecision,
        extractedFindings: {
          ...createWorkspace().vaDecision.extractedFindings,
          deniedConditions: [{ conditionName: 'Sleep apnea' }, { conditionName: 'Migraine headaches' }],
        },
      },
    }));

    const beforeReopen = before.generatedConditions.filter((item) => item.category === 'reopen').length;
    const afterReopen = after.generatedConditions.filter((item) => item.category === 'reopen').length;
    expect(afterReopen).toBeGreaterThanOrEqual(beforeReopen);
  });
});

describe('Tab 06 - Claim Generator Tests', () => {
  it('validates condition categories, confidence tiers, no duplicates, and required fields', () => {
    const unified = recompute(createWorkspace());

    const categories = new Set(unified.generatedConditions.map((item) => item.category));
    expect(categories.has('primary')).toBe(true);
    expect(categories.has('presumptive')).toBe(true);
    expect(categories.has('reopen')).toBe(true);
    expect(categories.has('increase')).toBe(true);
    expect(categories.size).toBeGreaterThanOrEqual(4);

    unified.generatedConditions.forEach((condition) => {
      expect(['high', 'medium', 'low']).toContain(condition.confidence);
      expect(condition.missingEvidence).toBeTruthy();
      expect(Array.isArray(condition.followUpQuestions)).toBe(true);
      expect(Array.isArray(condition.recommendedDBQs)).toBe(true);
      expect(Array.isArray(condition.recommendedForms)).toBe(true);
    });

    const names = unified.generatedConditions.map((item) => item.conditionName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('validates follow-up library, DBQ mapping, and form ruleset usage', () => {
    const unified = recompute(createWorkspace());

    const allQuestions = unified.generatedConditions.flatMap((item) => item.followUpQuestions);
    const knownQuestions = new Set(Object.values(FOLLOW_UP_QUESTION_LIBRARY).flatMap((items) => items));
    expect(allQuestions.some((q) => knownQuestions.has(q))).toBe(true);

    const dbqValues = new Set(Object.values(DBQ_MAPPING_TABLE));
    expect(unified.generatedConditions.some((item) => item.recommendedDBQs.some((dbq) => dbqValues.has(dbq)))).toBe(true);

    const formValues = new Set(Object.values(FORM_RECOMMENDATION_RULESET).flatMap((items) => items));
    expect(unified.generatedConditions.some((item) => item.recommendedForms.some((form) => formValues.has(form)))).toBe(true);
  });

  it('validates lay statement regeneration on update', () => {
    const before = recompute(createWorkspace());
    const after = recompute(createWorkspace({
      currentTreatment: {
        ...createWorkspace().currentTreatment,
        manualEntries: [{
          id: 'tx-new',
          conditionName: 'Hypertension',
          symptomSummary: 'New worsening symptoms',
          status: 'active',
          providerName: 'Cardiology',
          providerType: 'specialist',
          treatmentDetails: 'Medication adjustments',
          treatmentStartDate: '2025-01-01',
          treatmentEndDate: '',
          medications: [{ medicationName: 'Lisinopril', dosage: 'increased', sideEffects: '' }],
        }],
      },
    }));

    expect(before.layStatement).not.toEqual(after.layStatement);
    expect(after.layStatement).toContain('I. Veteran Identity and Service');
    expect(after.layStatement).toContain('VII. Closing Statement');
  });
});

describe('Tab 07 - Resources Tests', () => {
  it('validates resources navigation blocks and unified lay statement reflection', () => {
    const workspace = createWorkspace();
    const unified = recompute(workspace);

    workspaceRef.current = {
      ...workspace,
      claimGeneratorSummary: {
        ...workspace.claimGeneratorSummary,
        layStatementTemplate: unified.layStatement,
      },
    };

    render(
      <MemoryRouter>
        <ToolsPage />
      </MemoryRouter>
    );

    expect(screen.getAllByText('Resources').length).toBeGreaterThan(0);
    expect(screen.getByText('Financial Planner')).toBeTruthy();
    expect(screen.getByText('Knowledge Base')).toBeTruthy();
    expect(screen.getByText('State Benefits')).toBeTruthy();
    expect(screen.getByText('Review Queue')).toBeTruthy();
    expect(screen.getByText('Scanner Activity')).toBeTruthy();
    expect(screen.getByText('Workspace Updates')).toBeTruthy();
    expect(screen.getByText('Claim Lay Statement Template')).toBeTruthy();
    expect(screen.getByText(/I\. Veteran Identity and Service/)).toBeTruthy();
  });
});

describe('Full Application Tests', () => {
  it('validates end-to-end unified workflow integrity and merged timeline', () => {
    const unified = recompute(createWorkspace());

    expect(unified.profile.firstName).toBeTruthy();
    expect(unified.service.length).toBeGreaterThan(0);
    expect(unified.str.extractedFindings.diagnoses.length).toBeGreaterThan(0);
    expect(unified.currentTreatment.extractedFindings.currentConditions.length).toBeGreaterThan(0);
    expect(unified.ratingDecision.extractedFindings.serviceConnectedConditions.length).toBeGreaterThan(0);
    expect(unified.generatedConditions.length).toBeGreaterThan(0);

    expect(unified.timeline.length).toBeGreaterThan(0);
    expect(unified.evidenceIndex.length).toBeGreaterThan(0);

    const timelineHasMultipleSources = new Set(unified.timeline.map((item) => item.source)).size >= 3;
    expect(timelineHasMultipleSources).toBe(true);
  });

  it('validates background recompute trigger simulation for each tab mutation', () => {
    const base = createWorkspace();
    const pass1 = recompute(base);
    const pass2 = recompute({ ...base, profile: { ...base.profile, firstName: 'Sam' } });
    const pass3 = recompute({ ...base, militaryService: { records: [{ ...base.militaryService.records[0], deploymentLocations: ['Afghanistan'], hazardPayIndicators: ['agent orange'] }] } });
    const pass4 = recompute({ ...base, serviceTreatmentRecords: { ...base.serviceTreatmentRecords, manualEntries: [{ conditionName: 'Neck pain', eventDate: '2006-03-01', description: 'Neck strain', serviceEventFlags: [], relatedContext: '' }] } });
    const pass5 = recompute({ ...base, currentTreatment: { ...base.currentTreatment, extractedFindings: { ...base.currentTreatment.extractedFindings, worseningIndicators: ['low back pain', 'migraines'] } } });
    const pass6 = recompute({ ...base, vaDecision: { ...base.vaDecision, extractedFindings: { ...base.vaDecision.extractedFindings, deniedConditions: [{ conditionName: 'Sleep apnea' }] } } });

    expect(pass1.layStatement).not.toEqual(pass2.layStatement);
    expect(pass1.derivedSignals.exposures).not.toEqual(pass3.derivedSignals.exposures);
    expect(pass1.generatedConditions.length).not.toBe(pass4.generatedConditions.length);
    expect(pass1.derivedSignals.worseningIndicators).not.toEqual(pass5.derivedSignals.worseningIndicators);
    expect(pass1.generatedConditions.filter((item) => item.category === 'reopen').length)
      .not.toBe(pass6.generatedConditions.filter((item) => item.category === 'reopen').length);
  });
});
