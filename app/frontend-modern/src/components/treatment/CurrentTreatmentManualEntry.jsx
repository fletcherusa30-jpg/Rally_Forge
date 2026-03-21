import React, { useMemo, useState } from 'react';
import { normalizeTreatmentSuggestion } from '../../services/normalization/suggestionNormalization.js';

export function CurrentTreatmentManualEntry({ onSave, initialEntry = null, seedConditions = [], seedSuggestions = [] }) {
  const emitTelemetry = (event, details = {}) => {
    console.info('[CurrentTreatmentManualEntry]', {
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
  const canonicalEntryKey = (entry) => normalizeText(entry?.conditionName).toLowerCase();

  const buildDefaultForm = (overrides = null) => {
    const defaults = {
      conditionName: '',
      diagnosisDate: '',
      symptomSummary: '',
      provider: '',
      treatmentPlan: '',
      medications: '',
      severity: 'moderate',
      status: 'active',
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
  const [errors, setErrors] = useState({});
  const [importStatus, setImportStatus] = useState('');
  const [form, setForm] = useState(() => buildDefaultForm(initialEntry));
  const suggestions = useMemo(
    () => Array.from(new Map(
      [...(seedSuggestions || []), ...(seedConditions || [])]
        .map(normalizeTreatmentSuggestion)
        .filter(Boolean)
        .map((item) => [item.conditionName.toLowerCase(), item])
    ).values()),
    [seedConditions, seedSuggestions]
  );

  const validate = () => {
    const nextErrors = {};
    if (!form.conditionName.trim()) nextErrors.conditionName = 'Condition name is required';
    if (!form.symptomSummary.trim()) nextErrors.symptomSummary = 'Symptoms or diagnosis details are required';
    return nextErrors;
  };

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const normalizeEntry = (entry) => ({
    conditionName: normalizeText(entry?.conditionName),
    diagnosisDate: normalizeDate(entry?.diagnosisDate) || null,
    symptomSummary: normalizeText(entry?.symptomSummary),
    provider: normalizeText(entry?.provider) || null,
    treatmentPlan: normalizeText(entry?.treatmentPlan) || null,
    medications: Array.isArray(entry?.medications)
      ? entry.medications.map((item) => normalizeText(item)).filter(Boolean)
      : String(entry?.medications || '')
        .split(',')
        .map((item) => normalizeText(item))
        .filter(Boolean),
    severity: normalizeText(entry?.severity) || 'moderate',
    status: normalizeText(entry?.status) || 'active',
    entryType: 'CURRENT_TREATMENT_RECORD',
    manualEntry: true,
  });

  const applySuggestion = (suggestion) => {
    if (!suggestion) {
      return;
    }

    setImportStatus('');
    setForm((prev) => buildDefaultForm({
      ...prev,
      ...suggestion,
      provider: suggestion.provider || prev.provider,
      treatmentPlan: suggestion.treatmentPlan || prev.treatmentPlan,
      medications: suggestion.medications || prev.medications,
      severity: suggestion.severity || prev.severity,
      status: suggestion.status || prev.status,
    }));
  };

  const addEntry = () => {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setEntries((prev) => ([
      ...prev,
      (() => {
        const normalized = normalizeEntry(form);
        const duplicateIndex = prev.findIndex((item) => canonicalEntryKey(item) === canonicalEntryKey(normalized));
        emitTelemetry('entry_added', {
          duplicate: duplicateIndex >= 0,
          conditionName: normalized.conditionName,
        });
        return {
          ...normalized,
          duplicateOf: duplicateIndex >= 0 ? duplicateIndex : null,
        };
      })(),
    ]));

    setErrors({});
    setForm(buildDefaultForm({
      ...initialEntry,
      provider: form.provider,
      treatmentPlan: form.treatmentPlan,
      medications: form.medications,
      severity: form.severity,
      status: form.status,
    }));
  };

  const importAllSuggestedConditions = () => {
    if (suggestions.length === 0) {
      setImportStatus('No suggested conditions are available to import.');
      return;
    }

    setEntries((prev) => {
      const existing = new Set(prev.map((entry) => String(entry.conditionName || '').trim().toLowerCase()));
      const additions = suggestions
        .filter((suggestion) => !existing.has(String(suggestion.conditionName || '').trim().toLowerCase()))
        .map((suggestion) => ({
          conditionName: normalizeText(suggestion.conditionName),
          diagnosisDate: suggestion.diagnosisDate || form.diagnosisDate || null,
          symptomSummary: normalizeText(suggestion.symptomSummary || 'Imported from earlier workflow evidence. Update with current diagnosis or symptom details if needed.'),
          provider: normalizeText(suggestion.provider || form.provider) || null,
          treatmentPlan: normalizeText(suggestion.treatmentPlan || form.treatmentPlan) || null,
          medications: String(suggestion.medications || form.medications || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          severity: suggestion.severity || form.severity,
          status: suggestion.status || form.status,
          entryType: 'CURRENT_TREATMENT_RECORD',
          manualEntry: true,
          importedFromWorkflow: true,
          sourceEvidence: suggestion.sourceEvidence || [],
        }));

      emitTelemetry('suggestions_imported', { count: additions.length });

      setImportStatus(additions.length > 0
        ? `Imported ${additions.length} suggested condition${additions.length === 1 ? '' : 's'} into saved entries.`
        : 'All suggested conditions were already imported.');

      return [...prev, ...additions];
    });
  };

  const removeEntry = (index) => {
    setEntries((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSave = () => {
    const normalizedEntries = entries.map(normalizeEntry);
    const invalidEntry = normalizedEntries.find((entry) => !entry.conditionName || !entry.symptomSummary);
    if (invalidEntry) {
      setErrors({
        conditionName: !invalidEntry.conditionName ? 'Condition name is required' : undefined,
        symptomSummary: !invalidEntry.symptomSummary ? 'Symptoms or diagnosis details are required' : undefined,
      });
      emitTelemetry('save_blocked_validation', { conditionName: invalidEntry.conditionName });
      return;
    }

    const result = {
      success: true,
      fileName: 'Current Treatment Manual Entry',
      allRecords: normalizedEntries,
      conditions: normalizedEntries.map((entry) => entry.conditionName),
      summary: {
        totalRecords: normalizedEntries.length,
        activeConditions: normalizedEntries.filter((entry) => entry.status === 'active').length,
        providers: Array.from(new Set(normalizedEntries.map((entry) => entry.provider).filter(Boolean))),
      },
      extractionSummary: {
        totalRecords: normalizedEntries.length,
        manualEntry: true,
        entryType: 'CURRENT_TREATMENT_RECORD',
      },
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
    color: '#cbd5e1',
  };

  const errorStyle = {
    ...inputStyle,
    borderColor: '#ef4444',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '1rem' }}>
          Current Diagnosis and Treatment Entry
        </h3>

        {suggestions.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.45rem' }}>
              Conditions detected earlier in the workflow. Click one to pull forward the condition, dates, and suggested symptom details.
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.55rem' }}>
              <button
                type='button'
                onClick={importAllSuggestedConditions}
                style={{
                  padding: '0.38rem 0.8rem',
                  borderRadius: '999px',
                  border: '1px solid #14b8a6',
                  backgroundColor: 'rgba(20, 184, 166, 0.14)',
                  color: '#5eead4',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Import All Suggestions
              </button>
              {importStatus && (
                <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>{importStatus}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              {suggestions.slice(0, 10).map((suggestion) => (
                <button
                  key={suggestion.conditionName}
                  type='button'
                  onClick={() => applySuggestion(suggestion)}
                  style={{
                    padding: '0.32rem 0.7rem',
                    borderRadius: '999px',
                    border: '1px solid #334155',
                    backgroundColor: form.conditionName === suggestion.conditionName ? 'rgba(20, 184, 166, 0.16)' : '#0f172a',
                    color: form.conditionName === suggestion.conditionName ? '#5eead4' : '#cbd5e1',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title={suggestion.symptomSummary || suggestion.conditionName}
                >
                  {suggestion.conditionName}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Condition / Diagnosis</label>
            <input value={form.conditionName} onChange={(event) => update('conditionName', event.target.value)} style={errors.conditionName ? errorStyle : inputStyle} />
            {errors.conditionName && <div style={{ color: '#fca5a5', fontSize: '0.7rem', marginTop: '0.2rem' }}>{errors.conditionName}</div>}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Diagnosis Date</label>
            <input type='date' value={form.diagnosisDate} onChange={(event) => update('diagnosisDate', event.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Current Symptoms / Findings</label>
          <textarea rows={4} value={form.symptomSummary} onChange={(event) => update('symptomSummary', event.target.value)} style={errors.symptomSummary ? errorStyle : { ...inputStyle, resize: 'vertical' }} />
          {errors.symptomSummary && <div style={{ color: '#fca5a5', fontSize: '0.7rem', marginTop: '0.2rem' }}>{errors.symptomSummary}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Treating Provider</label>
            <input value={form.provider} onChange={(event) => update('provider', event.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Medications</label>
            <input value={form.medications} onChange={(event) => update('medications', event.target.value)} placeholder='Comma-separated' style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Severity</label>
            <select value={form.severity} onChange={(event) => update('severity', event.target.value)} style={inputStyle}>
              <option value='mild'>Mild</option>
              <option value='moderate'>Moderate</option>
              <option value='severe'>Severe</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Status</label>
            <select value={form.status} onChange={(event) => update('status', event.target.value)} style={inputStyle}>
              <option value='active'>Active</option>
              <option value='improving'>Improving</option>
              <option value='stable'>Stable</option>
              <option value='flare'>Flare / worsening</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Treatment Plan</label>
            <input value={form.treatmentPlan} onChange={(event) => update('treatmentPlan', event.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type='button' onClick={addEntry} style={{ padding: '0.55rem 1rem', borderRadius: '0.375rem', border: 'none', backgroundColor: '#14b8a6', color: '#0f172a', fontWeight: 700, cursor: 'pointer' }}>
            Add Entry
          </button>
          <button type='button' onClick={handleSave} disabled={entries.length === 0} style={{ padding: '0.55rem 1rem', borderRadius: '0.375rem', border: '1px solid #14b8a6', backgroundColor: 'transparent', color: entries.length === 0 ? '#64748b' : '#5eead4', fontWeight: 700, cursor: entries.length === 0 ? 'not-allowed' : 'pointer' }}>
            Save Current Treatment
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {entries.map((entry, index) => (
            <div key={`${entry.conditionName}-${index}`} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <div style={{ color: '#5eead4', fontWeight: 700 }}>{entry.conditionName}</div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    {entry.diagnosisDate || 'No date'} · {entry.status} · {entry.severity}
                    {entry.provider ? ` · ${entry.provider}` : ''}
                  </div>
                </div>
                <button type='button' onClick={() => removeEntry(index)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontWeight: 700 }}>
                  Remove
                </button>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.5rem', lineHeight: '1.5' }}>{entry.symptomSummary}</div>
              {entry.importedFromWorkflow && (
                <div style={{ fontSize: '0.72rem', color: '#fbbf24', marginTop: '0.35rem' }}>
                  Imported from earlier workflow evidence.
                </div>
              )}
              {Array.isArray(entry.sourceEvidence) && entry.sourceEvidence.length > 0 && (
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.35rem', lineHeight: '1.5' }}>
                  Source: {entry.sourceEvidence.slice(0, 2).map((source) => source?.sourceName || source?.label).filter(Boolean).join(' | ')}
                </div>
              )}
              {entry.medications.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '0.35rem' }}>
                  Medications: {entry.medications.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}