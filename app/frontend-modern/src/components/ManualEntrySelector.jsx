import React, { useState } from 'react';
import { VARatingDecisionManualEntry } from './va/VARatingDecisionManualEntry';
import { STRManualEntry } from './STRManualEntry';

/**
 * Manual Entry Selector
 * PURPOSE: Route user to appropriate manual entry form
 * - VA Rating Decision Manual Entry: Adjudicative data only
 * - Service Treatment Records Manual Entry: Medical/chronological data only
 * 
 * CRITICAL: Maintains strict field separation between forms
 */
export function ManualEntrySelector({ onComplete }) {
  const [selectedForm, setSelectedForm] = useState(null);
  const [completedEntries, setCompletedEntries] = useState([]);

  const handleVAEntry = (result) => {
    setCompletedEntries([...completedEntries, { ...result, submittedAt: new Date().toISOString() }]);
    setSelectedForm(null); // Reset to selector
  };

  const handleSTREntry = (result) => {
    setCompletedEntries([...completedEntries, { ...result, submittedAt: new Date().toISOString() }]);
    setSelectedForm(null); // Reset to selector
  };

  const containerStyle = {
    backgroundColor: '#0f172a',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    minHeight: '600px'
  };

  const buttonStyle = {
    padding: '1rem',
    fontSize: '0.9rem',
    borderRadius: '0.375rem',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.2s',
    textAlign: 'left'
  };

  const vaButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    borderLeft: '4px solid #14b8a6',
    marginBottom: '0.75rem',
    width: '100%'
  };

  const strButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    borderLeft: '4px solid #06b6d4',
    marginBottom: '0.75rem',
    width: '100%'
  };

  const labelStyle = {
    fontSize: '0.75rem',
    color: '#94a3b8',
    display: 'block',
    marginBottom: '0.25rem'
  };

  const descriptionStyle = {
    fontSize: '0.85rem',
    color: '#cbd5e1',
    marginBottom: '0.5rem'
  };

  const subtleStyle = {
    fontSize: '0.75rem',
    color: '#64748b',
    marginTop: '0.5rem'
  };

  return (
    <div style={containerStyle}>
      {/* Selector View */}
      {selectedForm === null && (
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '1.5rem' }}>
            📋 Manual Data Entry
          </h2>

          <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Select the type of information you want to manually enter. Each form is designed for specific data:
          </p>

          {/* VA Rating Decision Card */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>ADJUDICATIVE DATA</label>
            <button
              onClick={() => setSelectedForm('va-rating')}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#334155';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#1e293b';
              }}
              style={vaButtonStyle}
            >
              <div style={descriptionStyle}>
                ⚖️ VA Rating Decision Manual Entry
              </div>
              <div style={subtleStyle}>
                Condition names • Disability percentages • Service-connection basis • Effective dates • Denial reasons • Evidence & Rationale
              </div>
            </button>
            <div style={{ fontSize: '0.85rem', color: '#475569', paddingLeft: '1rem', marginBottom: '0.5rem' }}>
              Use this form when manually entering VA rating decisions from physical documents or when the scanner didn't capture adjudicative details. This form focuses on WHAT VA decided and WHY.
            </div>
          </div>

          {/* Service Treatment Records Card */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>MEDICAL/CHRONOLOGICAL DATA</label>
            <button
              onClick={() => setSelectedForm('str')}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#334155';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#1e293b';
              }}
              style={strButtonStyle}
            >
              <div style={descriptionStyle}>
                📝 Service Treatment Records (STR) Manual Entry
              </div>
              <div style={subtleStyle}>
                Medical events • Dates • Exposures (burn pits, AO, etc.) • In-service status • Providers • Symptoms over time • Chronicity evidence
              </div>
            </button>
            <div style={{ fontSize: '0.85rem', color: '#475569', paddingLeft: '1rem', marginBottom: '0.5rem' }}>
              Use this form when manually entering medical events, exposure history, or treatment records. This form focuses on WHAT medical events occurred, WHEN, and WHERE.
            </div>
          </div>

          {/* Key Separation Warning */}
          <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.375rem', borderLeft: '4px solid #f59e0b', marginTop: '2rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#fbbf24', fontWeight: '600', marginBottom: '0.5rem' }}>
              ⚠️ Strict Data Separation
            </div>
            <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
              <p style={{ margin: '0.25rem 0' }}>
                • <strong>VA Rating Decision form:</strong> For adjudicative decisions only (ratings, denials, SC basis)
              </p>
              <p style={{ margin: '0.25rem 0' }}>
                • <strong>STR form:</strong> For medical events only (treatments, exposures, symptoms)
              </p>
              <p style={{ margin: '0.25rem 0' }}>
                • <strong>Never mix:</strong> Do not enter medical details in the VA form, and do not enter rating decisions in the STR form
              </p>
            </div>
          </div>

          {/* Completed Entries Summary */}
          {completedEntries.length > 0 && (
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #334155' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '1rem' }}>
                Submitted Entries ({completedEntries.length})
              </h3>
              {completedEntries.map((entry, idx) => (
                <div key={idx} style={{ backgroundColor: '#1e293b', padding: '0.75rem', marginBottom: '0.5rem', borderRadius: '0.375rem', borderLeft: `4px solid ${entry.entryType === 'VA_RATING_DECISION' ? '#14b8a6' : '#06b6d4'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ color: '#cbd5e1' }}>
                        {entry.entryType === 'VA_RATING_DECISION' ? '⚖️ VA Rating' : '📝 STR'}
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                        {new Date(entry.submittedAt).toLocaleDateString()} {new Date(entry.submittedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#14b8a6' }}>
                      {entry.extractionSummary?.totalServiceConnected || entry.patientHistory?.totalMedicalEvents} items
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VA Rating Decision Form */}
      {selectedForm === 'va-rating' && (
        <div>
          <button
            onClick={() => setSelectedForm(null)}
            style={{
              padding: '0.5rem 1rem',
              marginBottom: '1rem',
              backgroundColor: '#334155',
              color: '#cbd5e1',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            ← Back to Selection
          </button>
          <VARatingDecisionManualEntry onSave={handleVAEntry} />
        </div>
      )}

      {/* STR Form */}
      {selectedForm === 'str' && (
        <div>
          <button
            onClick={() => setSelectedForm(null)}
            style={{
              padding: '0.5rem 1rem',
              marginBottom: '1rem',
              backgroundColor: '#334155',
              color: '#cbd5e1',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            ← Back to Selection
          </button>
          <STRManualEntry onSave={handleSTREntry} />
        </div>
      )}
    </div>
  );
}
