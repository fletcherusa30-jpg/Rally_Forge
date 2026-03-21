import { useEffect, useMemo, useState } from 'react';
import { useClaimWorkspace } from '../../context/ClaimWorkspaceContext';
// eslint-disable-next-line no-unused-vars
import { ProfileSectionCard } from './ProfileSectionCard.jsx';
// eslint-disable-next-line no-unused-vars
import { ProfilePageSkeleton } from './ProfilePageSkeleton.jsx';
import {
  PROFILE_EMPTY,
  PROFILE_SCHEMA_VERSION,
  applySectionDraft,
  buildSectionDrafts,
  getDirtyMap,
  hasAnyDirtySection,
  isProfileEmpty,
  normalizeProfile,
  pickSectionValues,
} from '../../services/profile/profileEditorState.js';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'GU', 'VI', 'AS', 'MP',
];

const SECTION_KEYS = ['personal', 'contact'];
const REQUIRED_FIELDS = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'ssnLast4',
  'email',
  'phone',
  'city',
  'state',
  'preferredContactMethod',
];

const PREFERRED_CONTACT_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'text', label: 'Text' },
];


const SECTION_MACHINE_STATE = {
  IDLE: 'idle',
  EDITING: 'editing',
  DIRTY: 'dirty',
  SAVING: 'saving',
  ERROR: 'error',
};

function createSectionMachine() {
  return SECTION_KEYS.reduce((acc, sectionId) => {
    acc[sectionId] = SECTION_MACHINE_STATE.IDLE;
    return acc;
  }, {});
}

function transitionSectionMachine(currentMachine, action) {
  const currentState = currentMachine[action.sectionId] || SECTION_MACHINE_STATE.IDLE;
  let nextState = currentState;

  if (action.type === 'startEditingSection' && currentState === SECTION_MACHINE_STATE.IDLE) {
    nextState = SECTION_MACHINE_STATE.EDITING;
  }

  if (action.type === 'setSectionField') {
    if (currentState === SECTION_MACHINE_STATE.EDITING || currentState === SECTION_MACHINE_STATE.DIRTY) {
      nextState = SECTION_MACHINE_STATE.DIRTY;
    }
  }

  if (action.type === 'saveSection' && currentState === SECTION_MACHINE_STATE.DIRTY) {
    nextState = SECTION_MACHINE_STATE.SAVING;
  }

  if (action.type === 'saveSectionSuccess' && currentState === SECTION_MACHINE_STATE.SAVING) {
    nextState = SECTION_MACHINE_STATE.IDLE;
  }

  if (action.type === 'saveSectionError' && currentState === SECTION_MACHINE_STATE.SAVING) {
    nextState = SECTION_MACHINE_STATE.ERROR;
  }

  if (action.type === 'cancelEditingSection') {
    if (
      currentState === SECTION_MACHINE_STATE.EDITING
      || currentState === SECTION_MACHINE_STATE.DIRTY
      || currentState === SECTION_MACHINE_STATE.ERROR
    ) {
      nextState = SECTION_MACHINE_STATE.IDLE;
    }
  }

  if (nextState === currentState) {
    return currentMachine;
  }

  return {
    ...currentMachine,
    [action.sectionId]: nextState,
  };
}

function isValidDate(value) {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed.getTime() <= today.getTime();
}

function formatPreferredContact(value) {
  const found = PREFERRED_CONTACT_OPTIONS.find((option) => option.value === value);
  return found ? found.label : '—';
}


