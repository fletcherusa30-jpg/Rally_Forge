import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getClaimWorkspace, saveClaimWorkspace } from '../api/client';
import { deriveWorkflow } from './workspaceDerivations.js';
import { normalizeProfile, PROFILE_SCHEMA_VERSION } from '../services/profile/profileEditorState.js';
import { createClaimGeneratorSummarySection } from '../tabs/claim-generator-summary/schema.js';
import { buildClaimDataUnified } from '../state/claimDataUnified/index.js';

const STORAGE_KEY = 'rf_claim_workspace';
const UPDATE_EVENT = 'rf-claim-workspace-updated';
const WORKSPACE_VERSION = 1;

function createDefaultWorkspace() {
  return {
    profile: null,
    militaryService: {
      records: [],
      summary: null,
      updatedAt: null,
    },
    serviceTreatmentRecords: {
      uploadedDocuments: [],
      extractedFindings: [],
      manualEntries: [],
      confidenceLevels: {
        high: 0,
        medium: 0,
        low: 0,
        manual: 0,
      },
      summary: null,
      updatedAt: null,
    },
    currentTreatment: {
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
      manualEntries: [],
      summary: null,
      updatedAt: null,
    },
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
      summary: null,
      updatedAt: null,
    },
    analyzer: {
      summary: null,
      settings: {
        secondaryMatchMode: 'balanced',
      },
      updatedAt: null,
    },
    claimGeneratorSummary: createClaimGeneratorSummarySection(),
    exposureProfile: {
      wizardStatus: 'not-started',
      completedAt: null,
      answers: {},
    },
    workspaceVersion: WORKSPACE_VERSION,
    workspaceChecksum: null,
    updatedAt: null,
  };
}

export function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeIsoTimestamp(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function normalizeSection(section, defaults) {
  if (!section || typeof section !== 'object' || Array.isArray(section)) {
    return { ...defaults };
  }

  return {
    ...defaults,
    ...section,
    updatedAt: normalizeIsoTimestamp(section.updatedAt) || defaults.updatedAt || null,
  };
}

function normalizeMilitaryRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return null;
  }

  const branchOfService = String(record.branchOfService || record.branch || '').trim();
  const serviceType = String(record.serviceType || '').trim();
  const startDate = String(record.startDate || record.serviceStartDate || '').trim();
  const endDate = String(record.endDate || record.serviceEndDate || '').trim();
  const rankRate = String(record.rankRate || record.rank || '').trim();
  const dischargeType = String(record.dischargeType || record.discharge || '').trim();
  const serviceEra = String(record.serviceEra || '').trim();
  const primaryMOS = String(record.primaryMOS || record.mos || '').trim();
  const additionalMOS = Array.isArray(record.additionalMOS)
    ? record.additionalMOS.map((item) => String(item || '').trim()).filter(Boolean)
    : Array.isArray(record.additionalMos)
      ? record.additionalMos.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
  const deploymentLocations = Array.isArray(record.deploymentLocations)
    ? record.deploymentLocations.map((item) => String(item || '').trim()).filter(Boolean)
    : Array.isArray(record.combatLocation)
      ? record.combatLocation.map((item) => String(item || '').trim()).filter(Boolean)
      : String(record.combatLocation || '').trim()
        ? [String(record.combatLocation || '').trim()]
        : [];

  const combatVeteran = Boolean(record.combatVeteran);
  const radiationExposure = Array.isArray(record.radiationExposure)
    ? record.radiationExposure.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const hazardPayIndicators = Array.isArray(record.hazardPayIndicators)
    ? record.hazardPayIndicators.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  const likelyExposures = Array.isArray(record.likelyExposures)
    ? record.likelyExposures.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  return {
    ...record,
    branchOfService,
    serviceType,
    startDate,
    endDate,
    rankRate,
    dischargeType,
    serviceEra,
    primaryMOS,
    additionalMOS,
    deploymentLocations,
    combatVeteran,
    radiationExposure,
    hazardPayIndicators,
    extractedFromDD214: Boolean(record.extractedFromDD214),
    // Keep legacy aliases to avoid breaking older consumers during transition.
    branch: branchOfService,
    mos: primaryMOS,
    additionalMos: additionalMOS,
    likelyExposures,
    exposureNotes: String(record.exposureNotes || '').trim(),
  };
}

function normalizeMilitarySection(section, defaults) {
  const normalized = normalizeSection(section, defaults);
  const records = Array.isArray(normalized.records)
    ? normalized.records.map(normalizeMilitaryRecord).filter(Boolean)
    : [];

  return {
    ...normalized,
    records,
  };
}

