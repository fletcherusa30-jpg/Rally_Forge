export const PROFILE_STORAGE_KEY = 'rf_veteran_profile';
export const PROFILE_SCHEMA_VERSION = 1;

export const PROFILE_EMPTY = {
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  ssnLast4: '',
  email: '',
  phone: '',
  city: '',
  state: '',
  preferredContactMethod: '',
};

export const PROFILE_SECTIONS = {
  personal: ['firstName', 'middleName', 'lastName', 'dateOfBirth', 'ssnLast4'],
  contact: ['email', 'phone', 'city', 'state', 'preferredContactMethod'],
};

const PREFERRED_CONTACT_METHODS = new Set(['email', 'phone', 'text']);

export function normalizeProfile(input) {
  const source = input && typeof input === 'object' ? input : {};
  const inputVersion = Number.isInteger(source.profileSchemaVersion)
    ? source.profileSchemaVersion
    : 0;
  let migrated = source;

  // Migration scaffolding is intentionally in place for future schema bumps.
  switch (inputVersion) {
    case PROFILE_SCHEMA_VERSION:
      break;
    default:
      migrated = source;
      break;
  }

  return {
    ...PROFILE_EMPTY,
    ...migrated,
    ssnLast4: String(migrated.ssnLast4 || migrated.ssn4 || '').replace(/\D/g, '').slice(0, 4),
    preferredContactMethod: PREFERRED_CONTACT_METHODS.has(String(migrated.preferredContactMethod || '').trim())
      ? String(migrated.preferredContactMethod).trim()
      : '',
    profileSchemaVersion: PROFILE_SCHEMA_VERSION,
  };
}

export function buildSectionDrafts(profile) {
  const safeProfile = normalizeProfile(profile);
  return {
    personal: pickSectionValues(safeProfile, 'personal'),
    contact: pickSectionValues(safeProfile, 'contact'),
  };
}

export function pickSectionValues(profile, sectionKey) {
  const keys = PROFILE_SECTIONS[sectionKey] || [];
  return keys.reduce((acc, key) => {
    acc[key] = profile?.[key] ?? PROFILE_EMPTY[key];
    return acc;
  }, {});
}

export function isSectionDirty(sectionKey, drafts, profile) {
  const keys = PROFILE_SECTIONS[sectionKey] || [];
  if (keys.length === 0) {
    return false;
  }

  const normalizedProfile = normalizeProfile(profile);
  const sectionProfile = pickSectionValues(normalizedProfile, sectionKey);
  const sectionDraft = pickSectionValues(
    applySectionDraft(normalizedProfile, drafts, sectionKey),
    sectionKey,
  );

  return keys.some((key) => String(sectionDraft[key] ?? '') !== String(sectionProfile[key] ?? ''));
}

export function getDirtyMap(drafts, profile) {
  return Object.keys(PROFILE_SECTIONS).reduce((acc, sectionKey) => {
    acc[sectionKey] = isSectionDirty(sectionKey, drafts, profile);
    return acc;
  }, {});
}

export function hasAnyDirtySection(dirtyMap) {
  return Object.values(dirtyMap || {}).some(Boolean);
}

export function applySectionDraft(profile, drafts, sectionKey) {
  const keys = PROFILE_SECTIONS[sectionKey] || [];
  if (keys.length === 0) {
    return normalizeProfile(profile);
  }

  const base = normalizeProfile(profile);
  keys.forEach((key) => {
    base[key] = drafts?.[sectionKey]?.[key] ?? PROFILE_EMPTY[key];
  });

  base.ssnLast4 = String(base.ssnLast4 || '').replace(/\D/g, '').slice(0, 4);
  if (!PREFERRED_CONTACT_METHODS.has(base.preferredContactMethod)) {
    base.preferredContactMethod = '';
  }
  return base;
}

export function isProfileEmpty(profile) {
  const normalized = normalizeProfile(profile);
  const keysToCheck = [
    'firstName',
    'middleName',
    'lastName',
    'dateOfBirth',
    'ssnLast4',
    'email',
    'phone',
    'city',
    'state',
    'preferredContactMethod',
  ];

  return keysToCheck.every((key) => String(normalized[key] || '').trim() === '');
}
