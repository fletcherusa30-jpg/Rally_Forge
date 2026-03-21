import { useMemo, useState } from 'react';
import { Card } from '../../components/Card.jsx';
import { WorkflowCarryForwardCard } from '../../components/WorkflowCarryForwardCard.jsx';
import { getStrsJobStatus } from '../../api/client.js';
import { useClaimWorkspace } from '../../context/ClaimWorkspaceContext.jsx';
import { startScannerActivity, updateScannerActivity } from '../../components/scanner/scannerActivityStore.js';
import {
  buildConditionWorkspaceDraft,
  buildConfidenceLevels,
  buildDedupedTimeline,
  dedupeFindings,
  normalizeManualEntry,
  normalizeUploadResultToFindings,
  validateManualEntry,
} from './normalization.js';
import {
  createEmptyManualEntry,
  STR_CATEGORY_LABELS,
  STR_CONFIDENCE_LEVELS,
  STR_FINDING_TYPES,
} from './schema.js';

const FILTER_OPTIONS = ['all', ...STR_CONFIDENCE_LEVELS];
const CardComponent = Card;
const CarryForwardCardComponent = WorkflowCarryForwardCard;
void CardComponent;
void CarryForwardCardComponent;

function deriveAllFindings(section = {}) {
  const extractedFindings = Array.isArray(section?.extractedFindings) ? section.extractedFindings : [];
  const manualEntries = Array.isArray(section?.manualEntries) ? section.manualEntries.map((entry) => normalizeManualEntry(entry)) : [];

  if (extractedFindings.length > 0) {
    return dedupeFindings([...extractedFindings, ...manualEntries]);
  }

  const legacyUpload = Array.isArray(section?.uploadedDocuments) ? section.uploadedDocuments : [];
  const uploadFindings = legacyUpload.flatMap((document) => normalizeUploadResultToFindings(document));
  return dedupeFindings([...uploadFindings, ...manualEntries]);
}

function hearingSignals(findings = []) {
  const hearingPattern = /(hearing|tinnitus|audiogram|audiology|threshold shift|significant threshold shift|sts|acoustic trauma)/i;
  const hearingFindings = findings.filter((finding) => {
    const text = `${finding?.conditionName || ''} ${finding?.description || ''}`;
    return hearingPattern.test(text);
  });

  return {
    hearingFindings,
    count: hearingFindings.length,
    requiresFocusedReview: findings.length > 0 && hearingFindings.length === 0,
  };
}

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

function getTypeLabel(type) {
  return STR_CATEGORY_LABELS[type] || type;
}