function normalizeStrSection(section, defaults) {
  const normalized = normalizeSection(section, defaults);

  const uploadedDocuments = Array.isArray(normalized.uploadedDocuments)
    ? normalized.uploadedDocuments
    : [];
  const extractedFindings = Array.isArray(normalized.extractedFindings)
    ? normalized.extractedFindings
    : [];
  const manualEntries = Array.isArray(normalized.manualEntries)
    ? normalized.manualEntries
    : [];

  const sourceConfidence = normalized.confidenceLevels || {};
  const confidenceLevels = {
    high: Number(sourceConfidence.high || 0),
    medium: Number(sourceConfidence.medium || 0),
    low: Number(sourceConfidence.low || 0),
    manual: Number(sourceConfidence.manual || 0),
  };

  return {
    ...normalized,
    uploadedDocuments,
    extractedFindings,
    manualEntries,
    confidenceLevels,
  };
}

function normalizeCurrentTreatmentSection(section, defaults) {
  const normalized = normalizeSection(section, defaults);
  const uploadedDocuments = Array.isArray(normalized.uploadedDocuments)
    ? normalized.uploadedDocuments
    : [];
  const manualEntries = Array.isArray(normalized.manualEntries)
    ? normalized.manualEntries
    : [];

  const ef = normalized.extractedFindings;
  const emptyEf = defaults.extractedFindings;
  let extractedFindings;
  if (ef && typeof ef === 'object' && !Array.isArray(ef)) {
    extractedFindings = {
      currentConditions: Array.isArray(ef.currentConditions) ? ef.currentConditions : [],
      functionalLimitations: Array.isArray(ef.functionalLimitations) ? ef.functionalLimitations : [],
      treatmentEvents: Array.isArray(ef.treatmentEvents) ? ef.treatmentEvents : [],
      providerSignals: Array.isArray(ef.providerSignals) ? ef.providerSignals : [],
      medicationMentions: Array.isArray(ef.medicationMentions) ? ef.medicationMentions : [],
      worseningIndicators: Array.isArray(ef.worseningIndicators) ? ef.worseningIndicators : [],
      evidenceSnippets: Array.isArray(ef.evidenceSnippets) ? ef.evidenceSnippets : [],
    };
  } else {
    extractedFindings = { ...emptyEf };
  }

  return { ...normalized, uploadedDocuments, extractedFindings, manualEntries };
}

function normalizeVaDecisionSection(section, defaults) {
  const normalized = normalizeSection(section, defaults);
  const manualEntries = Array.isArray(normalized.manualEntries)
    ? normalized.manualEntries
    : [];
  const conflicts = Array.isArray(normalized.conflicts)
    ? normalized.conflicts
    : [];

  const ef = normalized.extractedFindings;
  const emptyEf = defaults.extractedFindings;
  let extractedFindings;
  if (ef && typeof ef === 'object' && !Array.isArray(ef)) {
    extractedFindings = {
      combinedRating: ef.combinedRating ?? '',
      decisionMetadata:
        ef.decisionMetadata && typeof ef.decisionMetadata === 'object' && !Array.isArray(ef.decisionMetadata)
          ? ef.decisionMetadata
          : {},
      serviceConnectedConditions: Array.isArray(ef.serviceConnectedConditions) ? ef.serviceConnectedConditions : [],
      deniedConditions: Array.isArray(ef.deniedConditions) ? ef.deniedConditions : [],
      smcAdjustments: Array.isArray(ef.smcAdjustments) ? ef.smcAdjustments : [],
      dependentAdjustments: Array.isArray(ef.dependentAdjustments) ? ef.dependentAdjustments : [],
      effectiveDates: Array.isArray(ef.effectiveDates) ? ef.effectiveDates : [],
      confidenceBySection:
        ef.confidenceBySection && typeof ef.confidenceBySection === 'object' && !Array.isArray(ef.confidenceBySection)
          ? ef.confidenceBySection
          : {},
      evidenceSpans: Array.isArray(ef.evidenceSpans) ? ef.evidenceSpans : [],
    };
  } else {
    extractedFindings = { ...emptyEf };
  }

  return {
    ...normalized,
    manualEntries,
    extractedFindings,
    conflicts,
  };
}

export function normalizeWorkspace(input) {
  const defaults = createDefaultWorkspace();
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};

  return {
    ...defaults,
    ...source,
    profile: source.profile === null
      ? null
      : normalizeProfile(source.profile || {}),
    militaryService: normalizeMilitarySection(source.militaryService, defaults.militaryService),
    serviceTreatmentRecords: normalizeStrSection(source.serviceTreatmentRecords, defaults.serviceTreatmentRecords),
    currentTreatment: normalizeCurrentTreatmentSection(source.currentTreatment, defaults.currentTreatment),
    vaDecision: normalizeVaDecisionSection(source.vaDecision, defaults.vaDecision),
    analyzer: normalizeSection(source.analyzer, defaults.analyzer),
    claimGeneratorSummary: normalizeSection(source.claimGeneratorSummary, defaults.claimGeneratorSummary),
    exposureProfile: source.exposureProfile && typeof source.exposureProfile === 'object'
      ? { ...defaults.exposureProfile, ...source.exposureProfile }
      : defaults.exposureProfile,
    workspaceVersion: WORKSPACE_VERSION,
    workspaceChecksum: source.workspaceChecksum ?? null,
    updatedAt: new Date().toISOString(),
  };
}

