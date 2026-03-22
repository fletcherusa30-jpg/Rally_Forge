import React, { useState } from 'react';
import { placeholders } from '../system/placeholders/index.js';

/**
 * Service Treatment Records (STR) Manual Entry Form
 * PURPOSE: Collect ONLY medical/chronological data required for:
 * - In-service medical events documentation
 * - Exposure history and MOS relevance
 * - Chronicity and continuity of symptoms
 * - Nexus to service
 * 
 * STRICTLY SEPARATED from VA Rating Decision entry
 */
export function STRManualEntry({ onSave, initialEntry = null }) {
  const emitTelemetry = (event, details = {}) => {
    console.info('[STRManualEntry]', {
      event,
      timestamp: new Date().toISOString(),
      ...details,
    });
  };

  const normalizeText = (value) => String(value || '').trim();
  const normalizeDate = (value) => {
    const text = normalizeText(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
  };

  const canonicalEntryKey = (entry) => [
    normalizeText(entry?.conditionName).toLowerCase(),
    normalizeDate(entry?.dateOfEvent),
    normalizeText(entry?.type).toLowerCase(),
  ].join('|');

  const buildDefaultEntry = (overrides = null) => {
    const defaults = {
      // Event Details
      conditionName: '',
      dateOfEvent: '',
      type: 'illness',
      location: '',

      // Medical Documentation
      provider: '',
      description: '',
      severity: 'moderate',

      // Service Context
      lineOfDuty: 'Yes',
      MOSRelevant: false,

      // Exposure & Context
      exposureType: null,
      inServiceEvent: true,

      // Chronicity & Continuity
      chronicityEvidence: '',
      continuityNotes: '',
      nexusIndicators: ''
    };

    if (!overrides) {
      return defaults;
    }

    return {
      ...defaults,
      ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined && value !== null && value !== '')),
    };
  };

  const [entries, setEntries] = useState([]);
  const [newEntry, setNewEntry] = useState(() => buildDefaultEntry(initialEntry));

  const [errors, setErrors] = useState({});

  const normalizeEntry = (entry) => ({
    conditionName: normalizeText(entry?.conditionName),
    dateOfEvent: normalizeDate(entry?.dateOfEvent),
    type: normalizeText(entry?.type) || 'illness',
    location: normalizeText(entry?.location) || null,
    provider: normalizeText(entry?.provider) || null,
    description: normalizeText(entry?.description),
    severity: normalizeText(entry?.severity) || 'moderate',
    lineOfDuty: normalizeText(entry?.lineOfDuty) || 'Yes',
    MOSRelevant: entry?.exposureType ? Boolean(entry?.MOSRelevant) : null,
    exposureType: normalizeText(entry?.exposureType) || null,
    inServiceEvent: Boolean(entry?.inServiceEvent),
    chronicityEvidence: normalizeText(entry?.chronicityEvidence) || null,
    continuityNotes: normalizeText(entry?.chronicityEvidence) ? normalizeText(entry?.continuityNotes) || null : null,
    nexusIndicators: normalizeText(entry?.nexusIndicators) || null,
    manualEntry: true,
    entryType: 'SERVICE_TREATMENT_RECORD'
  });

  // Validation
  const validateEntry = (entry) => {
    const newErrors = {};
    const conditionName = String(entry?.conditionName || '').trim();
    const dateOfEvent = String(entry?.dateOfEvent || '').trim();
    const description = String(entry?.description || '').trim();
    const chronicityEvidence = String(entry?.chronicityEvidence || '').trim();
    const continuityNotes = String(entry?.continuityNotes || '').trim();
    
    if (!conditionName) {
      newErrors.conditionName = 'Condition name is required';
    }
    
    if (!dateOfEvent) {
      newErrors.dateOfEvent = 'Date of event is required';
    }
    
    if (!description) {
      newErrors.description = 'Description is required';
    }
    
    if (entry.exposureType && !entry.MOSRelevant) {
      newErrors.MOSRelevant = 'MOS relevance must be evaluated when exposure type is selected';
    }
    
    if (chronicityEvidence && !continuityNotes) {
      newErrors.continuityNotes = 'Continuity notes required when chronicality evidence is provided';
    }
    
    return newErrors;
  };

  const addEntry = () => {
    const newErrors = validateEntry(newEntry);
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const entry = normalizeEntry(newEntry);
    const existingIndex = entries.findIndex((item) => canonicalEntryKey(item) === canonicalEntryKey(entry));

    setEntries([...entries, {
      ...entry,
      duplicateOf: existingIndex >= 0 ? existingIndex : null,
    }]);
    emitTelemetry('entry_added', {
      duplicate: existingIndex >= 0,
      conditionName: entry.conditionName,
    });
    setErrors({});
    
    // Reset form
    setNewEntry(buildDefaultEntry({
      ...initialEntry,
      type: newEntry.type,
      location: newEntry.location,
      provider: newEntry.provider,
      severity: newEntry.severity,
      lineOfDuty: newEntry.lineOfDuty,
      MOSRelevant: newEntry.MOSRelevant,
      exposureType: newEntry.exposureType,
      inServiceEvent: newEntry.inServiceEvent,
    }));
  };

  const removeEntry = (index) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const normalizedEntries = entries.map(normalizeEntry);
    const invalidEntry = normalizedEntries.find((entry) => Object.keys(validateEntry(entry)).length > 0);
    if (invalidEntry) {
      setErrors(validateEntry(invalidEntry));
      emitTelemetry('save_blocked_validation', { conditionName: invalidEntry.conditionName });
      return;
    }

    const result = {
      success: true,
      records: normalizedEntries.map(e => ({
        condition: e.conditionName,
        date: e.dateOfEvent,
        description: e.description
      })),
      allRecords: normalizedEntries,
      fileName: 'Service Treatment Records Manual Entry',
      metadata: {
        veteranName: null,
        serviceNumber: null,
        serviceComponent: null,
        serviceEra: null
      },
      patientHistory: {
        totalMedicalEvents: normalizedEntries.length,
        inServiceCount: normalizedEntries.filter(e => e.inServiceEvent).length,
        exposureEvents: normalizedEntries.filter(e => e.exposureType).length,
        chronicConditions: normalizedEntries.filter(e => e.chronicityEvidence).length
      },
      exposureSummary: {
        exposureTypes: [...new Set(normalizedEntries.filter(e => e.exposureType).map(e => e.exposureType))],
        MOSRelevantCount: normalizedEntries.filter(e => e.MOSRelevant === true).length
      },
      extractionSummary: {
        totalRecords: normalizedEntries.length,
        manualEntry: true,
        entryType: 'SERVICE_TREATMENT_RECORD'
      }
    };

    emitTelemetry('entries_saved', { totalRecords: normalizedEntries.length });
    
    if (onSave) {
      onSave(result);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.5rem',
    fontSize: '0.875rem',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '0.375rem',
    color: '#cbd5e1'
  };

  const errorInputStyle = {
    ...inputStyle,
    borderColor: '#ef4444'
  };

  const buttonStyle = {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    borderRadius: '0.375rem',
    backgroundColor: '#14b8a6',
    color: '#0f172a',
    fontWeight: '500',
    border: 'none',
    cursor: 'pointer'
  };

  const labelStyle = {
    fontSize: '0.75rem',
    color: '#94a3b8',
    display: 'block',
    marginBottom: '0.25rem'
  };

  const sectionStyle = {
    marginBottom: '1rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid #334155'
  };

  const sectionTitleStyle = {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: '0.75rem'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Entry Form */}
      <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '1rem' }}>
          📝 Service Treatment Records Entry
        </h3>
        
        {/* Section A: Event Details */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>A. Event Details</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Condition Name *</label>
              <input
                type="text"
                value={newEntry.conditionName}
                onChange={(e) => setNewEntry({ ...newEntry, conditionName: e.target.value })}
                placeholder={placeholders.str.conditionName}
                style={errors.conditionName ? errorInputStyle : inputStyle}
              />
              {errors.conditionName && <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>{errors.conditionName}</span>}
            </div>
            
            <div>
              <label style={labelStyle}>Date of Event *</label>
              <input
                type="date"
                value={newEntry.dateOfEvent}
                onChange={(e) => setNewEntry({ ...newEntry, dateOfEvent: e.target.value })}
                style={errors.dateOfEvent ? errorInputStyle : inputStyle}
              />
              {errors.dateOfEvent && <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>{errors.dateOfEvent}</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Event Type *</label>
              <select
                value={newEntry.type}
                onChange={(e) => setNewEntry({ ...newEntry, type: e.target.value })}
                style={inputStyle}
              >
                <option value="injury">Injury</option>
                <option value="illness">Illness</option>
                <option value="exposure">Exposure</option>
                <option value="symptom">Symptom Onset</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Location (optional)</label>
              <input
                type="text"
                value={newEntry.location}
                onChange={(e) => setNewEntry({ ...newEntry, location: e.target.value })}
                placeholder={placeholders.str.location}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Severity (optional)</label>
              <select
                value={newEntry.severity}
                onChange={(e) => setNewEntry({ ...newEntry, severity: e.target.value })}
                style={inputStyle}
              >
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section B: Medical Documentation */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>B. Medical Documentation</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Provider Name (optional)</label>
              <input
                type="text"
                value={newEntry.provider}
                onChange={(e) => setNewEntry({ ...newEntry, provider: e.target.value })}
                placeholder={placeholders.str.providerName}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={labelStyle}>Description of Event/Treatment *</label>
            <textarea
              value={newEntry.description}
              onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
              placeholder={placeholders.str.description}
              style={errors.description ? { ...inputStyle, minHeight: '80px', borderColor: '#ef4444' } : { ...inputStyle, minHeight: '80px' }}
            />
            {errors.description && <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>{errors.description}</span>}
          </div>
        </div>

        {/* Section C: Exposure & MOS Relevance */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>C. Exposure & Service Context</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Line of Duty *</label>
              <select
                value={newEntry.lineOfDuty}
                onChange={(e) => setNewEntry({ ...newEntry, lineOfDuty: e.target.value })}
                style={inputStyle}
              >
                <option value="Yes">Yes (In-Service)</option>
                <option value="No">No (Not In-Service)</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Exposure Type (optional)</label>
              <select
                value={newEntry.exposureType || ''}
                onChange={(e) => setNewEntry({ ...newEntry, exposureType: e.target.value || null })}
                style={inputStyle}
              >
                <option value="">None/Unknown</option>
                <option value="agent orange">Agent Orange</option>
                <option value="burn pits">Burn Pits</option>
                <option value="radiation">Radiation</option>
                <option value="asbestos">Asbestos</option>
                <option value="noise">Noise</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>
                <input
                  type="checkbox"
                  checked={newEntry.inServiceEvent}
                  onChange={(e) => setNewEntry({ ...newEntry, inServiceEvent: e.target.checked })}
                />
                {' '} Confirmed In-Service Event
              </label>
            </div>
          </div>

          {newEntry.exposureType && (
            <div>
              <label style={labelStyle}>
                <input
                  type="checkbox"
                  checked={newEntry.MOSRelevant}
                  onChange={(e) => setNewEntry({ ...newEntry, MOSRelevant: e.target.checked })}
                />
                {' '} MOS Relevant to Exposure
              </label>
              {errors.MOSRelevant && <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>{errors.MOSRelevant}</span>}
            </div>
          )}
        </div>

        {/* Section D: Chronicity & Continuity */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>D. Chronicity & Continuity</h4>
          
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={labelStyle}>Chronicity Evidence (optional)</label>
            <textarea
              value={newEntry.chronicityEvidence}
              onChange={(e) => setNewEntry({ ...newEntry, chronicityEvidence: e.target.value })}
              placeholder={placeholders.str.chronicityEvidence}
              style={{ ...inputStyle, minHeight: '60px' }}
            />
          </div>

          {newEntry.chronicityEvidence.trim() && (
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Continuity Notes *</label>
              <textarea
                value={newEntry.continuityNotes}
                onChange={(e) => setNewEntry({ ...newEntry, continuityNotes: e.target.value })}
                placeholder={placeholders.str.continuityNotes}
                style={errors.continuityNotes ? { ...inputStyle, minHeight: '60px', borderColor: '#ef4444' } : { ...inputStyle, minHeight: '60px' }}
              />
              {errors.continuityNotes && <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>{errors.continuityNotes}</span>}
            </div>
          )}

          <div>
            <label style={labelStyle}>Nexus Indicators (optional)</label>
            <textarea
              value={newEntry.nexusIndicators}
              onChange={(e) => setNewEntry({ ...newEntry, nexusIndicators: e.target.value })}
              placeholder={placeholders.str.nexusIndicators}
              style={{ ...inputStyle, minHeight: '60px' }}
            />
          </div>
        </div>

        <button onClick={addEntry} style={buttonStyle}>
          Add Record
        </button>
      </div>

      {/* Records List */}
      {entries.length > 0 && (
        <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.75rem' }}>
            Medical Records ({entries.length})
          </h3>
          {entries.map((entry, idx) => (
            <div key={idx} style={{ backgroundColor: '#0f172a', padding: '0.75rem', marginBottom: '0.5rem', borderRadius: '0.375rem', borderLeft: `3px solid ${entry.lineOfDuty === 'Yes' ? '#34d399' : '#f87171'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                <div>
                  <strong style={{ color: '#cbd5e1' }}>{entry.conditionName}</strong>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                    {entry.dateOfEvent}
                  </span>
                  {entry.exposureType && (
                    <span style={{ fontSize: '0.75rem', color: '#fbbf24', marginLeft: '0.5rem' }}>
                      🔬 {entry.exposureType}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeEntry(idx)}
                  style={{
                    ...buttonStyle,
                    backgroundColor: '#ef4444',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem'
                  }}
                >
                  Remove
                </button>
              </div>
              <div style={{ fontSize: '0.775rem', color: '#cbd5e1' }}>
                <span style={{ color: '#94a3b8' }}>Type:</span> {entry.type} | <span style={{ color: '#94a3b8' }}>Severity:</span> {entry.severity}
              </div>
              <div style={{ fontSize: '0.775rem', color: '#cbd5e1' }}>
                <span style={{ color: '#94a3b8' }}>Line of Duty:</span> {entry.lineOfDuty}
              </div>
              {entry.provider && (
                <div style={{ fontSize: '0.775rem', color: '#cbd5e1' }}>
                  <span style={{ color: '#94a3b8' }}>Provider:</span> {entry.provider}
                </div>
              )}
              {entry.chronicityEvidence && (
                <div style={{ fontSize: '0.775rem', color: '#cbd5e1' }}>
                  <span style={{ color: '#94a3b8' }}>📋 Chronic condition documented</span>
                </div>
              )}
            </div>
          ))}

          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>In-Service Events</label>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#34d399' }}>
                  {entries.filter(e => e.lineOfDuty === 'Yes').length}
                </p>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Exposures Documented</label>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b' }}>
                  {entries.filter(e => e.exposureType).length}
                </p>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Chronic Conditions</label>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#60a5fa' }}>
                  {entries.filter(e => e.chronicityEvidence).length}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            style={{
              ...buttonStyle,
              marginTop: '1rem',
              width: '100%',
              backgroundColor: '#06b6d4'
            }}
          >
            Save & Process Records
          </button>
        </div>
      )}
    </div>
  );
}
