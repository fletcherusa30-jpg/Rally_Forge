import React, { useState } from 'react';

/**
 * VA Rating Decision Manual Entry Form
 * PURPOSE: Collect ONLY adjudicative data required for:
 * - Service-connection determination
 * - Rating calculations
 * - SMC logic and bilateral factors
 * 
 * STRICTLY SEPARATED from STR (Service Treatment Records) entry
 */
export function VARatingDecisionManualEntry({ onSave }) {
  const [entries, setEntries] = useState([]);
  const [newEntry, setNewEntry] = useState({
    // Condition Identification
    conditionName: '',
    diagnosticType: 'disability',
    pageNumber: '',
    
    // Rating & Effective Date
    status: 'Service Connected',
    ratingPercent: '',
    effectiveDate: '',
    
    // Adjudicative Factors
    isBilateral: false,
    extremity: null,
    secondaryTo: '',
    aggravationPercent: '',
    inferredIssue: false,
    
    // Service Connection Basis
    scBasis: 'direct',
    scEvidence: '',
    denialReason: '',
    
    // Evidence & Rationale
    evidenceNotes: '',
    rationaleSummary: ''
  });

  const [errors, setErrors] = useState({});

  // Validation
  const validateEntry = (entry) => {
    const newErrors = {};
    
    if (!entry.conditionName.trim()) {
      newErrors.conditionName = 'Condition name is required';
    }
    
    if (entry.status === 'Service Connected' && !entry.ratingPercent) {
      newErrors.ratingPercent = 'Rating percent required for Service Connected conditions';
    }
    
    if (entry.status === 'Denied' && !entry.denialReason.trim()) {
      newErrors.denialReason = 'Denial reason required for Denied conditions';
    }
    
    if (entry.scBasis === 'secondary' && !entry.secondaryTo.trim()) {
      newErrors.secondaryTo = 'Primary condition required for secondary conditions';
    }
    
    if (entry.scBasis === 'aggravation' && !entry.aggravationPercent) {
      newErrors.aggravationPercent = 'Aggravation percent required for aggravation claims';
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
      diagnosticType: newEntry.diagnosticType,
      pageNumber: newEntry.pageNumber || null,
      status: newEntry.status,
      ratingPercent: newEntry.status === 'Service Connected' ? parseInt(newEntry.ratingPercent) || null : null,
      effectiveDate: newEntry.effectiveDate || null,
      isBilateral: newEntry.isBilateral,
      extremity: newEntry.isBilateral ? newEntry.extremity : null,
      scBasis: newEntry.scBasis,
      secondaryTo: newEntry.scBasis === 'secondary' ? newEntry.secondaryTo.trim() : null,
      aggravationPercent: newEntry.scBasis === 'aggravation' ? parseInt(newEntry.aggravationPercent) || null : null,
      inferredIssue: newEntry.inferredIssue,
      scEvidence: newEntry.scEvidence.trim() || null,
      rationaleSummary: newEntry.rationaleSummary.trim() || null,
      denialReason: newEntry.status === 'Denied' ? newEntry.denialReason.trim() : null,
      evidenceNotes: newEntry.evidenceNotes.trim() || null,
      manualEntry: true,
      type: 'VA_RATING_DECISION'
    };

    setEntries([...entries, entry]);
    setErrors({});
    
    // Reset form
    setNewEntry({
      conditionName: '',
      diagnosticType: 'disability',
      pageNumber: '',
      status: 'Service Connected',
      ratingPercent: '',
      effectiveDate: '',
      isBilateral: false,
      extremity: null,
      secondaryTo: '',
      aggravationPercent: '',
      inferredIssue: false,
      scBasis: 'direct',
      scEvidence: '',
      denialReason: '',
      evidenceNotes: '',
      rationaleSummary: ''
    });
  };

  const removeEntry = (index) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const calculateCombined = () => {
    const ratings = entries
      .filter(c => c.status === 'Service Connected' && c.ratingPercent > 0)
      .map(c => c.ratingPercent)
      .sort((a, b) => b - a);
    
    if (ratings.length === 0) return 0;
    if (ratings.length === 1) return ratings[0];
    
    let combined = ratings[0];
    for (let i = 1; i < ratings.length; i++) {
      combined = Math.round(combined + ((100 - combined) * ratings[i]) / 100);
    }
    
    return combined;
  };

  const handleSave = () => {
    const serviceConnected = entries.filter(c => c.status === 'Service Connected');
    const denied = entries.filter(c => c.status === 'Denied');
    
    const result = {
      success: true,
      serviceConnected: serviceConnected.map(c => ({
        condition: c.conditionName,
        percentage: c.ratingPercent
      })),
      denied: denied.map(c => ({
        condition: c.conditionName
      })),
      allConditions: entries,
      fileName: 'VA Rating Decision Manual Entry',
      metadata: {
        veteranName: null,
        fileNumber: null,
        ratingDecisionDate: null,
        effectiveDate: null
      },
      ratingCalculation: {
        calculatedCombinedRating: calculateCombined(),
        conditions: serviceConnected.map(c => c.ratingPercent),
        hasBilateralPairs: entries.some(e => e.isBilateral),
        calculationMethod: 'Manual entry (38 CFR §4.25)'
      },
      extractionSummary: {
        totalServiceConnected: serviceConnected.length,
        totalDenied: denied.length,
        manualEntry: true,
        entryType: 'VA_RATING_DECISION'
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
          📋 VA Rating Decision Entry
        </h3>
        
        {/* Section A: Condition Identification */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>A. Condition Identification</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Condition Name *</label>
              <input
                type="text"
                value={newEntry.conditionName}
                onChange={(e) => setNewEntry({ ...newEntry, conditionName: e.target.value })}
                placeholder="e.g., Tinnitus, PTSD, Left knee"
                style={errors.conditionName ? errorInputStyle : inputStyle}
              />
              {errors.conditionName && <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>{errors.conditionName}</span>}
            </div>
            
            <div>
              <label style={labelStyle}>Diagnostic Type *</label>
              <select
                value={newEntry.diagnosticType}
                onChange={(e) => setNewEntry({ ...newEntry, diagnosticType: e.target.value })}
                style={inputStyle}
              >
                <option value="disability">Disability</option>
                <option value="injury">Injury</option>
                <option value="symptom">Symptom</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Page Number (optional)</label>
            <input
              type="text"
              value={newEntry.pageNumber}
              onChange={(e) => setNewEntry({ ...newEntry, pageNumber: e.target.value })}
              placeholder="e.g., 12"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Section B: Rating & Effective Date */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>B. Rating & Effective Date</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Status *</label>
              <select
                value={newEntry.status}
                onChange={(e) => {
                  setNewEntry({ ...newEntry, status: e.target.value });
                  setErrors({ ...errors, denialReason: null });
                }}
                style={inputStyle}
              >
                <option value="Service Connected">Service Connected</option>
                <option value="Not Service Connected">Not Service Connected</option>
                <option value="Denied">Denied</option>
                <option value="Deferred">Deferred</option>
              </select>
            </div>
            
            {newEntry.status === 'Service Connected' && (
              <div>
                <label style={labelStyle}>Rating % *</label>
                <select
                  value={newEntry.ratingPercent}
                  onChange={(e) => setNewEntry({ ...newEntry, ratingPercent: e.target.value })}
                  style={errors.ratingPercent ? errorInputStyle : inputStyle}
                >
                  <option value="">Select...</option>
                  {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => (
                    <option key={p} value={p}>{p}%</option>
                  ))}
                </select>
                {errors.ratingPercent && <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>{errors.ratingPercent}</span>}
              </div>
            )}

            <div>
              <label style={labelStyle}>Effective Date (optional)</label>
              <input
                type="date"
                value={newEntry.effectiveDate}
                onChange={(e) => setNewEntry({ ...newEntry, effectiveDate: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>

          {newEntry.status === 'Denied' && (
            <div>
              <label style={labelStyle}>Denial Reason *</label>
              <textarea
                value={newEntry.denialReason}
                onChange={(e) => setNewEntry({ ...newEntry, denialReason: e.target.value })}
                placeholder="Explain why this condition was denied"
                style={{ ...inputStyle, minHeight: '60px' }}
              />
              {errors.denialReason && <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>{errors.denialReason}</span>}
            </div>
          )}
        </div>

        {/* Section C: Service-Connection Basis */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>C. Service-Connection Basis</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={labelStyle}>SC Basis *</label>
              <select
                value={newEntry.scBasis}
                onChange={(e) => setNewEntry({ ...newEntry, scBasis: e.target.value })}
                style={inputStyle}
              >
                <option value="direct">Direct</option>
                <option value="secondary">Secondary</option>
                <option value="aggravation">Aggravation</option>
                <option value="presumptive">Presumptive</option>
                <option value="1151">38 USC §1151</option>
              </select>
            </div>

            {newEntry.scBasis === 'secondary' && (
              <div>
                <label style={labelStyle}>Primary Condition *</label>
                <input
                  type="text"
                  value={newEntry.secondaryTo}
                  onChange={(e) => setNewEntry({ ...newEntry, secondaryTo: e.target.value })}
                  placeholder="e.g., Agent Orange exposure"
                  style={errors.secondaryTo ? errorInputStyle : inputStyle}
                />
                {errors.secondaryTo && <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>{errors.secondaryTo}</span>}
              </div>
            )}

            {newEntry.scBasis === 'aggravation' && (
              <div>
                <label style={labelStyle}>Aggravation % *</label>
                <select
                  value={newEntry.aggravationPercent}
                  onChange={(e) => setNewEntry({ ...newEntry, aggravationPercent: e.target.value })}
                  style={errors.aggravationPercent ? errorInputStyle : inputStyle}
                >
                  <option value="">Select...</option>
                  {[10, 20, 30, 40, 50].map(p => (
                    <option key={p} value={p}>{p}%</option>
                  ))}
                </select>
                {errors.aggravationPercent && <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>{errors.aggravationPercent}</span>}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>
                <input
                  type="checkbox"
                  checked={newEntry.isBilateral}
                  onChange={(e) => setNewEntry({ ...newEntry, isBilateral: e.target.checked })}
                />
                {' '} Is Bilateral/Paired Extremity
              </label>
            </div>

            {newEntry.isBilateral && (
              <div>
                <label style={labelStyle}>Extremity *</label>
                <select
                  value={newEntry.extremity || ''}
                  onChange={(e) => setNewEntry({ ...newEntry, extremity: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">Select...</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="both">Both</option>
                </select>
              </div>
            )}

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>
                <input
                  type="checkbox"
                  checked={newEntry.inferredIssue}
                  onChange={(e) => setNewEntry({ ...newEntry, inferredIssue: e.target.checked })}
                />
                {' '} Inferred Issue (from scanner)
              </label>
            </div>
          </div>
        </div>

        {/* Section D: Evidence & Rationale */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>D. Evidence & Rationale</h4>
          
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={labelStyle}>Evidence Notes (optional)</label>
            <textarea
              value={newEntry.evidenceNotes}
              onChange={(e) => setNewEntry({ ...newEntry, evidenceNotes: e.target.value })}
              placeholder="Cite specific evidence, test results, or medical findings"
              style={{ ...inputStyle, minHeight: '60px' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Rationale Summary (optional)</label>
            <textarea
              value={newEntry.rationaleSummary}
              onChange={(e) => setNewEntry({ ...newEntry, rationaleSummary: e.target.value })}
              placeholder="Explain the adjudicative rationale"
              style={{ ...inputStyle, minHeight: '60px' }}
            />
          </div>

          <div>
            <label style={labelStyle}>SC Evidence Details (optional)</label>
            <textarea
              value={newEntry.scEvidence}
              onChange={(e) => setNewEntry({ ...newEntry, scEvidence: e.target.value })}
              placeholder="Evidence supporting service-connection"
              style={{ ...inputStyle, minHeight: '60px' }}
            />
          </div>
        </div>

        <button onClick={addEntry} style={buttonStyle}>
          Add Entry
        </button>
      </div>

      {/* Entries List */}
      {entries.length > 0 && (
        <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.75rem' }}>
            Entries ({entries.length})
          </h3>
          {entries.map((entry, idx) => (
            <div key={idx} style={{ backgroundColor: '#0f172a', padding: '0.75rem', marginBottom: '0.5rem', borderRadius: '0.375rem', borderLeft: `3px solid ${entry.status === 'Service Connected' ? '#34d399' : '#ef4444'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                <div>
                  <strong style={{ color: '#cbd5e1' }}>{entry.conditionName}</strong>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                    ({entry.diagnosticType})
                  </span>
                  {entry.ratingPercent && (
                    <span style={{ fontSize: '0.9rem', color: '#34d399', marginLeft: '0.5rem' }}>
                      {entry.ratingPercent}%
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
                <span style={{ color: '#94a3b8' }}>Status:</span> {entry.status}
              </div>
              {entry.scBasis && (
                <div style={{ fontSize: '0.775rem', color: '#cbd5e1' }}>
                  <span style={{ color: '#94a3b8' }}>SC Basis:</span> {entry.scBasis}
                </div>
              )}
              {entry.secondaryTo && (
                <div style={{ fontSize: '0.775rem', color: '#cbd5e1' }}>
                  <span style={{ color: '#94a3b8' }}>Secondary to:</span> {entry.secondaryTo}
                </div>
              )}
              {entry.isBilateral && (
                <div style={{ fontSize: '0.775rem', color: '#cbd5e1' }}>
                  <span style={{ color: '#94a3b8' }}>Bilateral ({entry.extremity})</span>
                </div>
              )}
            </div>
          ))}

          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Service Connected</label>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#34d399' }}>
                  {entries.filter(e => e.status === 'Service Connected').length}
                </p>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Combined Rating</label>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#14b8a6' }}>
                  {calculateCombined()}%
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
            Save & Process Entries
          </button>
        </div>
      )}
    </div>
  );
}