function readWorkspace() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return normalizeWorkspace(createDefaultWorkspace());
  }

  const parsed = safeJsonParse(window.localStorage.getItem(STORAGE_KEY), createDefaultWorkspace());
  return normalizeWorkspace(parsed);
}

function writeWorkspace(nextWorkspace) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const normalized = normalizeWorkspace(nextWorkspace);
  const requiredSections = [
    'militaryService',
    'serviceTreatmentRecords',
    'currentTreatment',
    'vaDecision',
    'analyzer',
    'claimGeneratorSummary',
  ];

  const isComplete = requiredSections.every((section) => normalized[section] && typeof normalized[section] === 'object');
  if (!isComplete) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: normalized }));
}

export function pickLatestSection(localSection, remoteSection) {
  if (!localSection && !remoteSection) {
    return null;
  }

  if (!localSection) {
    return remoteSection || null;
  }

  if (!remoteSection) {
    return localSection || null;
  }

  const localTime = new Date(localSection?.updatedAt || 0).getTime();
  const remoteTime = new Date(remoteSection?.updatedAt || 0).getTime();

  // Deterministic precedence: remote wins only when strictly newer.
  // Local wins for equal timestamps to avoid dual-source oscillation.
  return remoteTime > localTime ? remoteSection : localSection;
}

export function mergeWorkspaces(localWorkspace, remoteWorkspace) {
  const local = normalizeWorkspace(localWorkspace || createDefaultWorkspace());
  if (!remoteWorkspace) {
    return local;
  }

  const remote = normalizeWorkspace(remoteWorkspace);
  return normalizeWorkspace({
    ...createDefaultWorkspace(),
    profile: pickLatestSection(local.profile, remote.profile),
    militaryService: pickLatestSection(local.militaryService, remote.militaryService),
    serviceTreatmentRecords: pickLatestSection(local.serviceTreatmentRecords, remote.serviceTreatmentRecords),
    currentTreatment: pickLatestSection(local.currentTreatment, remote.currentTreatment),
    vaDecision: pickLatestSection(local.vaDecision, remote.vaDecision),
    analyzer: pickLatestSection(local.analyzer, remote.analyzer),
    claimGeneratorSummary: pickLatestSection(local.claimGeneratorSummary, remote.claimGeneratorSummary),
    exposureProfile: pickLatestSection(local.exposureProfile, remote.exposureProfile) || local.exposureProfile,
    workspaceVersion: WORKSPACE_VERSION,
    workspaceChecksum: local.workspaceChecksum || remote.workspaceChecksum || null,
    profileSchemaVersion: PROFILE_SCHEMA_VERSION,
  });
}

const ClaimWorkspaceContext = createContext(null);

export function ClaimWorkspaceProvider({ children }) {
  const [workspace, setWorkspace] = useState(() => readWorkspace());
  const hasLoadedRemote = useRef(false);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key && event.key !== STORAGE_KEY) {
        return;
      }
      setWorkspace(readWorkspace());
    };

    const handleUpdate = (event) => {
      if (event?.detail) {
        setWorkspace(event.detail);
        return;
      }
      setWorkspace(readWorkspace());
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(UPDATE_EVENT, handleUpdate);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(UPDATE_EVENT, handleUpdate);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadRemoteWorkspace = async () => {
      try {
        const response = await getClaimWorkspace();
        if (isCancelled || !response?.data) return;
        const merged = mergeWorkspaces(readWorkspace(), response.data);
        writeWorkspace(merged);
        setWorkspace(merged);
      } catch {
        // Local workspace remains the fallback.
      } finally {
        hasLoadedRemote.current = true;
      }
    };

    loadRemoteWorkspace();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedRemote.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      saveClaimWorkspace(workspace).catch(() => {
        // Local storage remains authoritative if backend sync fails.
      });
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [workspace]);

  const updateWorkspace = useCallback((updater) => {
    setWorkspace((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      const normalized = normalizeWorkspace(next);
      writeWorkspace(normalized);
      return normalized;
    });
  }, []);

  const setSection = useCallback((sectionName, sectionValue) => {
    updateWorkspace((current) => ({
      ...current,
      [sectionName]: sectionValue,
    }));
  }, [updateWorkspace]);

  const workflow = useMemo(() => deriveWorkflow(workspace), [workspace]);
  const claimDataUnified = useMemo(() => buildClaimDataUnified(workspace, workflow), [workspace, workflow]);

  const value = useMemo(() => ({
    workspace,
    workflow,
    claimDataUnified,
    setSection,
    updateWorkspace,
    readWorkspace,
    normalizeWorkspace,
  }), [workspace, workflow, claimDataUnified, setSection, updateWorkspace]);

  return <ClaimWorkspaceContext.Provider value={value}>{children}</ClaimWorkspaceContext.Provider>;
}

export function useClaimWorkspace() {
  const context = useContext(ClaimWorkspaceContext);
  if (!context) {
    throw new Error('useClaimWorkspace must be used within ClaimWorkspaceProvider');
  }
  return context;
}