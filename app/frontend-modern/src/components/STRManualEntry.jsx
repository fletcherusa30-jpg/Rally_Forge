import React, { useState } from 'react';

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
export function STRManualEntry({ onSave }) {
  const [entries, setEntries] = useState([]);
  const [newEntry, setNewEntry] = useState({
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
  });

  const [errors, setErrors] = useState({});

  // Validation
  const validateEntry = (entry) => {
    const newErrors = {};
    
    if (!entry.conditionName.trim()) {
      newErrors.conditionName = 'Condition name is required';
    }
    
    if (!entry.dateOfEvent) {
      newErrors.dateOfEvent = 'Date of event is required';
    }
    
    if (!entry.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (entry.exposureType && !entry.MOSRelevant) {
      newErrors.MOSRelevant = 'MOS relevance must be evaluated when exposure type is selected';
    }
    
    if (entry.chronicityEvidence.trim() && !entry.continuityNotes.trim()) {
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

    const entry = {
      conditionName: newEntry.conditionName.trim(),
      dateOfEvent: newEntry.dateOfEvent,
      type: newEntry.type,
      location: newEntry.location.trim() || null,
      provider: newEntry.provider.trim() || null,
      description: newEntry.description.trim(),
      severity: newEntry.severity,
      lineOfDuty: newEntry.lineOfDuty,
      MOSRelevant: newEntry.exposureType ? newEntry.MOSRelevant : null,
      exposureType: newEntry.exposureType || null,
      inServiceEvent: newEntry.inServiceEvent,
      chronicityEvidence: newEntry.chronicityEvidence.trim() || null,
      continuityNotes: newEntry.chronicityEvidence.trim() ? newEntry.continuityNotes.trim() : null,
      nexusIndicators: newEntry.nexusIndicators.trim() || null,
      manualEntry: true,
      type: 'SERVICE_TREATMENT_RECORD'
    };

    setEntries([...entries, entry]);
    setErrors({});
    
    // Reset form
    setNewEntry({
      conditionName: '',
      dateOfEvent: '',
      type: 'illness',
      location: '',
      provider: '',
      description: '',
      severity: 'moderate',
      lineOfDuty: 'Yes',
      MOSRelevant: false,
      exposureType: null,
      inServiceEvent: true,
      chronicityEvidence: '',
      continuityNotes: '',
      nexusIndicators: ''
    });
  };

  const removeEntry = (index) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const result = {
      success: true,
      records: entries.map(e => ({
        condition: e.conditionName,
        date: e.dateOfEvent,
        description: e.description
      })),
      allRecords: entries,
      fileName: 'Service Treatment Records Manual Entry',
      metadata: {
        veteranName: null,
        serviceNumber: null,
        serviceComponent: null,
        serviceEra: null
      },
      patientHistory: {
        totalMedicalEvents: entries.length,
        inServiceCount: entries.filter(e => e.inServiceEvent).length,
        exposureEvents: entries.filter(e => e.exposureType).length,
        chronicConditions: entries.filter(e => e.chronicityEvidence).length
      },
      exposureSummary: {
        exposureTypes: [...new Set(entries.filter(e => e.exposureType).map(e => e.exposureType))],
        MOSRelevantCount: entries.filter(e => e.MOSRelevant === true).length
      },
      extractionSummary: {
        totalRecords: entries.length,
        manualEntry: true,
        entryType: 'SERVICE_TREATMENT_RECORD'
      }
    };
    
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
                placeholder="e.g., Knee injury, Dermatitis, Respiratory symptoms"
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
                placeholder="e.g., Camp Lejeune, Kuwait"
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
                placeholder="e.g., Dr. Smith, VA Hospital"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={labelStyle}>Description of Event/Treatment *</label>
            <textarea
              value={newEntry.description}
              onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
              placeholder="Detailed description of what happened, symptoms, or treatment provided"
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
              placeholder="Evidence of continuous or recurrent symptoms, hospitalizations, or ongoing treatment"
              style={{ ...inputStyle, minHeight: '60px' }}
            />
          </div>

          {newEntry.chronicityEvidence.trim() && (
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Continuity Notes *</label>
              <textarea
                value={newEntry.continuityNotes}
                onChange={(e) => setNewEntry({ ...newEntry, continuityNotes: e.target.value })}
                placeholder="How symptoms have persisted or evolved over time"
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
              placeholder="Evidence establishing nexus between service and current condition"
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
