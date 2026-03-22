import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/Card.jsx';
import { WorkflowCarryForwardCard } from '../../components/WorkflowCarryForwardCard.jsx';
import { useClaimWorkspace } from '../../context/ClaimWorkspaceContext.jsx';
import { placeholders } from '../../system/placeholders/index.js';
import {
  buildCountSummary,
  buildProviderTimeline,
  dedupeManualEntries,
  detectWorseningTrend,
  mergeExtractedFindings,
  normalizeExtractionResult,
  normalizeManualEntry,
  validateManualEntry,
} from './normalization.js';
import {
  CT_CATEGORY_LABELS,
  CT_FINDING_CATEGORIES,
  CT_STATUS_VALUES,
  createEmptyExtractedFindings,
  createEmptyManualEntry,
  createEmptyMedication,
} from './schema.js';

// Suppress IDE unused-variable warnings for JSX-referenced components.
const CardComponent = Card;
const CarryForwardComponent = WorkflowCarryForwardCard;
void CardComponent;
void CarryForwardComponent;

// ─── Style helpers ──────────────────────────────────────────────────────────

function chipStyle(isActive) {
  return {
    border: isActive ? '1px solid #14b8a6' : '1px solid #334155',
    backgroundColor: isActive ? 'rgba(20,184,166,0.14)' : '#0f172a',
    color: isActive ? '#5eead4' : '#cbd5e1',
    fontWeight: 600,
    fontSize: '0.75rem',
    borderRadius: '999px',
    padding: '0.22rem 0.7rem',
    cursor: 'pointer',
  };
}

const inputStyle = {
  display: 'block',
  width: '100%',
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '0.375rem',
  color: '#e2e8f0',
  fontSize: '0.82rem',
  padding: '0.45rem 0.6rem',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.76rem',
  color: '#94a3b8',
  marginBottom: '0.25rem',
};

const errorStyle = {
  fontSize: '0.72rem',
  color: '#f87171',
  marginTop: '0.2rem',
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const TREND_CONFIG = {
  worsening: { color: '#ef4444', bg: 'rgba(239,68,68,0.14)', label: 'Trend: Worsening' },
  stable: { color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', label: 'Trend: Stable' },
  improving: { color: '#22c55e', bg: 'rgba(34,197,94,0.14)', label: 'Trend: Improving' },
  unknown: { color: '#64748b', bg: 'rgba(100,116,139,0.1)', label: 'Trend: Insufficient Data' },
};

function TrendBadge({ trend }) {
  const cfg = TREND_CONFIG[trend.trend] || TREND_CONFIG.unknown;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 0.9rem',
        borderRadius: '999px',
        border: `1px solid ${cfg.color}`,
        backgroundColor: cfg.bg,
        marginBottom: '0.75rem',
      }}
    >
      <span style={{ color: cfg.color, fontWeight: 700, fontSize: '0.8rem' }}>{cfg.label}</span>
      {trend.indicators?.length > 0 && (
        <span style={{ color: '#94a3b8', fontSize: '0.73rem' }}>
          — {trend.indicators.slice(0, 2).join(' · ')}
        </span>
      )}
    </div>
  );
}
TrendBadge.displayName = 'TrendBadge';

