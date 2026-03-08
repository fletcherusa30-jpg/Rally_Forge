import React, { useState } from 'react';

export function ManualConditionEntry({ onSave }) {
  const [decisionDate, setDecisionDate] = useState('');
  const [conditions, setConditions] = useState([]);
  const [newCondition, setNewCondition] = useState({
    name: '',
    status: 'service-connected',
    percentage: '',
    effectiveDate: '',
    laterality: { left: false, right: false }
  });

  const addCondition = () => {
    if (!newCondition.name.trim()) {
      alert('Please enter a disability');
      return;
    }

    const condition = {
      condition: newCondition.name.trim(),
      percentage: newCondition.status === 'service-connected' ? parseInt(newCondition.percentage) || null : null,
      status: newCondition.status,
      effectiveDate: newCondition.effectiveDate || null,
      laterality: newCondition.laterality.left || newCondition.laterality.right ? newCondition.laterality : null,
      manualEntry: true
    };

    setConditions([...conditions, condition]);
    
    // Reset form
    setNewCondition({
      name: '',
      status: 'service-connected',
      percentage: '',
      effectiveDate: '',
      laterality: { left: false, right: false }
    });
  };

  const removeCondition = (index) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const calculateCombined = () => {
    const ratings = conditions
      .filter(c => c.status === 'service-connected' && c.percentage > 0)
      .map(c => c.percentage)
      .sort((a, b) => b - a);
    
    if (ratings.length === 0) return 0;
    if (ratings.length === 1) return Math.round(ratings[0] / 10) * 10;
    
    let combined = ratings[0];
    for (let i = 1; i < ratings.length; i++) {
      combined = Math.round(combined + ((100 - combined) * ratings[i]) / 100);
    }
    
    return Math.round(combined / 10) * 10;
  };

  const handleSave = () => {
    const serviceConnected = conditions.filter(c => c.status === 'service-connected');
    const denied = conditions.filter(c => c.status === 'denied');
    
    const result = {
      success: true,
      decisionDate: decisionDate || new Date().toISOString().split('T')[0], // Use today's date if not specified
      serviceConnected,
      denied,
      allConditions: conditions,
      ancillaryBenefits: [],
      fileName: 'Manual Entry',
      metadata: {
        veteranName: null,
        fileNumber: null,
        ratingDecisionDate: decisionDate || null,
        effectiveDate: null,
        allEffectiveDates: null,
        combinedRating: null
      },
      ratingCalculation: {
        calculatedCombinedRating: calculateCombined(),
        conditions: serviceConnected.map(c => c.percentage),
        hasBilateralPairs: false,
        calculationMethod: 'Manual entry (38 CFR §4.25)'
      },
      extractionSummary: {
        totalServiceConnected: serviceConnected.length,
        totalDenied: denied.length,
        manualEntry: true
      },
      evidence: []
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

  const serviceConnected = conditions.filter(c => c.status === 'service-connected');
  const denied = conditions.filter(c => c.status === 'denied');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Entry Form */}
      <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '1rem' }}>
          Add VA Disability
        </h3>

        {/* Decision Date */}
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
            Rating Decision Date (optional)
          </label>
          <input
            type="date"
            value={decisionDate}
            onChange={(e) => setDecisionDate(e.target.value)}
            style={inputStyle}
            placeholder="When was the decision made?"
          />
          {decisionDate && (
            <p style={{ fontSize: '0.7rem', color: '#10b981', marginTop: '0.25rem' }}>
              ✓ Decision: {new Date(decisionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          )}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
              Status *
            </label>
            <select
              value={newCondition.status}
              onChange={(e) => setNewCondition({ ...newCondition, status: e.target.value })}
              style={inputStyle}
            >
              <option value="service-connected">Service Connected</option>
              <option value="denied">Denied</option>
            </select>
          </div>
          
          {newCondition.status === 'service-connected' && (
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
                Rating % (optional)
              </label>
              <select
                value={newCondition.percentage}
                onChange={(e) => setNewCondition({ ...newCondition, percentage: e.target.value })}
                style={inputStyle}
              >
                <option value="">Select %</option>
                <option value="0">0%</option>
                <option value="10">10%</option>
                <option value="20">20%</option>
                <option value="30">30%</option>
                <option value="40">40%</option>
                <option value="50">50%</option>
                <option value="60">60%</option>
                <option value="70">70%</option>
                <option value="80">80%</option>
                <option value="90">90%</option>
                <option value="100">100%</option>
              </select>
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
              Effective Date (optional)
            </label>
            <input
              type="date"
              value={newCondition.effectiveDate}
              onChange={(e) => setNewCondition({ ...newCondition, effectiveDate: e.target.value })}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
            Disability *
          </label>
          <input
            type="text"
            value={newCondition.name}
            onChange={(e) => setNewCondition({ ...newCondition, name: e.target.value })}
            placeholder="e.g., Tinnitus, PTSD, Lower back pain"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }}>
            Laterality (for extremity disabilities)
          </label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={newCondition.laterality.left}
                onChange={(e) => setNewCondition({ 
                  ...newCondition, 
                  laterality: { ...newCondition.laterality, left: e.target.checked }
                })}
                style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
              />
              Left
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={newCondition.laterality.right}
                onChange={(e) => setNewCondition({ 
                  ...newCondition, 
                  laterality: { ...newCondition.laterality, right: e.target.checked }
                })}
                style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
              />
              Right
            </label>
          </div>
        </div>
        
        <button onClick={addCondition} style={buttonStyle}>
          + Add Condition
        </button>
      </div>

      {/* Current Conditions */}
      {conditions.length > 0 && (
        <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#cbd5e1' }}>
              Current Conditions ({conditions.length})
            </h3>
            {serviceConnected.length > 0 && (
              <div style={{ fontSize: '1rem', fontWeight: '700', color: '#14b8a6' }}>
                Combined: {calculateCombined()}%
              </div>
            )}
          </div>
          
          {/* Service Connected */}
          {serviceConnected.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: '600', color: '#34d399', marginBottom: '0.5rem' }}>
                ✓ Service Connected ({serviceConnected.length})
              </h4>
              {serviceConnected.map((c, i) => (
                <div
                  key={`sc-${i}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '0.375rem',
                    marginBottom: '0.375rem'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
                      {c.condition}
                      {c.percentage && <span style={{ color: '#94a3b8' }}> – {c.percentage}%</span>}
                      {c.laterality && (c.laterality.left || c.laterality.right) && (
                        <span style={{ marginLeft: '0.5rem' }}>
                          {c.laterality.left && (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              backgroundColor: '#1e40af', 
                              color: '#93c5fd', 
                              padding: '0.125rem 0.375rem', 
                              borderRadius: '0.25rem',
                              marginRight: '0.25rem'
                            }}>
                              Left
                            </span>
                          )}
                          {c.laterality.right && (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              backgroundColor: '#1e40af', 
                              color: '#93c5fd', 
                              padding: '0.125rem 0.375rem', 
                              borderRadius: '0.25rem'
                            }}>
                              Right
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    {c.effectiveDate && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Effective: {c.effectiveDate}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeCondition(conditions.indexOf(c))}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      backgroundColor: '#991b1b',
                      color: '#fca5a5',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer'
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Denied */}
          {denied.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.75rem', fontWeight: '600', color: '#f87171', marginBottom: '0.5rem' }}>
                ✗ Denied ({denied.length})
              </h4>
              {denied.map((c, i) => (
                <div
                  key={`denied-${i}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '0.375rem',
                    marginBottom: '0.375rem'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
                      {c.condition}
                      {c.laterality && (c.laterality.left || c.laterality.right) && (
                        <span style={{ marginLeft: '0.5rem' }}>
                          {c.laterality.left && (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              backgroundColor: '#1e40af', 
                              color: '#93c5fd', 
                              padding: '0.125rem 0.375rem', 
                              borderRadius: '0.25rem',
                              marginRight: '0.25rem'
                            }}>
                              Left
                            </span>
                          )}
                          {c.laterality.right && (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              backgroundColor: '#1e40af', 
                              color: '#93c5fd', 
                              padding: '0.125rem 0.375rem', 
                              borderRadius: '0.25rem'
                            }}>
                              Right
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    {c.effectiveDate && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Effective: {c.effectiveDate}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeCondition(conditions.indexOf(c))}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      backgroundColor: '#991b1b',
                      color: '#fca5a5',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer'
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <button
            onClick={handleSave}
            style={{
              ...buttonStyle,
              width: '100%',
              marginTop: '1rem',
              backgroundColor: '#0ea5e9'
            }}
          >
            Save & Use These Conditions
          </button>
        </div>
      )}
    </div>
  );
}
