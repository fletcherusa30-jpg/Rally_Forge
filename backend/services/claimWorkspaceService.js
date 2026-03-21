import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_DIR = path.resolve(__dirname, '../data/claim-workspace');
const WORKSPACE_FILE = path.join(WORKSPACE_DIR, 'workspace.json');
const WORKSPACE_VERSION = 1;
const PROFILE_SCHEMA_VERSION = 1;

class WorkspaceValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WorkspaceValidationError';
    this.statusCode = 400;
  }
}

function createDefaultWorkspace() {
  return {
    profile: null,
    militaryService: { records: [], summary: null, updatedAt: null },
    serviceTreatmentRecords: { uploadedDocuments: [], manualEntries: [], summary: null, updatedAt: null },
    currentTreatment: { uploadedDocuments: [], manualEntries: [], summary: null, updatedAt: null },
    vaDecision: { decisions: [], selectedDecision: null, entitlementSnapshot: null, summary: null, updatedAt: null },
    analyzer: { summary: null, updatedAt: null },
    workspaceVersion: WORKSPACE_VERSION,
    workspaceChecksum: null,
    updatedAt: null,
  };
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeIsoTimestamp(value) {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function normalizeSection(section, fallback, defaults = {}) {
  if (!isObject(section)) {
    return { ...fallback, ...defaults };
  }

  return {
    ...fallback,
    ...defaults,
    ...section,
    updatedAt: normalizeIsoTimestamp(section.updatedAt) || fallback.updatedAt || null,
  };
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeProfileSection(profile, fallback) {
  if (profile === null) {
    return null;
  }

  if (!isObject(profile)) {
    throw new WorkspaceValidationError('profile must be null or an object');
  }

  const inputVersion = Number.isInteger(profile.profileSchemaVersion)
    ? profile.profileSchemaVersion
    : 0;
  let migrated = profile;

  // Migration scaffolding is intentionally present for future schema updates.
  switch (inputVersion) {
    case PROFILE_SCHEMA_VERSION:
      break;
    default:
      migrated = profile;
      break;
  }

  return {
    ...(isObject(fallback) ? fallback : {}),
    ...migrated,
    profileSchemaVersion: PROFILE_SCHEMA_VERSION,
  };
}

function normalizeWorkspace(input, baseWorkspace) {
  if (!isObject(input)) {
    throw new WorkspaceValidationError('Workspace payload must be an object');
  }

  const defaults = createDefaultWorkspace();
  const base = {
    ...defaults,
    ...(baseWorkspace || {}),
  };

  const next = {
    ...base,
    ...input,
  };

  const normalizedProfile = input.profile === undefined
    ? normalizeProfileSection(base.profile, defaults.profile)
    : normalizeProfileSection(input.profile, base.profile);

  const normalizeRecordsSection = (section, fallback) => {
    const normalized = normalizeSection(section, fallback, {
      records: Array.isArray(section?.records) ? section.records : fallback.records || [],
      summary: section?.summary ?? fallback.summary ?? null,
    });

    if (!Array.isArray(normalized.records)) {
      throw new WorkspaceValidationError('records must be an array');
    }

    return normalized;
  };

  const normalizeUploadSection = (section, fallback) => {
    const normalized = normalizeSection(section, fallback, {
      uploadedDocuments: Array.isArray(section?.uploadedDocuments) ? section.uploadedDocuments : fallback.uploadedDocuments || [],
      manualEntries: Array.isArray(section?.manualEntries) ? section.manualEntries : fallback.manualEntries || [],
      summary: section?.summary ?? fallback.summary ?? null,
    });

    if (!Array.isArray(normalized.uploadedDocuments)) {
      throw new WorkspaceValidationError('uploadedDocuments must be an array');
    }

    if (!Array.isArray(normalized.manualEntries)) {
      throw new WorkspaceValidationError('manualEntries must be an array');
    }

    return normalized;
  };

  return {
    ...next,
    profile: normalizedProfile,
    militaryService: normalizeRecordsSection(next.militaryService, defaults.militaryService),
    serviceTreatmentRecords: normalizeUploadSection(next.serviceTreatmentRecords, defaults.serviceTreatmentRecords),
    currentTreatment: normalizeUploadSection(next.currentTreatment, defaults.currentTreatment),
    vaDecision: normalizeSection(next.vaDecision, defaults.vaDecision, {
      decisions: Array.isArray(next.vaDecision?.decisions) ? next.vaDecision.decisions : defaults.vaDecision.decisions,
      selectedDecision: next.vaDecision?.selectedDecision ?? defaults.vaDecision.selectedDecision,
      entitlementSnapshot: next.vaDecision?.entitlementSnapshot ?? defaults.vaDecision.entitlementSnapshot,
      summary: next.vaDecision?.summary ?? defaults.vaDecision.summary,
    }),
    analyzer: normalizeSection(next.analyzer, defaults.analyzer, {
      summary: next.analyzer?.summary ?? defaults.analyzer.summary,
    }),
    workspaceVersion: WORKSPACE_VERSION,
    workspaceChecksum: input.workspaceChecksum ?? base.workspaceChecksum ?? null,
    updatedAt: new Date().toISOString(),
  };
}

async function ensureStorage() {
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  try {
    await fs.access(WORKSPACE_FILE);
  } catch {
    await fs.writeFile(WORKSPACE_FILE, JSON.stringify(createDefaultWorkspace(), null, 2), 'utf-8');
  }
}

export async function readClaimWorkspace() {
  await ensureStorage();
  const content = await fs.readFile(WORKSPACE_FILE, 'utf-8');
  const parsed = safeJsonParse(content, createDefaultWorkspace());
  return {
    ...createDefaultWorkspace(),
    ...(parsed || {}),
  };
}

export async function writeClaimWorkspace(workspace = {}) {
  await ensureStorage();
  const current = await readClaimWorkspace();
  const normalized = normalizeWorkspace(workspace, current);
  await fs.writeFile(WORKSPACE_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
  return normalized;
}

export { WorkspaceValidationError };