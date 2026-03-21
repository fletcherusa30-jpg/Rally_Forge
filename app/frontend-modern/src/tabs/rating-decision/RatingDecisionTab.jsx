import React, { useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { WorkflowCarryForwardCard } from '../../components/WorkflowCarryForwardCard.jsx';
import { useClaimWorkspace } from '../../context/ClaimWorkspaceContext.jsx';
import {
  buildRatingTimeline,
  buildSectionConfidenceSummary,
  dedupeManualEntries,
  detectRatingConflicts,
  mergeExtractedFindings,
  normalizeConditionName,
  normalizeManualEntry,
  normalizeRatingDecisionUploadResult,
  validateManualEntry,
} from './normalization.js';
import {
  RD_PERCENT_OPTIONS,
  RD_SECTION_LABELS,
  createEmptyExtractedFindings,
  createEmptyManualEntry,
} from './schema.js';

const STATUS_COLORS = {
  idle: '#94a3b8',
  uploading: '#fbbf24',
  success: '#34d399',
  error: '#f87171',
};

const inputStyle = {
  width: '100%',
  padding: '0.5rem',
  borderRadius: '0.375rem',
  border: '1px solid #334155',
  backgroundColor: '#0f172a',
  color: '#e2e8f0',
  fontSize: '0.85rem',
};

function chipStyle(active = false) {
  return {
    borderRadius: '999px',
    border: `1px solid ${active ? '#14b8a6' : '#334155'}`,
    backgroundColor: active ? 'rgba(20,184,166,0.16)' : '#0f172a',
    color: active ? '#5eead4' : '#cbd5e1',
    fontSize: '0.73rem',
    fontWeight: 700,
    padding: '0.2rem 0.55rem',
  };
}

function formatPercent(value) {
  if (value === '' || value === null || value === undefined) return 'N/A';
  return `${Number(value)}%`;
}

function formatConfidence(value) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return 'N/A';
  return `${Math.round(Number(value) * 100)}%`;
}

function ConfidenceBadge({ level }) {
  const normalized = String(level || 'unknown').toLowerCase();
  const palette = {
    high: { border: '#0f766e', bg: 'rgba(20,184,166,0.18)', color: '#5eead4' },
    medium: { border: '#92400e', bg: 'rgba(245,158,11,0.16)', color: '#fcd34d' },
    low: { border: '#7f1d1d', bg: 'rgba(248,113,113,0.14)', color: '#fca5a5' },
    unknown: { border: '#334155', bg: 'rgba(51,65,85,0.25)', color: '#94a3b8' },
  };
  const colorSet = palette[normalized] || palette.unknown;

  return (
    <span
      style={{
        border: `1px solid ${colorSet.border}`,
        backgroundColor: colorSet.bg,
        color: colorSet.color,
        fontSize: '0.68rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderRadius: '999px',
        padding: '0.15rem 0.45rem',
      }}
    >
      {normalized}
    </span>
  );
}

ConfidenceBadge.displayName = 'ConfidenceBadge';