export function ProfilePage() {
  const { workspace, readWorkspace, normalizeWorkspace, updateWorkspace } = useClaimWorkspace();
  const [loadState, setLoadState] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [profile, setProfile] = useState(PROFILE_EMPTY);
  const [drafts, setDrafts] = useState(buildSectionDrafts(PROFILE_EMPTY));
  const [sectionMachine, setSectionMachine] = useState(createSectionMachine());
  const [saving, setSaving] = useState({ personal: false, contact: false });
  const [sectionStatus, setSectionStatus] = useState({ personal: '', contact: '' });
  const [sectionErrors, setSectionErrors] = useState({ personal: '', contact: '' });
  const [validationErrors, setValidationErrors] = useState({ personal: {}, contact: {} });

  const hydrateProfile = () => {
    setLoadState('loading');
    setLoadError('');

    try {
      const localWorkspace = readWorkspace();
      const normalizedWorkspace = normalizeWorkspace(localWorkspace);
      const nextProfile = normalizeProfile(normalizedWorkspace?.profile || workspace?.profile || {});

      setProfile(nextProfile);
      setDrafts(buildSectionDrafts(nextProfile));
      setSectionMachine(createSectionMachine());
      setSectionStatus({ personal: '', contact: '' });
      setSectionErrors({ personal: '', contact: '' });
      setValidationErrors({ personal: {}, contact: {} });
      setLoadState('ready');
    } catch {
      setLoadState('error');
      setLoadError('Profile could not be loaded. Retry to recover local data.');
    }
  };

  useEffect(() => {
    hydrateProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirtyMap = useMemo(() => getDirtyMap(drafts, profile), [drafts, profile]);
  const hasUnsavedChanges = hasAnyDirtySection(dirtyMap);
  const workspaceVersion = workspace?.workspaceVersion || 1;

  const profileCompletion = useMemo(() => {
    const effective = normalizeProfile({ ...profile, ...drafts.personal, ...drafts.contact });
    const filled = REQUIRED_FIELDS.reduce((count, key) => {
      return String(effective?.[key] || '').trim() ? count + 1 : count;
    }, 0);
    return Math.round((filled / REQUIRED_FIELDS.length) * 100);
  }, [drafts, profile]);

  // Placeholder for future ZIP support: auto-hydrate city/state once a ZIP field is added.
  const hydrateCityStateFromZip = () => null;
  void hydrateCityStateFromZip;

  const emitTelemetry = (eventName, sectionId, snapshot = dirtyMap) => {
    console.info('profile.telemetry', {
      eventName,
      sectionId,
      dirtyMap: snapshot,
      workspaceVersion,
      profileSchemaVersion: profile?.profileSchemaVersion || PROFILE_SCHEMA_VERSION,
    });
  };

  const applySectionTransition = (action) => {
    setSectionMachine((current) => {
      const next = transitionSectionMachine(current, action);
      if (next !== current) {
        console.info('profile.section.transition', {
          sectionId: action.sectionId,
          action: action.type,
          from: current[action.sectionId],
          to: next[action.sectionId],
        });
      }
      return next;
    });
  };

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    updateWorkspace((current) => ({
      ...current,
      profileEditor: {
        ...(current?.profileEditor || {}),
        hasUnsavedChanges,
        dirtySections: dirtyMap,
        updatedAt: new Date().toISOString(),
      },
    }));

    return () => {
      updateWorkspace((current) => ({
        ...current,
        profileEditor: {
          ...(current?.profileEditor || {}),
          hasUnsavedChanges: false,
          dirtySections: { personal: false, contact: false },
          updatedAt: new Date().toISOString(),
        },
      }));
    };
  }, [dirtyMap, hasUnsavedChanges, updateWorkspace]);

  const validateField = (field, value) => {
    const safeValue = String(value || '').trim();

    if (field === 'middleName') {
      return '';
    }

    if (!safeValue) {
      return 'This field is required.';
    }

    if (field === 'dateOfBirth' && !isValidDate(value)) {
      return 'Enter a valid past date.';
    }

    if (field === 'ssnLast4' && !/^\d{4}$/.test(String(value || ''))) {
      return 'Enter exactly 4 digits.';
    }

    if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeValue)) {
      return 'Enter a valid email address.';
    }

    if (field === 'phone') {
      const digits = String(value || '').replace(/\D/g, '');
      if (digits.length < 10) {
        return 'Enter a valid phone number.';
      }
    }

    if (field === 'state' && !US_STATES.includes(safeValue)) {
      return 'Select a valid state.';
    }

    if (field === 'preferredContactMethod' && !PREFERRED_CONTACT_OPTIONS.some((item) => item.value === value)) {
      return 'Choose email, phone, or text.';
    }

    return '';
  };

  const setFieldValidationError = (sectionKey, field, errorMessage) => {
    setValidationErrors((current) => {
      const nextSection = { ...(current?.[sectionKey] || {}) };
      if (errorMessage) {
        nextSection[field] = errorMessage;
      } else {
        delete nextSection[field];
      }

      return {
        ...current,
        [sectionKey]: nextSection,
      };
    });
  };

  const validateSection = (sectionKey, sourceDrafts = drafts) => {
    const fields = Object.keys(sourceDrafts?.[sectionKey] || {});
    const nextErrors = {};

    fields.forEach((field) => {
      const error = validateField(field, sourceDrafts?.[sectionKey]?.[field]);
      if (error) {
        nextErrors[field] = error;
      }
    });

    setValidationErrors((current) => ({
      ...current,
      [sectionKey]: nextErrors,
    }));

    return Object.keys(nextErrors).length === 0;
  };

  const setSectionField = (sectionKey, field, value) => {
    applySectionTransition({ type: 'setSectionField', sectionId: sectionKey });

    setDrafts((current) => {
      const nextValue = field === 'ssnLast4' ? String(value || '').replace(/\D/g, '').slice(0, 4) : value;
      const nextDrafts = {
        ...current,
        [sectionKey]: {
          ...current[sectionKey],
          [field]: nextValue,
        },
      };

      emitTelemetry('setSectionField', sectionKey, getDirtyMap(nextDrafts, profile));
      return nextDrafts;
    });

    setFieldValidationError(sectionKey, field, '');
  };

  const startEditingSection = (sectionKey) => {
    applySectionTransition({ type: 'startEditingSection', sectionId: sectionKey });
    emitTelemetry('startEditingSection', sectionKey);
    setSectionStatus((current) => ({ ...current, [sectionKey]: '' }));
    setSectionErrors((current) => ({ ...current, [sectionKey]: '' }));
  };

  const cancelEditingSection = (sectionKey) => {
    setDrafts((current) => ({
      ...current,
      [sectionKey]: pickSectionValues(profile, sectionKey),
    }));
    applySectionTransition({ type: 'cancelEditingSection', sectionId: sectionKey });
    setSectionStatus((current) => ({ ...current, [sectionKey]: 'Changes discarded.' }));
    setSectionErrors((current) => ({ ...current, [sectionKey]: '' }));
    setValidationErrors((current) => ({ ...current, [sectionKey]: {} }));
  };

  const persistProfile = (nextProfile) => {
    const normalizedProfile = normalizeProfile(nextProfile);
    emitTelemetry('persistProfile', 'profile');

    updateWorkspace((current) => ({
      ...current,
      profile: {
        ...normalizedProfile,
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const saveSection = (sectionKey) => {
    const isValid = validateSection(sectionKey);
    if (!isValid) {
      applySectionTransition({ type: 'saveSectionError', sectionId: sectionKey });
      setSectionErrors((current) => ({ ...current, [sectionKey]: 'Resolve validation errors before saving.' }));
      return;
    }

    applySectionTransition({ type: 'saveSection', sectionId: sectionKey });
    emitTelemetry('saveSection', sectionKey);

    setSaving((current) => ({ ...current, [sectionKey]: true }));
    setSectionErrors((current) => ({ ...current, [sectionKey]: '' }));

    try {
      const nextProfile = applySectionDraft(profile, drafts, sectionKey);
      persistProfile(nextProfile);
      setProfile(nextProfile);
      setDrafts((current) => ({
        ...current,
        [sectionKey]: pickSectionValues(nextProfile, sectionKey),
      }));
      setValidationErrors((current) => ({ ...current, [sectionKey]: {} }));
      applySectionTransition({ type: 'saveSectionSuccess', sectionId: sectionKey });
      setSectionStatus((current) => ({ ...current, [sectionKey]: 'Section saved.' }));
    } catch {
      applySectionTransition({ type: 'saveSectionError', sectionId: sectionKey });
      setSectionErrors((current) => ({ ...current, [sectionKey]: 'Save failed. Retry or cancel to recover.' }));
    } finally {
      setSaving((current) => ({ ...current, [sectionKey]: false }));
    }
  };

  const renderInput = (sectionKey, field, label, type = 'text', placeholder = '') => {
    const inputId = `${sectionKey}-${field}`;
    const isReadOnly = sectionMachine[sectionKey] === SECTION_MACHINE_STATE.IDLE || sectionMachine[sectionKey] === SECTION_MACHINE_STATE.SAVING;

    return (
      <div className='profile-field'>
        <label className='profile-label' htmlFor={inputId}>{label}</label>
        <input
          id={inputId}
          type={type}
          value={drafts?.[sectionKey]?.[field] ?? ''}
          onChange={(event) => setSectionField(sectionKey, field, event.target.value)}
          onBlur={(event) => setFieldValidationError(sectionKey, field, validateField(field, event.target.value))}
          placeholder={placeholder}
          className='str-input'
          readOnly={isReadOnly}
          aria-readonly={isReadOnly}
        />
        {validationErrors?.[sectionKey]?.[field] && <p className='profile-field-error'>{validationErrors[sectionKey][field]}</p>}
      </div>
    );
  };

  const renderSelect = (sectionKey, field, label, options, placeholder = 'Select...') => {
    const inputId = `${sectionKey}-${field}`;
    const isDisabled = sectionMachine[sectionKey] === SECTION_MACHINE_STATE.IDLE || sectionMachine[sectionKey] === SECTION_MACHINE_STATE.SAVING;

    return (
      <div className='profile-field'>
        <label className='profile-label' htmlFor={inputId}>{label}</label>
        <select
          id={inputId}
          value={drafts?.[sectionKey]?.[field] ?? ''}
          onChange={(event) => setSectionField(sectionKey, field, event.target.value)}
          onBlur={(event) => setFieldValidationError(sectionKey, field, validateField(field, event.target.value))}
          className='str-input'
          disabled={isDisabled}
          aria-disabled={isDisabled}
        >
          <option value=''>{placeholder}</option>
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        {validationErrors?.[sectionKey]?.[field] && <p className='profile-field-error'>{validationErrors[sectionKey][field]}</p>}
      </div>
    );
  };


  if (loadState === 'loading') {
    return <ProfilePageSkeleton />;
  }

  if (loadState === 'error') {
    return (
      <div className='page-shell'>
        <section className='page-header'>
          <div>
            <div className='page-eyebrow'>Veteran</div>
            <h1 className='page-title'>Profile</h1>
          </div>
        </section>
        <article className='rf-card'>
          <h2 className='rf-card-title'>Load Error</h2>
          <div className='rf-card-body'>
            <p className='inline-error'>{loadError}</p>
            <div style={{ marginTop: '0.75rem' }}>
              <button type='button' className='btn-primary' onClick={hydrateProfile}>Retry</button>
            </div>
          </div>
        </article>
      </div>
    );
  }

  const emptyState = isProfileEmpty(profile);

  return (
    <div className='page-shell'>
      <section className='page-header'>
        <div>
          <div className='page-eyebrow'>Veteran</div>
          <h1 className='page-title'>Profile</h1>
          <p className='page-copy'>Profile {profileCompletion}% complete</p>
        </div>
        {hasUnsavedChanges && <div className='page-badge'>Unsaved changes</div>}
      </section>

      {emptyState && (
        <article className='rf-card'>
          <p className='rf-card-body'>No profile data yet. Click <strong>Edit</strong> on a section to get started.</p>
        </article>
      )}

      <ProfileSectionCard
        title='Personal Information'
        description='Identity fields used across the claims workflow.'
        machineState={sectionMachine.personal}
        summaryItems={[
          { label: 'Name', value: [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ') },
          { label: 'DOB', value: profile.dateOfBirth },
          { label: 'SSN Last 4', value: profile.ssnLast4 ? `***-${profile.ssnLast4}` : '' },
        ]}
        isEditing={sectionMachine.personal === SECTION_MACHINE_STATE.EDITING || sectionMachine.personal === SECTION_MACHINE_STATE.DIRTY || sectionMachine.personal === SECTION_MACHINE_STATE.ERROR}
        isDirty={dirtyMap.personal}
        isSaving={saving.personal}
        statusMessage={sectionStatus.personal}
        errorMessage={sectionErrors.personal}
        onStartEdit={() => startEditingSection('personal')}
        onFieldChange={(field, value) => setSectionField('personal', field, value)}
        onCancel={() => cancelEditingSection('personal')}
        onSave={() => saveSection('personal')}
      >
        <div className='profile-grid'>
          {renderInput('personal', 'firstName', 'First Name', 'text', 'John')}
          {renderInput('personal', 'middleName', 'Middle Name', 'text', 'M.')}
          {renderInput('personal', 'lastName', 'Last Name', 'text', 'Doe')}
          {renderInput('personal', 'dateOfBirth', 'Date of Birth', 'date')}
          {renderInput('personal', 'ssnLast4', 'Last 4 of SSN', 'text', 'XXXX')}
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard
        title='Contact Information'
        description='Used for follow-up and state-specific benefits.'
        machineState={sectionMachine.contact}
        summaryItems={[
          { label: 'Email', value: profile.email },
          { label: 'Phone', value: profile.phone },
          { label: 'Location', value: [profile.city, profile.state].filter(Boolean).join(', ') },
          { label: 'Preferred Contact', value: formatPreferredContact(profile.preferredContactMethod) },
        ]}
        isEditing={sectionMachine.contact === SECTION_MACHINE_STATE.EDITING || sectionMachine.contact === SECTION_MACHINE_STATE.DIRTY || sectionMachine.contact === SECTION_MACHINE_STATE.ERROR}
        isDirty={dirtyMap.contact}
        isSaving={saving.contact}
        statusMessage={sectionStatus.contact}
        errorMessage={sectionErrors.contact}
        onStartEdit={() => startEditingSection('contact')}
        onFieldChange={(field, value) => setSectionField('contact', field, value)}
        onCancel={() => cancelEditingSection('contact')}
        onSave={() => saveSection('contact')}
      >
        <div className='profile-grid'>
          {renderInput('contact', 'email', 'Email', 'email', 'you@example.com')}
          {renderInput('contact', 'phone', 'Phone', 'tel', '(555) 000-0000')}
          {renderInput('contact', 'city', 'City', 'text', 'City')}
          <div className='profile-field'>
            <label className='profile-label' htmlFor='contact-state'>State</label>
            <select
              id='contact-state'
              value={drafts?.contact?.state ?? ''}
              onChange={(event) => setSectionField('contact', 'state', event.target.value)}
              onBlur={(event) => setFieldValidationError('contact', 'state', validateField('state', event.target.value))}
              className='str-input'
              disabled={sectionMachine.contact === SECTION_MACHINE_STATE.IDLE || sectionMachine.contact === SECTION_MACHINE_STATE.SAVING}
              aria-disabled={sectionMachine.contact === SECTION_MACHINE_STATE.IDLE || sectionMachine.contact === SECTION_MACHINE_STATE.SAVING}
            >
              <option value=''>Select state...</option>
              {US_STATES.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
            {validationErrors?.contact?.state && <p className='profile-field-error'>{validationErrors.contact.state}</p>}
          </div>
          {renderSelect('contact', 'preferredContactMethod', 'Preferred Contact Method', PREFERRED_CONTACT_OPTIONS.map((option) => option.value), 'Select contact method...')}
        </div>
      </ProfileSectionCard>

      {hasUnsavedChanges && (
        <div className='profile-save-bar'>
          <button
            type='button'
            onClick={() => SECTION_KEYS.filter((key) => dirtyMap[key]).forEach((key) => saveSection(key))}
            className='btn-primary'
            aria-label='Save all profile changes'
          >
            Save All
          </button>
          <span className='profile-save-hint'>Unsaved changes</span>
        </div>
      )}
    </div>
  );
}