function CategoryRow({ categoryKey, items }) {
  const [open, setOpen] = useState(false);
  const count = Array.isArray(items) ? items.length : 0;
  const label = CT_CATEGORY_LABELS[categoryKey] || categoryKey;

  return (
    <div
      style={{
        borderBottom: '1px solid #1e293b',
        paddingBottom: '0.6rem',
        marginBottom: '0.6rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 600 }}>{label}</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '0.75rem',
              color: count > 0 ? '#14b8a6' : '#475569',
              fontWeight: 700,
            }}
          >
            {count}
          </span>
          {count > 0 && (
            <button type='button' onClick={() => setOpen((v) => !v)} style={chipStyle(false)}>
              {open ? 'Collapse' : 'Expand'}
            </button>
          )}
        </div>
      </div>
      {count === 0 && (
        <div style={{ fontSize: '0.73rem', color: '#475569', marginTop: '0.2rem' }}>
          None extracted
        </div>
      )}
      {open && count > 0 && (
        <ul
          style={{
            margin: '0.4rem 0 0 0',
            padding: '0 0 0 1rem',
            display: 'grid',
            gap: '0.25rem',
          }}
        >
          {items.map((item, idx) => (
            <li key={idx} style={{ color: '#94a3b8', fontSize: '0.76rem', lineHeight: 1.5 }}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
CategoryRow.displayName = 'CategoryRow';

function MedicationRow({ med, index, onChange, onRemove }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr auto',
        gap: '0.5rem',
        alignItems: 'end',
        marginBottom: '0.5rem',
        padding: '0.5rem',
        backgroundColor: '#0f172a',
        borderRadius: '0.4rem',
        border: '1px solid #334155',
      }}
    >
      <div>
        <label style={labelStyle}>Medication Name *</label>
        <input
          aria-label={`Medication ${index + 1} name`}
          value={med.medicationName}
          onChange={(e) => onChange(index, 'medicationName', e.target.value)}
          style={inputStyle}
          placeholder={placeholders.treatment.medicationName}
        />
      </div>
      <div>
        <label style={labelStyle}>Dosage *</label>
        <input
          aria-label={`Medication ${index + 1} dosage`}
          value={med.dosage}
          onChange={(e) => onChange(index, 'dosage', e.target.value)}
          style={inputStyle}
          placeholder={placeholders.treatment.dosage}
        />
      </div>
      <div>
        <label style={labelStyle}>Side Effects</label>
        <input
          aria-label={`Medication ${index + 1} side effects`}
          value={med.sideEffects}
          onChange={(e) => onChange(index, 'sideEffects', e.target.value)}
          style={inputStyle}
          placeholder={placeholders.treatment.sideEffects}
        />
      </div>
      <button
        type='button'
        onClick={() => onRemove(index)}
        style={{ ...chipStyle(false), alignSelf: 'flex-end', marginBottom: '2px' }}
      >
        Remove
      </button>
    </div>
  );
}
MedicationRow.displayName = 'MedicationRow';

function TimelineProviderGroup({ group }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        padding: '0.65rem',
        borderRadius: '0.5rem',
        border: group.hasGap ? '1px solid rgba(245,158,11,0.45)' : '1px solid #334155',
        backgroundColor: '#0f172a',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.84rem' }}>
            {group.provider}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.73rem', marginTop: '0.15rem' }}>
            {group.eventCount} event{group.eventCount !== 1 ? 's' : ''}
            {group.hasGap && (
              <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>
                ⚠ Gap detected ({group.gaps[0].days}d)
              </span>
            )}
          </div>
        </div>
        {group.eventCount > 0 && (
          <button type='button' onClick={() => setOpen((v) => !v)} style={chipStyle(false)}>
            {open ? 'Hide' : 'Show'} events
          </button>
        )}
      </div>
      {open && group.eventCount > 0 && (
        <ul
          style={{
            margin: '0.5rem 0 0 0',
            padding: '0 0 0 1rem',
            display: 'grid',
            gap: '0.3rem',
            borderTop: '1px solid #1e293b',
            paddingTop: '0.5rem',
          }}
        >
          {group.events.map((ev, idx) => (
            <li key={idx} style={{ color: '#94a3b8', fontSize: '0.76rem', lineHeight: 1.5 }}>
              {ev.date ? (
                <span style={{ color: '#5eead4', marginRight: '0.4rem' }}>{ev.date}</span>
              ) : null}
              {ev.label}
              {ev.source === 'manual' && (
                <span style={{ color: '#475569', marginLeft: '0.4rem' }}>(manual)</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
TimelineProviderGroup.displayName = 'TimelineProviderGroup';

// ─── Main component ──────────────────────────────────────────────────────────

export function CurrentTreatmentTab() {
  const { workspace, workflow, updateWorkspace } = useClaimWorkspace();

  const [activeTab, setActiveTab] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [uploadError, setUploadError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [draft, setDraft] = useState(() => createEmptyManualEntry());
  const [manualErrors, setManualErrors] = useState({});
  const [editingId, setEditingId] = useState(null);

  // ── Derived state ────────────────────────────────────────────────────────
  const section = useMemo(() => workspace?.currentTreatment || {}, [workspace?.currentTreatment]);

  const extractedFindings = useMemo(() => {
    const ef = section?.extractedFindings;
    if (ef && typeof ef === 'object' && !Array.isArray(ef)) return ef;
    return createEmptyExtractedFindings();
  }, [section]);

  const manualEntries = useMemo(
    () => (Array.isArray(section?.manualEntries) ? section.manualEntries : []),
    [section]
  );

  const countSummary = useMemo(() => buildCountSummary(section), [section]);
  const providerTimeline = useMemo(() => buildProviderTimeline(section), [section]);
  const worseningTrend = useMemo(() => detectWorseningTrend(section), [section]);

  const hasExtractionData = useMemo(
    () => CT_FINDING_CATEGORIES.some((k) => Array.isArray(extractedFindings[k]) && extractedFindings[k].length > 0),
    [extractedFindings]
  );

  // Workflow carry-forward data
  const suggestedConditions = useMemo(
    () => (workflow?.suggestedTreatmentEntries || []).map((e) => e.conditionName),
    [workflow]
  );

  const priorProviders = useMemo(() => {
    const fromManual = manualEntries.map((e) => e?.providerName).filter(Boolean);
    const fromExtracted = Array.isArray(extractedFindings?.providerSignals)
      ? extractedFindings.providerSignals.slice(0, 2)
      : [];
    return [...new Set([...fromExtracted, ...fromManual])].slice(0, 3);
  }, [manualEntries, extractedFindings]);

  // Auto-clear status message
  useEffect(() => {
    if (!statusMessage) return;
    const id = setTimeout(() => setStatusMessage(''), 5000);
    return () => clearTimeout(id);
  }, [statusMessage]);

  // ── Persist helpers ──────────────────────────────────────────────────────

  const persistManualEntries = useCallback(
    (nextEntries) => {
      const deduped = dedupeManualEntries(nextEntries);
      updateWorkspace((current) => ({
        ...current,
        currentTreatment: {
          ...current?.currentTreatment,
          manualEntries: deduped,
          updatedAt: new Date().toISOString(),
        },
      }));
    },
    [updateWorkspace]
  );

  const persistExtractedFindings = useCallback(
    (merged, uploadRecord) => {
      updateWorkspace((current) => {
        const prevDocs = Array.isArray(current?.currentTreatment?.uploadedDocuments)
          ? current.currentTreatment.uploadedDocuments
          : [];
        return {
          ...current,
          currentTreatment: {
            ...current?.currentTreatment,
            extractedFindings: merged,
            uploadedDocuments: uploadRecord ? [...prevDocs, uploadRecord] : prevDocs,
            updatedAt: new Date().toISOString(),
          },
        };
      });
    },
    [updateWorkspace]
  );

  // ── Upload handler ───────────────────────────────────────────────────────

  const handleUpload = async (filesToUpload) => {
    if (!filesToUpload?.length) {
      setUploadError('Please select a file first');
      return;
    }

    setUploading(true);
    setUploadStatus('uploading');
    setUploadError('');

    try {
      for (const file of filesToUpload) {
        setStatusMessage(`Processing ${file.name}…`);

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/scanner/scan-current-treatment-pdf', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            `${file.name}: ${errData?.error || `processing failed (${response.status})`}`
          );
        }

        const data = await response.json();
        const normalized = normalizeExtractionResult(data, file.name);
        const currentEf =
          section?.extractedFindings &&
          typeof section.extractedFindings === 'object' &&
          !Array.isArray(section.extractedFindings)
            ? section.extractedFindings
            : createEmptyExtractedFindings();

        const merged = mergeExtractedFindings(currentEf, normalized.findings);
        persistExtractedFindings(merged, {
          fileName: normalized.fileName,
          fileSize: normalized.fileSize,
          pagesScanned: normalized.pagesScanned,
          uploadedAt: normalized.extractedAt,
        });

        setStatusMessage(`✓ ${file.name} processed`);
      }

      setUploadStatus('success');
      setStatusMessage(
        `Analysis complete. ${filesToUpload.length} file${filesToUpload.length !== 1 ? 's' : ''} processed.`
      );
    } catch (err) {
      setUploadStatus('error');
      setUploadError(err.message || 'Failed to process file');
      setStatusMessage('');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadError('');
    handleUpload(files);
  };

  // ── Manual entry handlers ────────────────────────────────────────────────

  const handleManualSave = () => {
    const errors = validateManualEntry(draft);
    if (Object.keys(errors).length > 0) {
      setManualErrors(errors);
      return;
    }
    setManualErrors({});
    const normalized = normalizeManualEntry(draft);

    if (editingId) {
      persistManualEntries(manualEntries.map((e) => (e.id === editingId ? normalized : e)));
      setEditingId(null);
    } else {
      persistManualEntries([...manualEntries, normalized]);
    }
    setDraft(createEmptyManualEntry());
  };

  const handleEdit = (entry) => {
    setDraft({ ...entry });
    setEditingId(entry.id);
    setManualErrors({});
  };

  const handleCancelEdit = () => {
    setDraft(createEmptyManualEntry());
    setEditingId(null);
    setManualErrors({});
  };

  const handleDelete = (id) => {
    persistManualEntries(manualEntries.filter((e) => e.id !== id));
  };

  const updateDraftField = (field, value) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  const addMedication = () =>
    setDraft((prev) => ({
      ...prev,
      medications: [...(prev.medications || []), createEmptyMedication()],
    }));

  const updateMedication = (index, field, value) =>
    setDraft((prev) => {
      const meds = [...(prev.medications || [])];
      meds[index] = { ...meds[index], [field]: value };
      return { ...prev, medications: meds };
    });

  const removeMedication = (index) =>
    setDraft((prev) => ({
      ...prev,
      medications: (prev.medications || []).filter((_, i) => i !== index),
    }));

  // ── Render ───────────────────────────────────────────────────────────────

  const uploadStatusColors = {
    idle: null,
    uploading: { bg: '#1e293b', border: '#334155', text: '#94a3b8' },
    success: { bg: '#0f3b2e', border: '#0d5f49', text: '#99f6e4' },
    error: { bg: '#450a0a', border: '#7f1d1d', text: '#fca5a5' },
  };
  const statusColor = uploadStatusColors[uploadStatus];

  return (
    <div className='page-shell'>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <section className='page-header'>
        <div>
          <div className='page-eyebrow'>Tab 04</div>
          <h1 className='page-title'>Current Treatment Records</h1>
          <p className='page-copy'>
            Upload current diagnosis or treatment documents, or enter records manually. Findings are
            linked to STR evidence to build your service-connection profile.
          </p>
        </div>
        <div className='page-badge'>Current treatment intake</div>
      </section>

      {/* ── Carry-forward ────────────────────────────────────────────────── */}
      <WorkflowCarryForwardCard
        title='Step 04 Carry Forward'
        description='STR diagnoses and prior provider context carrying forward. Use suggested conditions to avoid re-entering conditions already found in earlier steps.'
        items={[
          { label: 'Veteran', value: workflow?.profileSummary?.fullName, color: '#5eead4' },
          {
            label: 'STR Diagnoses',
            value: workflow?.strsSummary?.diagnoses?.length
              ? workflow.strsSummary.diagnoses.slice(0, 4)
              : '',
          },
          {
            label: 'STR Injuries',
            value: workflow?.strsSummary?.injuries?.length
              ? workflow.strsSummary.injuries.slice(0, 4)
              : '',
          },
          {
            label: 'Prior Providers',
            value: priorProviders.length ? priorProviders : '',
          },
          {
            label: 'Needs Current Dx',
            value: suggestedConditions.length ? suggestedConditions.slice(0, 4) : '',
          },
        ]}
      />

      {/* ── Worsening trend badge ────────────────────────────────────────── */}
      {worseningTrend.trend !== 'unknown' && <TrendBadge trend={worseningTrend} />}

      {/* ── Tab strip ────────────────────────────────────────────────────── */}
      <div className='kb-tab-strip'>
        <button
          type='button'
          className={`kb-tab-btn${activeTab === 'upload' ? ' active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          File Upload
        </button>
        <button
          type='button'
          className={`kb-tab-btn${activeTab === 'manual' ? ' active' : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          Manual Entry
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          UPLOAD TAB
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'upload' && (
        <>
          {/* Card A: Upload */}
          <Card title='Upload Current Treatment Documents'>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label
                  htmlFor='ct-file-input'
                  style={{ fontSize: '0.875rem', color: '#cbd5e1', display: 'block', marginBottom: '0.4rem' }}
                >
                  Select Document(s) — PDF or TXT
                </label>
                <input
                  id='ct-file-input'
                  type='file'
                  accept='.pdf,.txt'
                  multiple
                  aria-label='Upload treatment documents'
                  disabled={uploading}
                  onChange={handleFileChange}
                  style={inputStyle}
                />
              </div>

              {uploading && (
                <div
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.82rem',
                    borderRadius: '0.375rem',
                    backgroundColor: '#1e293b',
                    color: '#94a3b8',
                    fontWeight: 600,
                  }}
                >
                  ⏳ Processing…
                </div>
              )}

              {statusMessage && uploadStatus !== 'error' && statusColor && (
                <div
                  style={{
                    padding: '0.65rem',
                    backgroundColor: statusColor.bg,
                    border: `1px solid ${statusColor.border}`,
                    borderRadius: '0.375rem',
                  }}
                >
                  <p style={{ fontSize: '0.78rem', color: statusColor.text, margin: 0 }}>
                    {statusMessage}
                  </p>
                </div>
              )}

              {uploadError && (
                <div
                  style={{
                    padding: '0.65rem',
                    backgroundColor: '#450a0a',
                    border: '1px solid #7f1d1d',
                    borderRadius: '0.375rem',
                  }}
                >
                  <p style={{ fontSize: '0.82rem', color: '#fca5a5', fontWeight: 700, margin: 0 }}>
                    Upload Error
                  </p>
                  <p style={{ fontSize: '0.76rem', color: '#fecaca', margin: '0.2rem 0 0' }}>
                    {uploadError}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Card B: Analysis results */}
          {hasExtractionData && (
            <Card title='Current Treatment Analysis Results'>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {/* Summary stats */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                    gap: '0.5rem',
                    marginBottom: '1rem',
                  }}
                >
                  {[
                    {
                      label: 'Conditions',
                      value: extractedFindings.currentConditions?.length || 0,
                    },
                    {
                      label: 'Limitations',
                      value: extractedFindings.functionalLimitations?.length || 0,
                    },
                    {
                      label: 'Events',
                      value: extractedFindings.treatmentEvents?.length || 0,
                    },
                    {
                      label: 'Medications',
                      value: extractedFindings.medicationMentions?.length || 0,
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      style={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '0.5rem',
                        padding: '0.55rem',
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{label}</div>
                      <div style={{ fontSize: '1.1rem', color: '#e2e8f0', fontWeight: 700 }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 7-category breakdown */}
                {CT_FINDING_CATEGORIES.map((key) => (
                  <CategoryRow
                    key={key}
                    categoryKey={key}
                    items={extractedFindings[key] || []}
                  />
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MANUAL ENTRY TAB
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'manual' && (
        <>
          {/* Card A: Entry form */}
          <Card title={editingId ? 'Edit Entry' : 'Manual Entry — Current Diagnoses and Symptoms'}>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem', lineHeight: 1.5 }}>
              {editingId
                ? placeholders.helperText.treatment.editingEntry
                : placeholders.helperText.treatment.manualEntryGuide}
            </p>

            <div style={{ display: 'grid', gap: '0.85rem' }}>
              {/* Condition Name */}
              <div>
                <label htmlFor='ct-condition-name' style={labelStyle}>
                  Condition Name *
                </label>
                <input
                  id='ct-condition-name'
                  aria-label='Condition name'
                  value={draft.conditionName}
                  onChange={(e) => updateDraftField('conditionName', e.target.value)}
                  style={inputStyle}
                  placeholder={placeholders.treatment.conditionName}
                />
                {manualErrors.conditionName && (
                  <span style={errorStyle}>{manualErrors.conditionName}</span>
                )}
              </div>

              {/* Symptom Summary */}
              <div>
                <label htmlFor='ct-symptom-summary' style={labelStyle}>
                  Symptom Summary *
                </label>
                <textarea
                  id='ct-symptom-summary'
                  aria-label='Symptom summary'
                  value={draft.symptomSummary}
                  onChange={(e) => updateDraftField('symptomSummary', e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder={placeholders.treatment.symptomSummary}
                />
                {manualErrors.symptomSummary && (
                  <span style={errorStyle}>{manualErrors.symptomSummary}</span>
                )}
              </div>

              {/* Status and Provider row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '0.65rem',
                }}
              >
                <div>
                  <label htmlFor='ct-status' style={labelStyle}>
                    Status
                  </label>
                  <select
                    id='ct-status'
                    aria-label='Treatment status'
                    value={draft.status}
                    onChange={(e) => updateDraftField('status', e.target.value)}
                    style={inputStyle}
                  >
                    {CT_STATUS_VALUES.map((v) => (
                      <option key={v} value={v}>
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor='ct-provider-name' style={labelStyle}>
                    Provider Name
                  </label>
                  <input
                    id='ct-provider-name'
                    aria-label='Provider name'
                    value={draft.providerName}
                    onChange={(e) => updateDraftField('providerName', e.target.value)}
                    style={inputStyle}
                    placeholder={placeholders.treatment.providerName}
                  />
                </div>

                <div>
                  <label htmlFor='ct-provider-type' style={labelStyle}>
                    Provider Type
                  </label>
                  <input
                    id='ct-provider-type'
                    aria-label='Provider type'
                    value={draft.providerType}
                    onChange={(e) => updateDraftField('providerType', e.target.value)}
                    style={inputStyle}
                    placeholder={placeholders.treatment.providerType}
                  />
                </div>
              </div>

              {/* Treatment Details */}
              <div>
                <label htmlFor='ct-treatment-details' style={labelStyle}>
                  Treatment Details
                </label>
                <textarea
                  id='ct-treatment-details'
                  aria-label='Treatment details'
                  value={draft.treatmentDetails}
                  onChange={(e) => updateDraftField('treatmentDetails', e.target.value)}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder={placeholders.treatment.treatmentDetails}
                />
              </div>

              {/* Date range */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div>
                  <label htmlFor='ct-start-date' style={labelStyle}>
                    Treatment Start Date
                  </label>
                  <input
                    id='ct-start-date'
                    aria-label='Treatment start date'
                    type='date'
                    value={draft.treatmentStartDate}
                    onChange={(e) => updateDraftField('treatmentStartDate', e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label htmlFor='ct-end-date' style={labelStyle}>
                    Treatment End Date
                  </label>
                  <input
                    id='ct-end-date'
                    aria-label='Treatment end date'
                    type='date'
                    value={draft.treatmentEndDate}
                    onChange={(e) => updateDraftField('treatmentEndDate', e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Medications sub-form */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.4rem',
                  }}
                >
                  <span style={{ ...labelStyle, margin: 0 }}>Medications</span>
                  <button
                    type='button'
                    onClick={addMedication}
                    style={chipStyle(false)}
                    aria-label='Add medication'
                  >
                    + Add Medication
                  </button>
                </div>
                {(draft.medications || []).map((med, idx) => (
                  <MedicationRow
                    key={idx}
                    med={med}
                    index={idx}
                    onChange={updateMedication}
                    onRemove={removeMedication}
                  />
                ))}
                {(draft.medications || []).length === 0 && (
                  <p style={{ fontSize: '0.73rem', color: '#475569', margin: 0 }}>
                    No medications added. Click "+ Add Medication" to track prescriptions.
                  </p>
                )}
                {Object.keys(manualErrors)
                  .filter((k) => k.startsWith('medication_'))
                  .map((k) => (
                    <span key={k} style={errorStyle}>
                      {manualErrors[k]}
                    </span>
                  ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                <button type='button' onClick={handleManualSave} className='btn-primary'>
                  {editingId ? 'Update Entry' : 'Add Entry'}
                </button>
                {editingId && (
                  <button type='button' onClick={handleCancelEdit} style={chipStyle(false)}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
          </Card>

          {/* Card B: Saved entries */}
          {manualEntries.length > 0 && (
            <Card title='Saved Entries'>
              {/* Summary counts */}
              <div
                style={{
                  display: 'flex',
                  gap: '1.5rem',
                  fontSize: '0.76rem',
                  color: '#94a3b8',
                  marginBottom: '0.85rem',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ color: '#5eead4', fontWeight: 700 }}>
                  {countSummary.totalConditions} condition{countSummary.totalConditions !== 1 ? 's' : ''} saved
                </span>
                <span>{countSummary.activeConditions} active</span>
                <span>{countSummary.providerCount} provider{countSummary.providerCount !== 1 ? 's' : ''}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {manualEntries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '0.5rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.86rem' }}>
                          {entry.conditionName}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.74rem', marginTop: '0.2rem' }}>
                          <span
                            style={{
                              padding: '0.1rem 0.45rem',
                              borderRadius: '999px',
                              backgroundColor:
                                entry.status === 'active'
                                  ? 'rgba(20,184,166,0.15)'
                                  : 'rgba(100,116,139,0.2)',
                              color: entry.status === 'active' ? '#5eead4' : '#94a3b8',
                              fontWeight: 600,
                              marginRight: '0.4rem',
                            }}
                          >
                            {entry.status}
                          </span>
                          {entry.providerName && `${entry.providerName} · `}
                          {entry.treatmentStartDate && `Started ${entry.treatmentStartDate}`}
                        </div>
                        {entry.symptomSummary && (
                          <div
                            style={{
                              color: '#cbd5e1',
                              fontSize: '0.76rem',
                              marginTop: '0.35rem',
                              lineHeight: 1.5,
                            }}
                          >
                            {entry.symptomSummary}
                          </div>
                        )}
                        {entry.medications?.length > 0 && (
                          <div
                            style={{ color: '#94a3b8', fontSize: '0.73rem', marginTop: '0.3rem' }}
                          >
                            {entry.medications.length} medication{entry.medications.length !== 1 ? 's' : ''}:{' '}
                            {entry.medications.map((m) => m.medicationName).filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                        <button
                          type='button'
                          onClick={() => handleEdit(entry)}
                          style={chipStyle(false)}
                          aria-label={`Edit ${entry.conditionName}`}
                        >
                          Edit
                        </button>
                        <button
                          type='button'
                          onClick={() => handleDelete(entry.id)}
                          style={{ ...chipStyle(false), color: '#f87171', borderColor: '#7f1d1d' }}
                          aria-label={`Delete ${entry.conditionName}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TREATMENT TIMELINE (always visible when data present)
          ═══════════════════════════════════════════════════════════════════ */}
      {providerTimeline.length > 0 && (
        <Card title='Treatment Timeline'>
          <p
            style={{
              fontSize: '0.77rem',
              color: '#94a3b8',
              marginBottom: '0.85rem',
              lineHeight: 1.5,
            }}
          >
            Treatment events grouped by provider. Orange borders indicate gaps exceeding 6 months.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {providerTimeline.map((group, idx) => (
              <TimelineProviderGroup key={`${group.provider}-${idx}`} group={group} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