function SectionConfidencePanel({ summary }) {
  if (!Array.isArray(summary) || summary.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        marginBottom: '0.9rem',
        border: '1px solid #1e293b',
        borderRadius: '0.6rem',
        padding: '0.7rem',
        backgroundColor: '#020617',
      }}
    >
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.55rem' }}>
        Section-Level Confidence Panel
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '0.55rem' }}>
        {summary.map((item) => (
          <div
            key={item.key}
            style={{
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              padding: '0.5rem',
              backgroundColor: '#0f172a',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
              {RD_SECTION_LABELS[item.key] || item.key}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ConfidenceBadge level={item.level} />
              <span style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>{formatConfidence(item.score)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

SectionConfidencePanel.displayName = 'SectionConfidencePanel';

function EvidenceSpanRow({ span }) {
  const [open, setOpen] = useState(false);
  const lowConfidence = span.confidenceLevel === 'low';

  return (
    <div
      style={{
        border: `1px solid ${lowConfidence ? '#7f1d1d' : '#334155'}`,
        borderRadius: '0.55rem',
        padding: '0.55rem',
        backgroundColor: lowConfidence ? 'rgba(127,29,29,0.12)' : '#0f172a',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem' }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{span.section || 'general'}</div>
          <div style={{ marginTop: '0.1rem' }}>
            <ConfidenceBadge level={span.confidenceLevel} />
          </div>
        </div>
        <button type='button' style={chipStyle(false)} onClick={() => setOpen((value) => !value)}>
          {open ? 'Hide Span' : 'Show Span'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: '0.45rem', color: '#e2e8f0', fontSize: '0.78rem', lineHeight: 1.5 }}>
          {span.text}
        </div>
      )}
    </div>
  );
}

EvidenceSpanRow.displayName = 'EvidenceSpanRow';

export function RatingDecisionTab() {
  const { workflow, workspace, updateWorkspace } = useClaimWorkspace();

  const [activeTab, setActiveTab] = useState('upload');
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [uploadMessage, setUploadMessage] = useState('Awaiting upload.');
  const [uploadError, setUploadError] = useState('');
  const [draft, setDraft] = useState(() => createEmptyManualEntry());
  const [editingId, setEditingId] = useState(null);
  const [manualErrors, setManualErrors] = useState({});

  const section = workspace?.vaDecision || {};
  const manualEntries = Array.isArray(section?.manualEntries) ? section.manualEntries : [];
  const extractedFindings =
    section?.extractedFindings && typeof section.extractedFindings === 'object' && !Array.isArray(section.extractedFindings)
      ? section.extractedFindings
      : createEmptyExtractedFindings();
  const conflicts = Array.isArray(section?.conflicts) ? section.conflicts : [];

  const confidenceSummary = useMemo(
    () => buildSectionConfidenceSummary(extractedFindings),
    [extractedFindings]
  );
  const timelineRows = useMemo(() => buildRatingTimeline(section), [section]);

  const potentialUnratedConditions = useMemo(
    () =>
      (Array.isArray(workflow?.conditionReadiness) ? workflow.conditionReadiness : [])
        .filter((item) => !item?.alreadyRated)
        .map((item) => item?.condition)
        .filter(Boolean)
        .slice(0, 5),
    [workflow]
  );

  const hasResults =
    extractedFindings.combinedRating !== '' ||
    extractedFindings.serviceConnectedConditions?.length > 0 ||
    extractedFindings.deniedConditions?.length > 0 ||
    extractedFindings.smcAdjustments?.length > 0 ||
    extractedFindings.dependentAdjustments?.length > 0 ||
    extractedFindings.effectiveDates?.length > 0;

  const manualReviewRequired = Boolean(extractedFindings?.decisionMetadata?.requiresManualReview);
  const extractionWarnings = Array.isArray(extractedFindings?.decisionMetadata?.extractionWarnings)
    ? extractedFindings.decisionMetadata.extractionWarnings
    : [];

  const persistVaDecisionSection = (nextSection) => {
    updateWorkspace((current) => ({
      ...current,
      vaDecision: {
        ...(current?.vaDecision || {}),
        ...nextSection,
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const persistManualEntries = (entries, findings = extractedFindings) => {
    const deduped = dedupeManualEntries(entries);
    const nextConflicts = detectRatingConflicts(deduped, findings);
    persistVaDecisionSection({
      manualEntries: deduped,
      conflicts: nextConflicts,
    });
  };

  const persistExtractedFindings = (incomingFindings) => {
    const merged = mergeExtractedFindings(extractedFindings, incomingFindings);
    const nextConflicts = detectRatingConflicts(manualEntries, merged);
    persistVaDecisionSection({
      extractedFindings: merged,
      conflicts: nextConflicts,
    });
  };

  const handleUpload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const invalid = files.find((file) => !String(file?.name || '').toLowerCase().endsWith('.pdf'));
    if (invalid) {
      setUploadStatus('error');
      setUploadError('Only PDF files are allowed for VA rating decision uploads.');
      setUploadMessage('Upload failed.');
      return;
    }

    setUploadStatus('uploading');
    setUploadError('');
    setUploadMessage('Scanning documents...');

    try {
      let aggregated = extractedFindings;
      let manualReviewFlag = false;

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('scanType', 'ratingDecision');

        const response = await fetch('/api/scanner/scan-pdf', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error || `Scanner failed (${response.status})`);
        }

        const result = await response.json();
        if (!result?.success) {
          throw new Error(result?.error || 'Scanner returned unsuccessful result');
        }

        const normalized = normalizeRatingDecisionUploadResult(result, file.name);
        aggregated = mergeExtractedFindings(aggregated, normalized.findings);
        manualReviewFlag = manualReviewFlag || normalized.dependsOnManualReview;
      }

      persistExtractedFindings(aggregated);
      setUploadStatus('success');
      setUploadMessage(
        `Upload and extraction complete for ${files.length} file${files.length !== 1 ? 's' : ''}${manualReviewFlag ? ' (manual review flagged)' : ''}.`
      );
    } catch (error) {
      setUploadStatus('error');
      setUploadError(String(error?.message || 'Failed to upload and scan file.'));
      setUploadMessage('Upload failed.');
    }
  };

  const handleFileChange = async (event) => {
    await handleUpload(event?.target?.files || []);
    event.target.value = '';
  };

  const updateDraftField = (field, value) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
  };

  const handleAddSmcCode = () => {
    setDraft((previous) => ({
      ...previous,
      smcCodes: [...(Array.isArray(previous.smcCodes) ? previous.smcCodes : []), ''],
    }));
  };

  const handleSmcCodeChange = (index, value) => {
    setDraft((previous) => ({
      ...previous,
      smcCodes: (previous.smcCodes || []).map((item, i) => (i === index ? value : item)),
    }));
  };

  const handleRemoveSmcCode = (index) => {
    setDraft((previous) => ({
      ...previous,
      smcCodes: (previous.smcCodes || []).filter((_, i) => i !== index),
    }));
  };

  const resetDraft = () => {
    setDraft(createEmptyManualEntry());
    setEditingId(null);
    setManualErrors({});
  };

  const handleSaveManual = () => {
    const normalized = normalizeManualEntry(draft);
    const errors = validateManualEntry(normalized, manualEntries);
    setManualErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    if (editingId) {
      persistManualEntries(
        manualEntries.map((item) => (item.id === editingId ? { ...normalized, id: editingId } : item))
      );
      resetDraft();
      return;
    }

    persistManualEntries([...manualEntries, normalized]);
    resetDraft();
  };

  const handleEditManual = (entry) => {
    setEditingId(entry.id);
    setDraft({ ...createEmptyManualEntry(), ...entry });
    setManualErrors({});
    setActiveTab('manual');
  };

  const handleDeleteManual = (id) => {
    persistManualEntries(manualEntries.filter((item) => item.id !== id));
    if (editingId === id) {
      resetDraft();
    }
  };

  const combinedConditionsForBadges = [
    ...(Array.isArray(extractedFindings.serviceConnectedConditions)
      ? extractedFindings.serviceConnectedConditions
      : []),
    ...(Array.isArray(extractedFindings.deniedConditions) ? extractedFindings.deniedConditions : []),
  ];

  return (
    <div className='page-shell'>
      <section className='page-header'>
        <div>
          <div className='page-eyebrow'>Tab 05</div>
          <h1 className='page-title'>VA Rating Decision</h1>
          <p className='page-copy'>
            Upload VA rating decisions, extract adjudicative outputs, and compare scanner findings with
            manual entries before downstream workflow use.
          </p>
        </div>
        <div className='page-badge'>Adjudication metadata</div>
      </section>

      <WorkflowCarryForwardCard
        title='Step 05 Carry Forward'
        description='Identity and upstream evidence counts are carried forward to accelerate rating review.'
        items={[
          { label: 'Veteran', value: workflow?.profileSummary?.fullName, color: '#5eead4' },
          { label: 'Potential Unrated Conditions', value: potentialUnratedConditions },
          {
            label: 'STR Source Counts',
            value: `${Number(workflow?.strsSummary?.uploadedCount || 0)} uploads / ${Number(workflow?.strsSummary?.manualCount || 0)} manual`,
          },
          {
            label: 'Treatment Source Counts',
            value: `${Number(workflow?.treatmentSummary?.uploadedCount || 0)} uploads / ${Number(workflow?.treatmentSummary?.manualCount || 0)} manual`,
          },
        ]}
      />

      <div className='kb-tab-strip'>
        <button
          type='button'
          className={`kb-tab-btn${activeTab === 'upload' ? ' active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          Upload and Scan
        </button>
        <button
          type='button'
          className={`kb-tab-btn${activeTab === 'manual' ? ' active' : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          Manual Entry
        </button>
      </div>

      {activeTab === 'upload' && (
        <>
          <Card title='Upload and Analyze - VA Rating Decision'>
            <div style={{ display: 'grid', gap: '0.8rem' }}>
              <div>
                <label htmlFor='rd-upload-input' style={{ display: 'block', marginBottom: '0.4rem', color: '#cbd5e1' }}>
                  Upload VA Rating Decision PDF(s)
                </label>
                <input
                  id='rd-upload-input'
                  type='file'
                  accept='.pdf'
                  multiple
                  aria-label='Upload rating decision documents'
                  onChange={handleFileChange}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Status:</span>
                <span
                  style={{
                    ...chipStyle(true),
                    borderColor: STATUS_COLORS[uploadStatus],
                    color: STATUS_COLORS[uploadStatus],
                  }}
                >
                  {uploadStatus}
                </span>
                <span style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>{uploadMessage}</span>
              </div>

              {uploadError && (
                <div
                  style={{
                    border: '1px solid #7f1d1d',
                    borderRadius: '0.45rem',
                    padding: '0.65rem',
                    backgroundColor: 'rgba(127,29,29,0.1)',
                    color: '#fca5a5',
                    fontSize: '0.8rem',
                  }}
                >
                  {uploadError}
                </div>
              )}
            </div>
          </Card>

          {hasResults && (
            <Card title='Results - VA Rating Decision'>
              <div style={{ display: 'grid', gap: '0.95rem' }}>
                <SectionConfidencePanel summary={confidenceSummary} />

                <section style={{ borderBottom: '1px solid #1e293b', paddingBottom: '0.7rem' }}>
                  <h3 style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.45rem' }}>
                    1. Combined Rating and Decision Metadata
                  </h3>
                  <div style={{ color: '#e2e8f0', fontSize: '0.8rem', display: 'grid', gap: '0.3rem' }}>
                    <div>Combined Rating: {formatPercent(extractedFindings.combinedRating)}</div>
                    <div>Decision Date: {extractedFindings?.decisionMetadata?.ratingDecisionDate || 'N/A'}</div>
                    <div>Source File: {extractedFindings?.decisionMetadata?.fileName || 'N/A'}</div>
                  </div>
                </section>

                <section style={{ borderBottom: '1px solid #1e293b', paddingBottom: '0.7rem' }}>
                  <h3 style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.45rem' }}>
                    2. Service-Connected Conditions
                  </h3>
                  {(extractedFindings.serviceConnectedConditions || []).length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>None extracted</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.45rem' }}>
                      {extractedFindings.serviceConnectedConditions.map((item, index) => (
                        <div key={`sc-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: '#e2e8f0', fontSize: '0.78rem' }}>
                          <span>{item.conditionName}</span>
                          <span style={chipStyle(false)}>{formatPercent(item.percentage)}</span>
                          <span style={{ color: '#94a3b8' }}>{item.effectiveDate || 'No effective date'}</span>
                          <ConfidenceBadge level={item.confidenceLevel} />
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section style={{ borderBottom: '1px solid #1e293b', paddingBottom: '0.7rem' }}>
                  <h3 style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.45rem' }}>
                    3. Denied Conditions
                  </h3>
                  {(extractedFindings.deniedConditions || []).length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>None extracted</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.45rem' }}>
                      {extractedFindings.deniedConditions.map((item, index) => (
                        <div key={`dn-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: '#e2e8f0', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                          <span>{item.conditionName}</span>
                          {item.denialReason && <span style={{ color: '#fca5a5' }}>Reason: {item.denialReason}</span>}
                          <ConfidenceBadge level={item.confidenceLevel} />
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section style={{ borderBottom: '1px solid #1e293b', paddingBottom: '0.7rem' }}>
                  <h3 style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.45rem' }}>
                    4. SMC / Dependent Adjustments
                  </h3>
                  <div style={{ display: 'grid', gap: '0.45rem' }}>
                    <div style={{ color: '#e2e8f0', fontSize: '0.78rem' }}>
                      SMC: {(extractedFindings.smcAdjustments || []).map((item) => item.code).join(', ') || 'None'}
                    </div>
                    <div style={{ color: '#e2e8f0', fontSize: '0.78rem' }}>
                      Dependents: {(extractedFindings.dependentAdjustments || []).map((item) => item.label).join(', ') || 'None'}
                    </div>
                  </div>
                </section>

                <section style={{ borderBottom: '1px solid #1e293b', paddingBottom: '0.7rem' }}>
                  <h3 style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.45rem' }}>
                    5. Effective Dates
                  </h3>
                  {(extractedFindings.effectiveDates || []).length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>No effective dates extracted</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.45rem' }}>
                      {extractedFindings.effectiveDates.map((item, index) => (
                        <div key={`date-${index}`} style={{ color: '#e2e8f0', fontSize: '0.78rem', display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                          <span>{item.conditionName || 'Condition'}</span>
                          <span style={chipStyle(false)}>{item.effectiveDate}</span>
                          {item.percentage !== '' && <span>{formatPercent(item.percentage)}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {(extractedFindings.evidenceSpans || []).length > 0 && (
                  <section style={{ borderBottom: '1px solid #1e293b', paddingBottom: '0.7rem' }}>
                    <h3 style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.45rem' }}>
                      6. Evidence Span Trace Panel
                    </h3>
                    <div style={{ display: 'grid', gap: '0.55rem' }}>
                      {(extractedFindings.evidenceSpans || []).map((span) => (
                        <EvidenceSpanRow key={span.id} span={span} />
                      ))}
                    </div>
                  </section>
                )}

                {(manualReviewRequired || extractionWarnings.length > 0 || conflicts.length > 0) && (
                  <section style={{ borderBottom: '1px solid #1e293b', paddingBottom: '0.7rem' }}>
                    <h3 style={{ fontSize: '0.82rem', color: '#fcd34d', marginBottom: '0.45rem' }}>
                      7. Manual Review Warning Block
                    </h3>
                    <div style={{ display: 'grid', gap: '0.45rem', color: '#fde68a', fontSize: '0.78rem' }}>
                      {manualReviewRequired && <div>Scanner quality checks flagged this result for manual review.</div>}
                      {extractionWarnings.map((warning, index) => (
                        <div key={`warn-${index}`}>{warning}</div>
                      ))}
                      {conflicts.length > 0 && (
                        <div>{conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected between manual and scanned data.</div>
                      )}
                    </div>
                  </section>
                )}

                <section>
                  <h3 style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.45rem' }}>
                    8. Per-Condition Confidence Badges
                  </h3>
                  {combinedConditionsForBadges.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>No condition confidence data available.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.45rem' }}>
                      {combinedConditionsForBadges.map((item, index) => (
                        <div key={`badge-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: '#e2e8f0', fontSize: '0.78rem' }}>
                          <span>{item.conditionName}</span>
                          <ConfidenceBadge level={item.confidenceLevel} />
                          <span style={{ color: '#94a3b8' }}>{formatConfidence(item.confidenceScore)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </Card>
          )}

          {conflicts.length > 0 && (
            <Card title='Conflict Detector'>
              <div style={{ display: 'grid', gap: '0.55rem' }}>
                {conflicts.map((conflict) => (
                  <div
                    key={conflict.id}
                    style={{
                      border: '1px solid #7f1d1d',
                      borderRadius: '0.55rem',
                      padding: '0.6rem',
                      backgroundColor: 'rgba(127,29,29,0.12)',
                    }}
                  >
                    <div style={{ color: '#fca5a5', fontSize: '0.8rem', fontWeight: 700 }}>
                      {conflict.conditionName} - {conflict.conflictType}
                    </div>
                    <div style={{ color: '#e2e8f0', fontSize: '0.77rem', marginTop: '0.2rem' }}>
                      {conflict.message}
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: '0.73rem', marginTop: '0.25rem' }}>
                      Manual: {conflict.manualValue} | Scanned: {conflict.scannedValue}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {timelineRows.length > 0 && (
            <Card title='Rating Timeline Visualization'>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                {timelineRows.map((row) => (
                  <div key={row.conditionName} style={{ border: '1px solid #334155', borderRadius: '0.55rem', padding: '0.65rem', backgroundColor: '#0f172a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.45rem' }}>
                      <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.8rem' }}>{row.conditionName}</span>
                      {row.staged && <span style={chipStyle(true)}>Staged Rating</span>}
                    </div>
                    <div style={{ display: 'grid', gap: '0.4rem' }}>
                      {row.events.map((event, index) => (
                        <div key={`${row.conditionName}-${index}`} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', color: '#cbd5e1', fontSize: '0.76rem' }}>
                          <span style={chipStyle(false)}>{event.effectiveDate}</span>
                          <span>{event.isDenied ? 'Denied' : formatPercent(event.percentage)}</span>
                          <span style={{ color: '#94a3b8' }}>{event.source}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {activeTab === 'manual' && (
        <>
          <Card title='Manual VA Disability Entry'>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '0.65rem' }}>
                <div>
                  <label style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>Condition Name</label>
                  <input
                    type='text'
                    aria-label='Condition name'
                    value={draft.conditionName}
                    onChange={(event) => updateDraftField('conditionName', event.target.value)}
                    style={inputStyle}
                  />
                  {manualErrors.conditionName && <div style={{ color: '#f87171', fontSize: '0.72rem' }}>{manualErrors.conditionName}</div>}
                </div>
                <div>
                  <label style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>Percentage</label>
                  <select
                    aria-label='Percentage'
                    value={draft.percentage}
                    onChange={(event) => updateDraftField('percentage', event.target.value)}
                    style={inputStyle}
                  >
                    <option value=''>Select</option>
                    {RD_PERCENT_OPTIONS.map((value) => (
                      <option key={value} value={value}>{`${value}%`}</option>
                    ))}
                  </select>
                  {manualErrors.percentage && <div style={{ color: '#f87171', fontSize: '0.72rem' }}>{manualErrors.percentage}</div>}
                </div>
                <div>
                  <label style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>Effective Date</label>
                  <input
                    type='date'
                    aria-label='Effective date'
                    value={draft.effectiveDate}
                    onChange={(event) => updateDraftField('effectiveDate', event.target.value)}
                    style={inputStyle}
                  />
                  {manualErrors.effectiveDate && <div style={{ color: '#f87171', fontSize: '0.72rem' }}>{manualErrors.effectiveDate}</div>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <label style={{ color: '#cbd5e1', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <input
                    type='checkbox'
                    checked={Boolean(draft.isServiceConnected)}
                    aria-label='Is service connected'
                    onChange={(event) => updateDraftField('isServiceConnected', event.target.checked)}
                  />
                  Service Connected
                </label>
                <label style={{ color: '#cbd5e1', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <input
                    type='checkbox'
                    checked={Boolean(draft.isDenied)}
                    aria-label='Is denied'
                    onChange={(event) => updateDraftField('isDenied', event.target.checked)}
                  />
                  Denied
                </label>
              </div>

              {manualErrors.serviceConnection && (
                <div style={{ color: '#f87171', fontSize: '0.72rem' }}>{manualErrors.serviceConnection}</div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div>
                  <label style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>Denial Reason (optional)</label>
                  <input
                    type='text'
                    aria-label='Denial reason'
                    value={draft.denialReason}
                    onChange={(event) => updateDraftField('denialReason', event.target.value)}
                    style={inputStyle}
                  />
                  {manualErrors.denialReason && <div style={{ color: '#f87171', fontSize: '0.72rem' }}>{manualErrors.denialReason}</div>}
                </div>
                <div>
                  <label style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>Dependents (optional)</label>
                  <input
                    type='text'
                    aria-label='Dependents'
                    value={draft.dependents}
                    onChange={(event) => updateDraftField('dependents', event.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div>
                  <label style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>Combined Rating (optional)</label>
                  <select
                    aria-label='Combined rating'
                    value={draft.combinedRating}
                    onChange={(event) => updateDraftField('combinedRating', event.target.value)}
                    style={inputStyle}
                  >
                    <option value=''>Select</option>
                    {RD_PERCENT_OPTIONS.map((value) => (
                      <option key={`combined-${value}`} value={value}>{`${value}%`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ color: '#cbd5e1', fontSize: '0.78rem', marginBottom: '0.3rem' }}>SMC Codes (optional)</div>
                  <div style={{ display: 'grid', gap: '0.45rem' }}>
                    {(Array.isArray(draft.smcCodes) ? draft.smcCodes : []).map((code, index) => (
                      <div key={`smc-${index}`} style={{ display: 'flex', gap: '0.45rem' }}>
                        <input
                          type='text'
                          value={code}
                          aria-label={`SMC code ${index + 1}`}
                          onChange={(event) => handleSmcCodeChange(index, event.target.value)}
                          style={inputStyle}
                        />
                        <button type='button' style={chipStyle(false)} onClick={() => handleRemoveSmcCode(index)}>
                          Remove
                        </button>
                      </div>
                    ))}
                    <button type='button' style={chipStyle(false)} onClick={handleAddSmcCode} aria-label='Add SMC code'>
                      + Add SMC Code
                    </button>
                  </div>
                </div>
              </div>

              {manualErrors.duplicate && <div style={{ color: '#f87171', fontSize: '0.72rem' }}>{manualErrors.duplicate}</div>}

              <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                <button type='button' className='btn-primary' onClick={handleSaveManual}>
                  {editingId ? 'Update Entry' : 'Add Entry'}
                </button>
                {editingId && (
                  <button type='button' style={chipStyle(false)} onClick={resetDraft}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
          </Card>

          {manualEntries.length > 0 && (
            <Card title='Saved Manual Entries'>
              <div style={{ display: 'grid', gap: '0.55rem' }}>
                {manualEntries.map((entry) => (
                  <div key={entry.id} style={{ border: '1px solid #334155', borderRadius: '0.55rem', padding: '0.6rem', backgroundColor: '#0f172a' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.65rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.8rem' }}>{normalizeConditionName(entry.conditionName)}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.74rem', marginTop: '0.25rem' }}>
                          {formatPercent(entry.percentage)} | {entry.effectiveDate || 'No effective date'} | {entry.isDenied ? 'Denied' : entry.isServiceConnected ? 'Service Connected' : 'Unspecified'}
                        </div>
                        {entry.denialReason && (
                          <div style={{ color: '#fca5a5', fontSize: '0.73rem', marginTop: '0.2rem' }}>
                            Denial reason: {entry.denialReason}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button type='button' style={chipStyle(false)} aria-label={`Edit ${entry.conditionName}`} onClick={() => handleEditManual(entry)}>
                          Edit
                        </button>
                        <button type='button' style={chipStyle(false)} aria-label={`Delete ${entry.conditionName}`} onClick={() => handleDeleteManual(entry.id)}>
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
    </div>
  );
}