function FindingRow({ finding, onQuickAction }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        padding: '0.75rem',
        borderRadius: '0.55rem',
        border: '1px solid #334155',
        backgroundColor: '#0f172a',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div>
          <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.86rem' }}>{finding.conditionName}</div>
          <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.2rem' }}>
            {getTypeLabel(finding.findingType)}
            {finding.dateOfEvent ? ` · ${finding.dateOfEvent}` : ''}
            {finding.sourceFileName ? ` · ${finding.sourceFileName}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={chipStyle(true)}>{finding.confidenceLevel}</span>
          <button type='button' onClick={() => setOpen((value) => !value)} style={chipStyle(false)}>
            {open ? 'Hide details' : 'Show details'}
          </button>
          <button type='button' onClick={() => onQuickAction(finding)} style={chipStyle(false)}>
            Convert to Condition Draft
          </button>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: '0.7rem', borderTop: '1px solid #1e293b', paddingTop: '0.65rem', display: 'grid', gap: '0.4rem' }}>
          {finding.description && <div style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>{finding.description}</div>}
          {finding.provider && <div style={{ color: '#94a3b8', fontSize: '0.73rem' }}>Provider: {finding.provider}</div>}
          {Array.isArray(finding.dates) && finding.dates.length > 1 && (
            <div style={{ color: '#94a3b8', fontSize: '0.73rem' }}>Timeline dates: {finding.dates.join(', ')}</div>
          )}
          {Array.isArray(finding.allOccurrences) && finding.allOccurrences.length > 0 && (
            <div style={{ color: '#94a3b8', fontSize: '0.73rem' }}>
              Occurrences: {finding.allOccurrences.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
FindingRow.displayName = 'FindingRow';

export function StrsTab() {
  const { workspace, workflow, updateWorkspace } = useClaimWorkspace();

  const [activeTab, setActiveTab] = useState('upload');
  const [activeConfidenceFilter, setActiveConfidenceFilter] = useState('all');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [manualDraft, setManualDraft] = useState(createEmptyManualEntry());
  const [manualErrors, setManualErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [expandedHearingReview, setExpandedHearingReview] = useState(false);

  const section = useMemo(() => workspace?.serviceTreatmentRecords || {}, [workspace?.serviceTreatmentRecords]);
  const allFindings = useMemo(() => deriveAllFindings(section), [section]);
  const confidenceLevels = useMemo(() => buildConfidenceLevels(allFindings), [allFindings]);
  const mergedTimeline = useMemo(() => buildDedupedTimeline(allFindings), [allFindings]);
  const hearingReview = useMemo(() => hearingSignals(allFindings), [allFindings]);

  const manualEntries = useMemo(() => allFindings.filter((entry) => entry.manualEntry), [allFindings]);
  const filteredFindings = useMemo(() => {
    if (activeConfidenceFilter === 'all') {
      return allFindings;
    }
    return allFindings.filter((finding) => finding.confidenceLevel === activeConfidenceFilter);
  }, [activeConfidenceFilter, allFindings]);

  const persistSection = (nextFindings) => {
    const deduped = dedupeFindings(nextFindings);
    const nextManualEntries = deduped.filter((entry) => entry.manualEntry).map((entry) => ({
      id: entry.id,
      findingType: entry.findingType,
      conditionName: entry.conditionName,
      dateOfEvent: entry.dateOfEvent,
      description: entry.description,
      provider: entry.provider,
      severity: entry.severity || 'moderate',
      confidenceLevel: 'manual',
      exposureType: entry.exposureType || '',
      lineOfDuty: entry.lineOfDuty || 'Yes',
      inServiceEvent: entry.inServiceEvent !== false,
      chronicityEvidence: entry.chronicityEvidence || '',
      continuityNotes: entry.continuityNotes || '',
      nexusIndicators: entry.nexusIndicators || '',
      manualEntry: true,
    }));
    const nextConfidenceLevels = buildConfidenceLevels(deduped);

    updateWorkspace((current) => ({
      ...current,
      serviceTreatmentRecords: {
        ...(current?.serviceTreatmentRecords || {}),
        extractedFindings: deduped,
        manualEntries: nextManualEntries,
        confidenceLevels: nextConfidenceLevels,
        summary: {
          uploadedCount: deduped.filter((entry) => !entry.manualEntry).length,
          manualCount: nextManualEntries.length,
        },
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const waitForQueuedJob = async (jobId, fileName, activityId) => {
    const maxAttempts = 80;
    const intervalMs = 1500;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const status = await getStrsJobStatus(jobId);
      const state = String(status?.status || '').toLowerCase();
      const progress = Number(status?.progress || 0);

      setStatusMessage(`Processing ${fileName}: ${Math.max(0, Math.min(100, progress))}%`);
      updateScannerActivity(activityId, {
        status: state === 'completed' ? 'completed' : state === 'failed' ? 'failed' : 'processing',
        progress: Math.max(0, Math.min(100, progress)),
        message: `STR queued job ${jobId}: ${state || 'queued'}`,
      });

      if (state === 'completed') {
        return status?.result || null;
      }

      if (state === 'failed') {
        throw new Error(`${fileName}: queued processing failed`);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`${fileName}: timed out waiting for scanner queue`);
  };

  const handleUpload = async (filesToUpload) => {
    if (!Array.isArray(filesToUpload) || filesToUpload.length === 0) {
      return;
    }

    setUploading(true);
    setErrorMessage('');
    setStatusMessage('Starting upload...');

    try {
      const uploadResults = [];

      for (const selectedFile of filesToUpload) {
        const activityId = startScannerActivity({
          scannerType: 'service-treatment-records',
          fileName: selectedFile.name,
          message: 'Uploading STR document',
        });

        const formData = new FormData();
        formData.append('strs', selectedFile);

        const response = await fetch('/api/strs/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          updateScannerActivity(activityId, {
            status: 'failed',
            progress: 100,
            message: `Upload failed (${response.status})`,
          });
          throw new Error(`${selectedFile.name}: upload failed`);
        }

        const data = await response.json();

        if (data?.status === 'queued' && data?.jobId) {
          const queued = await waitForQueuedJob(data.jobId, selectedFile.name, activityId);
          uploadResults.push({
            ...queued,
            metadata: {
              ...(queued?.metadata || {}),
              fileName: queued?.metadata?.fileName || selectedFile.name,
              jobId: data.jobId,
            },
          });
        } else if (data?.status === 'fallback_sync') {
          const syncFormData = new FormData();
          syncFormData.append('strs', selectedFile);

          const syncResponse = await fetch('/api/strs/upload-sync', {
            method: 'POST',
            body: syncFormData,
          });

          if (!syncResponse.ok) {
            throw new Error(`${selectedFile.name}: sync processing failed`);
          }

          const syncResult = await syncResponse.json();
          uploadResults.push({
            ...syncResult,
            metadata: {
              ...(syncResult?.metadata || {}),
              fileName: syncResult?.metadata?.fileName || selectedFile.name,
            },
          });
        } else {
          uploadResults.push({
            ...data,
            metadata: {
              ...(data?.metadata || {}),
              fileName: data?.metadata?.fileName || selectedFile.name,
            },
          });
        }

        updateScannerActivity(activityId, {
          status: 'completed',
          progress: 100,
          message: 'STR processing complete',
        });
      }

      const uploadFindings = uploadResults.flatMap((result) => normalizeUploadResultToFindings(result));
      persistSection([...allFindings, ...uploadFindings]);
      setStatusMessage(`Processed ${uploadResults.length} STR file${uploadResults.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setErrorMessage(error?.message || 'Upload failed.');
      setStatusMessage('');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
    if (files.length > 0) {
      handleUpload(files);
    }
  };

  const handleManualAdd = () => {
    const errors = validateManualEntry(manualDraft);
    if (Object.keys(errors).length > 0) {
      setManualErrors(errors);
      return;
    }

    const normalized = normalizeManualEntry(manualDraft);
    persistSection([...allFindings, normalized]);
    setManualDraft(createEmptyManualEntry({
      findingType: manualDraft.findingType,
      provider: manualDraft.provider,
      inServiceEvent: manualDraft.inServiceEvent,
    }));
    setManualErrors({});
    setStatusMessage('Manual STR entry saved.');
  };

  const handleQuickAction = (finding) => {
    const draft = buildConditionWorkspaceDraft(finding);
    if (!draft) {
      return;
    }

    updateWorkspace((current) => {
      const currentTreatment = current?.currentTreatment || {};
      const manualEntries = Array.isArray(currentTreatment?.manualEntries) ? currentTreatment.manualEntries : [];
      const alreadyExists = manualEntries.some((entry) => {
        return String(entry?.conditionName || '').trim().toLowerCase() === draft.conditionName.toLowerCase()
          && String(entry?.diagnosisDate || '').trim() === String(draft.diagnosisDate || '').trim();
      });

      if (alreadyExists) {
        return current;
      }

      const nextManualEntries = [...manualEntries, draft];

      return {
        ...current,
        currentTreatment: {
          ...currentTreatment,
          manualEntries: nextManualEntries,
          summary: {
            ...(currentTreatment?.summary || {}),
            manualCount: nextManualEntries.length,
          },
          updatedAt: new Date().toISOString(),
        },
      };
    });

    setStatusMessage('Converted to Current Treatment condition draft.');
  };

  const renderUploadPanel = () => (
    <CardComponent title='Upload Service Treatment Records'>
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ color: '#cbd5e1', fontSize: '0.82rem' }}>
          Required extraction categories: Diagnoses, Injuries, In-Service Events, Presumptive Location Signals.
        </div>

        <input
          aria-label='Upload STR files'
          type='file'
          multiple
          accept='.pdf,.txt'
          onChange={handleFileChange}
          disabled={uploading}
          style={{
            display: 'block',
            width: '100%',
            border: '1px solid #334155',
            borderRadius: '0.5rem',
            padding: '0.55rem',
            backgroundColor: '#0f172a',
            color: '#cbd5e1',
            fontSize: '0.8rem',
          }}
        />

        {selectedFiles.length > 0 && (
          <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
            {selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} selected.
          </div>
        )}

        {statusMessage && !errorMessage && (
          <div style={{ border: '1px solid #0d5f49', backgroundColor: '#0f3b2e', color: '#99f6e4', padding: '0.65rem', borderRadius: '0.45rem', fontSize: '0.76rem' }}>
            {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div style={{ border: '1px solid #7f1d1d', backgroundColor: '#7f1d1d33', color: '#fecaca', padding: '0.65rem', borderRadius: '0.45rem', fontSize: '0.76rem' }}>
            {errorMessage}
          </div>
        )}
      </div>
    </CardComponent>
  );

  const renderManualPanel = () => (
    <>
      <CardComponent title='Manual Entry - Symptoms, Disabilities, and Events'>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
            <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              Finding Type
              <select
                aria-label='Manual finding type'
                value={manualDraft.findingType}
                onChange={(event) => setManualDraft((current) => ({ ...current, findingType: event.target.value }))}
                style={{ border: '1px solid #334155', borderRadius: '0.4rem', backgroundColor: '#0f172a', color: '#e2e8f0', padding: '0.45rem' }}
              >
                {STR_FINDING_TYPES.map((type) => <option key={type} value={type}>{getTypeLabel(type)}</option>)}
              </select>
            </label>

            <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              Date of Event
              <input
                aria-label='Manual date of event'
                type='date'
                value={manualDraft.dateOfEvent}
                onChange={(event) => setManualDraft((current) => ({ ...current, dateOfEvent: event.target.value }))}
                style={{ border: `1px solid ${manualErrors.dateOfEvent ? '#ef4444' : '#334155'}`, borderRadius: '0.4rem', backgroundColor: '#0f172a', color: '#e2e8f0', padding: '0.45rem' }}
              />
              {manualErrors.dateOfEvent && <span style={{ color: '#fca5a5', fontSize: '0.7rem' }}>{manualErrors.dateOfEvent}</span>}
            </label>
          </div>

          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.75rem', color: '#94a3b8' }}>
            Condition / Finding Name
            <input
              aria-label='Manual condition name'
              type='text'
              value={manualDraft.conditionName}
              onChange={(event) => setManualDraft((current) => ({ ...current, conditionName: event.target.value }))}
              style={{ border: `1px solid ${manualErrors.conditionName ? '#ef4444' : '#334155'}`, borderRadius: '0.4rem', backgroundColor: '#0f172a', color: '#e2e8f0', padding: '0.45rem' }}
            />
            {manualErrors.conditionName && <span style={{ color: '#fca5a5', fontSize: '0.7rem' }}>{manualErrors.conditionName}</span>}
          </label>

          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.75rem', color: '#94a3b8' }}>
            Description
            <textarea
              aria-label='Manual description'
              rows={3}
              value={manualDraft.description}
              onChange={(event) => setManualDraft((current) => ({ ...current, description: event.target.value }))}
              style={{ border: `1px solid ${manualErrors.description ? '#ef4444' : '#334155'}`, borderRadius: '0.4rem', backgroundColor: '#0f172a', color: '#e2e8f0', padding: '0.45rem' }}
            />
            {manualErrors.description && <span style={{ color: '#fca5a5', fontSize: '0.7rem' }}>{manualErrors.description}</span>}
          </label>

          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.75rem', color: '#94a3b8' }}>
            Provider (optional)
            <input
              aria-label='Manual provider'
              type='text'
              value={manualDraft.provider}
              onChange={(event) => setManualDraft((current) => ({ ...current, provider: event.target.value }))}
              style={{ border: '1px solid #334155', borderRadius: '0.4rem', backgroundColor: '#0f172a', color: '#e2e8f0', padding: '0.45rem' }}
            />
          </label>

          <button type='button' onClick={handleManualAdd} style={chipStyle(true)}>
            Save Manual Entry
          </button>
        </div>
      </CardComponent>

      <CardComponent title='Saved Manual Entries'>
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.76rem' }}>{manualEntries.length} manual entr{manualEntries.length === 1 ? 'y' : 'ies'} saved</div>
          {manualEntries.length === 0 && <div style={{ color: '#64748b', fontSize: '0.75rem' }}>No manual entries saved yet.</div>}
          {manualEntries.map((entry) => (
            <div key={entry.id} style={{ border: '1px solid #334155', borderRadius: '0.45rem', padding: '0.6rem', backgroundColor: '#0f172a' }}>
              <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.83rem' }}>{entry.conditionName}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{entry.dateOfEvent || 'No date'} · {getTypeLabel(entry.findingType)}</div>
              {entry.description && <div style={{ color: '#cbd5e1', fontSize: '0.77rem', marginTop: '0.25rem' }}>{entry.description}</div>}
            </div>
          ))}
        </div>
      </CardComponent>
    </>
  );

  return (
    <div className='page-shell'>
      <section className='page-header'>
        <div>
          <div className='page-eyebrow'>Tab 03</div>
          <h1 className='page-title'>Service Treatment Records</h1>
          <p className='page-copy'>Capture and validate in-service medical evidence, then convert findings directly into claim-ready condition drafts.</p>
        </div>
        <div className='page-badge'>Extraction workflow</div>
      </section>

      <CarryForwardCardComponent
        title='Carry Forward Context'
        description='Service identity and exposures are inherited from Military Service to reduce repeat entry and support STR review confidence.'
        items={[
          { label: 'Veteran', value: workflow?.profileSummary?.fullName, color: '#5eead4' },
          { label: 'Branches', value: workflow?.serviceSummary?.branches || [] },
          { label: 'MOS', value: workflow?.serviceSummary?.mosCodes || [] },
          { label: 'Presumptive Matches', value: workflow?.serviceSummary?.presumptiveMatches ? `${workflow.serviceSummary.presumptiveMatches}` : '' },
        ]}
      />

      <CardComponent title='Hearing Loss and Threshold Shift Review'>
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <div style={{ color: hearingReview.requiresFocusedReview ? '#fbbf24' : '#86efac', fontSize: '0.8rem', fontWeight: 600 }}>
            {hearingReview.requiresFocusedReview ? 'Focused review needed: no hearing-related findings detected.' : 'Review check passed: hearing-related findings detected.'}
          </div>
          <button type='button' onClick={() => setExpandedHearingReview((value) => !value)} style={chipStyle(false)}>
            {expandedHearingReview ? 'Hide review details' : 'Show review details'}
          </button>
          {expandedHearingReview && (
            <div style={{ borderTop: '1px solid #334155', paddingTop: '0.55rem', color: '#94a3b8', fontSize: '0.76rem', display: 'grid', gap: '0.35rem' }}>
              <div>Total hearing-related findings: {hearingReview.count}</div>
              {hearingReview.hearingFindings.slice(0, 5).map((finding) => (
                <div key={finding.id}>{finding.conditionName}{finding.dateOfEvent ? ` (${finding.dateOfEvent})` : ''}</div>
              ))}
            </div>
          )}
        </div>
      </CardComponent>

      <div className='kb-tab-strip'>
        <button className={`kb-tab-btn${activeTab === 'upload' ? ' active' : ''}`} onClick={() => setActiveTab('upload')}>File Upload</button>
        <button className={`kb-tab-btn${activeTab === 'manual' ? ' active' : ''}`} onClick={() => setActiveTab('manual')}>Manual Entry</button>
      </div>

      {activeTab === 'upload' ? renderUploadPanel() : renderManualPanel()}

      <CardComponent title='Confidence Filters'>
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          {FILTER_OPTIONS.map((option) => {
            const count = option === 'all'
              ? allFindings.length
              : Number(confidenceLevels?.[option] || 0);
            return (
              <button
                key={option}
                type='button'
                onClick={() => setActiveConfidenceFilter(option)}
                style={chipStyle(activeConfidenceFilter === option)}
              >
                {option} ({count})
              </button>
            );
          })}
        </div>
      </CardComponent>

      {filteredFindings.length > 0 && (
        <CardComponent title='Extracted Findings'>
          <div style={{ display: 'grid', gap: '0.65rem' }}>
            {filteredFindings.map((finding) => (
              <FindingRow key={finding.id} finding={finding} onQuickAction={handleQuickAction} />
            ))}
          </div>
        </CardComponent>
      )}

      {mergedTimeline.length > 0 && (
        <CardComponent title='Merged Timeline'>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {mergedTimeline.map((point, index) => (
              <div key={`${point.date}-${point.label}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.65rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.35rem' }}>
                <div style={{ color: '#e2e8f0', fontSize: '0.8rem' }}>{point.label}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{point.date} · {getTypeLabel(point.findingType)}</div>
              </div>
            ))}
          </div>
        </CardComponent>
      )}
    </div>
  );
}
