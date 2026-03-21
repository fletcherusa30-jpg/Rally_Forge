import { useEffect, useMemo, useRef, useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { Card } from '../../components/Card.jsx';
// eslint-disable-next-line no-unused-vars
import { WorkflowCarryForwardCard } from '../../components/WorkflowCarryForwardCard.jsx';
import { getPresumptiveKnowledge } from '../../api/client.js';
import { useClaimWorkspace } from '../../context/ClaimWorkspaceContext.jsx';
import { getDropdownLocations } from '../../utils/presumptiveMatching.js';
import { buildExposureSuggestions } from './analyzer.js';
import {
  buildExtractedVsCurrentDiff,
  buildExtractionConfidence,
  extractDd214Panels,
  mapExtractedToMilitaryForm,
} from './extraction.js';
import { DD214_GLOSSARY_LINKS, validateGlossaryLinks } from './glossary.js';
import {
  dedupeCaseInsensitive,
  inferServiceEra,
  isValidMosCode,
  normalizeDeploymentLocation,
  normalizeDeploymentLocations,
  normalizeMosCode,
  validateMilitaryServiceForm,
} from './normalization.js';
import {
  BRANCH_VALUES,
  createEmptyMilitaryServiceForm,
  DISCHARGE_TYPE_VALUES,
  SERVICE_TYPE_VALUES,
} from './schema.js';

const STORAGE_KEY = 'militaryServiceRecords';

function toBadgeColor(confidence) {
  if (confidence == null) return '#64748b';
  if (confidence >= 0.85) return '#0f766e';
  if (confidence >= 0.65) return '#a16207';
  return '#991b1b';
}

function confidenceText(confidence) {
  if (confidence == null) return 'N/A';
  return `${Math.round(confidence * 100)}%`;
}

function toPerFieldRows(fieldConfidence) {
  return [
    ['Branch', fieldConfidence.branchOfService],
    ['Service Type', fieldConfidence.serviceType],
    ['Start Date', fieldConfidence.startDate],
    ['End Date', fieldConfidence.endDate],
    ['Rank/Rate', fieldConfidence.rankRate],
    ['Discharge Type', fieldConfidence.dischargeType],
    ['Primary MOS', fieldConfidence.primaryMOS],
    ['Deployments', fieldConfidence.deploymentLocations],
    ['Hazard Indicators', fieldConfidence.hazardPayIndicators],
    ['SPD Code', fieldConfidence.spdCode],
    ['RE Code', fieldConfidence.reCode],
    ['Separation Authority', fieldConfidence.separationAuthority],
  ];
}

function createPanelEntries(panels) {
  if (!panels) {
    return [];
  }

  return [
    {
      title: 'Service Profile',
      items: [
        ['Branch', panels.serviceProfile.branch],
        ['Service Type', panels.serviceProfile.serviceType || panels.serviceProfile.component],
        ['Entry Date', panels.serviceProfile.entryDate],
        ['Separation Date', panels.serviceProfile.separationDate],
        ['Rank/Rate', panels.serviceProfile.rankRate],
        ['Primary MOS', panels.serviceProfile.primaryMOS],
        ['Secondary MOS', panels.serviceProfile.secondaryMOS],
      ],
      conditional: false,
    },
    {
      title: 'Discharge & Separation',
      items: [
        ['Discharge', panels.dischargeAndSeparation.dischargeType],
        ['SPD Code', panels.dischargeAndSeparation.spdCode],
        ['RE Code', panels.dischargeAndSeparation.reCode],
        ['Separation Authority', panels.dischargeAndSeparation.separationAuthority],
        ['Narrative Reason', panels.dischargeAndSeparation.narrativeReason],
      ],
      conditional: false,
    },
    {
      title: 'Combat & Benefits',
      items: [
        ['Combat Veteran', panels.combatAndBenefits.combatVeteran ? 'Yes' : 'No'],
        ['Foreign Service', panels.combatAndBenefits.foreignService],
        ['Station at Separation', panels.combatAndBenefits.stationAtSeparation],
      ],
      conditional: false,
    },
    {
      title: 'Hazard & Deployment Pay',
      items: dedupeCaseInsensitive(panels.hazardAndDeploymentPay.hazardIndicators || []).map((item) => ['Indicator', item]),
      conditional: false,
    },
    {
      title: 'Installation Exposure Indicators',
      items: (panels.installationExposureIndicators || []).map((item) => ['Exposure', item]),
      conditional: true,
    },
    {
      title: 'Badges & Awards',
      items: (panels.badgesAndAwards || []).map((item) => ['Award', item]),
      conditional: true,
    },
    {
      title: 'Extended Service Data',
      items: [
        ['Prior Active Service', panels.extendedServiceData.priorActiveService],
        ['Prior Inactive Service', panels.extendedServiceData.priorInactiveService],
        ['Sea Service', panels.extendedServiceData.seaService],
        ['Accrued Leave Paid', String(panels.extendedServiceData.accruedLeavePaid || '')],
        ['Initial Entry Training', panels.extendedServiceData.initialEntryTraining?.completed == null
          ? ''
          : panels.extendedServiceData.initialEntryTraining.completed
            ? 'Completed'
            : 'Not Completed'],
      ],
      conditional: true,
    },
    {
      title: 'Transfer & Assignment',
      items: [
        ['Last Duty Assignment', panels.transferAndAssignment.lastDutyAssignment],
        ['Major Command', panels.transferAndAssignment.majorCommand],
        ['Transfer Command', panels.transferAndAssignment.transferCommand],
        ['Reenlistments', String((panels.transferAndAssignment.reenlistments || []).length)],
      ],
      conditional: true,
    },
  ];
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatDurationParts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const hasDurationKeys = ['years', 'months', 'days'].some((key) => value[key] != null);
  if (!hasDurationKeys) {
    return null;
  }

  const parts = [
    ['year', Number(value.years || 0)],
    ['month', Number(value.months || 0)],
    ['day', Number(value.days || 0)],
  ]
    .filter(([, amount]) => Number.isFinite(amount) && amount > 0)
    .map(([unit, amount]) => `${amount} ${unit}${amount === 1 ? '' : 's'}`);

  return parts.length > 0 ? parts.join(', ') : '';
}

function formatPanelValue(value) {
  if (value == null) {
    return '';
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    return normalized.length > 0 ? normalized.join(', ') : '';
  }

  if (typeof value === 'object') {
    const duration = formatDurationParts(value);
    if (duration !== null) {
      return duration;
    }

    const entries = Object.entries(value)
      .filter(([, entry]) => entry != null && String(entry).trim() !== '' && Number(entry) !== 0)
      .map(([key, entry]) => `${key}: ${entry}`);
    return entries.length > 0 ? entries.join(', ') : '';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value).trim();
}

export function MilitaryServiceTab() {
  const { workspace, workflow, updateWorkspace } = useClaimWorkspace();

  const fileRef = useRef(null);

  const [recognizedLocations, setRecognizedLocations] = useState([]);
  const [records, setRecords] = useState([]);
  const [editingRecordId, setEditingRecordId] = useState(null);

  const [form, setForm] = useState(createEmptyMilitaryServiceForm());
  const [mosTenureDraft, setMosTenureDraft] = useState({ code: '', years: '', months: '' });
  const [deploymentDraft, setDeploymentDraft] = useState('');
  const [manualHazardDraft, setManualHazardDraft] = useState('');

  const [uploadStatus, setUploadStatus] = useState('idle');
  const [uploadError, setUploadError] = useState('');
  const [extractionResult, setExtractionResult] = useState(null);
  const [extractionPanels, setExtractionPanels] = useState(null);
  const [extractionConfidence, setExtractionConfidence] = useState({ overallConfidence: null, fieldConfidence: {} });
  const [normalizedExtractionCodes, setNormalizedExtractionCodes] = useState({ spdCode: '', reCode: '', separationAuthority: '' });
  const [applyWarnings, setApplyWarnings] = useState([]);

  const [diffOpen, setDiffOpen] = useState(false);
  const [diffRows, setDiffRows] = useState([]);
  const [pendingMappedForm, setPendingMappedForm] = useState(null);

  const [saveMessage, setSaveMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [glossaryStatus] = useState(validateGlossaryLinks());

  const [suggestionStatuses, setSuggestionStatuses] = useState({});

  useEffect(() => {
    const local = Array.isArray(workspace?.militaryService?.records)
      ? workspace.militaryService.records
      : [];

    if (local.length > 0) {
      setRecords(local);
      return;
    }

    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(parsed)) {
        setRecords(parsed);
      }
    } catch {
      setRecords([]);
    }
  }, [workspace?.militaryService?.records]);

  useEffect(() => {
    const loadLocations = async () => {
      try {
        const payload = await getPresumptiveKnowledge();
        const options = getDropdownLocations(payload?.data || {});
        setRecognizedLocations(
          dedupeCaseInsensitive(options.map((item) => String(item?.value || '').trim()).filter(Boolean))
        );
      } catch {
        setRecognizedLocations([]);
      }
    };

    loadLocations();
  }, []);

  const suggestions = useMemo(() => {
    const generated = buildExposureSuggestions(form);
    return generated.map((item) => ({
      ...item,
      status: suggestionStatuses[item.id] || item.status || 'pending',
    }));
  }, [form, suggestionStatuses]);

  const panelEntries = useMemo(() => createPanelEntries(extractionPanels), [extractionPanels]);

  const extractionDone = uploadStatus === 'success' && extractionResult != null;

  const getMappedExtraction = () => {
    if (!extractionResult) {
      return { mapped: null, warnings: ['No extraction payload available.'], normalizedCodes: { spdCode: '', reCode: '', separationAuthority: '' } };
    }

    return mapExtractedToMilitaryForm(extractionResult, form, recognizedLocations);
  };

  const updateFormField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.type !== 'application/pdf') {
      setUploadStatus('error');
      setUploadError('Invalid file type. Please upload a DD-214 PDF.');
      return;
    }

    setUploadStatus('uploading');
    setUploadError('');
    setExtractionResult(null);
    setExtractionPanels(null);
    setApplyWarnings([]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/scanner/scan-dd214', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        setUploadStatus('error');
        setUploadError(payload?.error || 'DD-214 extraction failed.');
        return;
      }

      const result = payload.data;
      const confidence = buildExtractionConfidence(result);
      const panels = extractDd214Panels(result);

      setExtractionResult(result);
      setExtractionConfidence(confidence);
      setExtractionPanels(panels);
      setUploadStatus('success');
    } catch {
      setUploadStatus('error');
      setUploadError('Extraction request failed. Please retry.');
    } finally {
      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  };

  const openCompareDiff = () => {
    const mapped = getMappedExtraction();
    if (!mapped?.mapped) {
      return;
    }

    setPendingMappedForm(mapped.mapped);
    setNormalizedExtractionCodes(mapped.normalizedCodes || { spdCode: '', reCode: '', separationAuthority: '' });
    setApplyWarnings(mapped.warnings || []);
    setDiffRows(buildExtractedVsCurrentDiff(form, mapped.mapped));
    setDiffOpen(true);
  };

  const applyExtractionToFormDirect = () => {
    const mapped = getMappedExtraction();
    if (!mapped?.mapped) {
      setSaveMessage('Unable to apply extracted values. Please review and enter values manually.');
      return;
    }

    setNormalizedExtractionCodes(mapped.normalizedCodes || { spdCode: '', reCode: '', separationAuthority: '' });
    setApplyWarnings(mapped.warnings || []);

    const confirmed = window.confirm('Apply extracted DD-214 values to the manual form?');
    if (!confirmed) {
      return;
    }

    setForm(mapped.mapped);
    setSaveMessage('Extracted DD-214 values were applied. Review and save the record.');
  };

  const applyExtractedToForm = () => {
    if (!pendingMappedForm) {
      setDiffOpen(false);
      return;
    }

    const confirmed = window.confirm('Apply extracted DD-214 values to the manual form?');
    if (!confirmed) {
      return;
    }

    setForm(pendingMappedForm);
    setDiffOpen(false);
    setSaveMessage('Extracted DD-214 values were applied. Review and save the record.');
  };

  const addAdditionalMos = () => {
    const code = normalizeMosCode(mosTenureDraft.code);
    if (!code) {
      return;
    }

    if (!isValidMosCode(code)) {
      setValidationErrors(['Additional MOS format is invalid.']);
      return;
    }

    setForm((current) => ({
      ...current,
      additionalMOS: dedupeCaseInsensitive([...(current.additionalMOS || []), code]),
    }));

    setMosTenureDraft({ code: '', years: '', months: '' });
  };

  const removeAdditionalMos = (code) => {
    setForm((current) => ({
      ...current,
      additionalMOS: (current.additionalMOS || []).filter((item) => item !== code),
    }));
  };

  const addDeploymentLocation = () => {
    const normalized = normalizeDeploymentLocation(deploymentDraft, recognizedLocations);
    if (!normalized) {
      return;
    }

    setForm((current) => ({
      ...current,
      deploymentLocations: normalizeDeploymentLocations(
        [...(current.deploymentLocations || []), normalized],
        recognizedLocations
      ),
    }));

    setDeploymentDraft('');
  };

  const removeDeploymentLocation = (value) => {
    setForm((current) => ({
      ...current,
      deploymentLocations: (current.deploymentLocations || []).filter((item) => item !== value),
    }));
  };

  const addHazardIndicator = () => {
    const text = String(manualHazardDraft || '').trim();
    if (!text) {
      return;
    }

    setForm((current) => ({
      ...current,
      hazardPayIndicators: dedupeCaseInsensitive([...(current.hazardPayIndicators || []), text]),
    }));
    setManualHazardDraft('');
  };

  const removeHazardIndicator = (value) => {
    setForm((current) => ({
      ...current,
      hazardPayIndicators: (current.hazardPayIndicators || []).filter((item) => item !== value),
    }));
  };

  const updateSuggestionStatus = (suggestionId, status) => {
    setSuggestionStatuses((current) => ({
      ...current,
      [suggestionId]: status,
    }));

    if (status === 'accepted') {
      const accepted = suggestions.find((item) => item.id === suggestionId);
      if (accepted) {
        setForm((current) => ({
          ...current,
          hazardPayIndicators: dedupeCaseInsensitive([...(current.hazardPayIndicators || []), accepted.label]),
        }));
      }
    }
  };

  const addOrUpdateRecord = () => {
    const errors = validateMilitaryServiceForm(form, recognizedLocations);
    setValidationErrors(errors);

    if (errors.length > 0) {
      return;
    }

    const record = {
      ...deepClone(form),
      id: editingRecordId || Date.now(),
      serviceEra: form.serviceEra || inferServiceEra(form.startDate, form.endDate),
      additionalMOS: dedupeCaseInsensitive(form.additionalMOS || []),
      deploymentLocations: normalizeDeploymentLocations(form.deploymentLocations || [], recognizedLocations),
      hazardPayIndicators: dedupeCaseInsensitive(form.hazardPayIndicators || []),
    };

    setRecords((current) => {
      if (!editingRecordId) {
        return [...current, record];
      }
      return current.map((item) => (item.id === editingRecordId ? record : item));
    });

    setEditingRecordId(null);
    setForm(createEmptyMilitaryServiceForm());
    setSaveMessage('Record staged. Use Save Records to persist all entries.');
  };

  const editRecord = (recordId) => {
    const record = records.find((item) => item.id === recordId);
    if (!record) {
      return;
    }

    setEditingRecordId(recordId);
    setForm({
      ...createEmptyMilitaryServiceForm(),
      ...deepClone(record),
    });
    setValidationErrors([]);
  };

  const deleteRecord = (recordId) => {
    setRecords((current) => current.filter((item) => item.id !== recordId));
    if (editingRecordId === recordId) {
      setEditingRecordId(null);
      setForm(createEmptyMilitaryServiceForm());
    }
  };

  const cancelEdit = () => {
    setEditingRecordId(null);
    setForm(createEmptyMilitaryServiceForm());
    setValidationErrors([]);
  };

  const saveRecords = () => {
    const nextSection = {
      records,
      summary: {
        totalRecords: records.length,
      },
      updatedAt: new Date().toISOString(),
    };

    updateWorkspace((current) => ({
      ...current,
      militaryService: nextSection,
    }));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    setSaveMessage('Military service records saved.');
  };

  const profileItems = [
    { label: 'Veteran', value: workflow.profileSummary.fullName || 'Profile not entered', color: '#5eead4' },
    { label: 'Home', value: workflow.profileSummary.location || 'N/A' },
    { label: 'Email', value: workflow.profileSummary.email || 'N/A' },
    { label: 'Phone', value: workflow.profileSummary.phone || 'N/A' },
  ];

  return (
    <div className='page-shell'>
      <section className='page-header'>
        <div>
          <div className='page-eyebrow'>Service History</div>
          <h1 className='page-title'>Military Service</h1>
          <p className='page-copy'>Upload DD-214, review extraction confidence, then apply only approved values into a normalized service record workflow.</p>
        </div>
        <div className='page-badge'>Extraction + Manual Intake</div>
      </section>

      <WorkflowCarryForwardCard
        title='Step 1 Carry Forward'
        description='Profile details remain available while you build structured service periods.'
        items={profileItems}
      />

      <Card title='Card A - DD-214 Upload & Extraction'>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <input
              ref={fileRef}
              aria-label='Upload DD-214'
              type='file'
              accept='application/pdf'
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              type='button'
              className='btn-primary'
              onClick={() => fileRef.current?.click()}
              disabled={uploadStatus === 'uploading'}
            >
              {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload DD-214'}
            </button>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: uploadStatus === 'error' ? '#f87171' : '#93c5fd' }}>
              Status: {uploadStatus}
            </span>
            {uploadError ? (
              <span style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: 700 }}>{uploadError}</span>
            ) : null}
          </div>

          <div style={{ padding: '0.75rem', border: '1px solid #334155', borderRadius: '0.5rem', backgroundColor: '#0f172a' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1' }}>Extraction Summary</p>
                <p style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  Overall Confidence: {confidenceText(extractionConfidence.overallConfidence)}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <a href={DD214_GLOSSARY_LINKS.spdCode} target='_blank' rel='noreferrer' style={{ fontSize: '0.72rem' }}>SPD Code Glossary</a>
                <a href={DD214_GLOSSARY_LINKS.reCode} target='_blank' rel='noreferrer' style={{ fontSize: '0.72rem' }}>RE Code Glossary</a>
                <a href={DD214_GLOSSARY_LINKS.separationAuthority} target='_blank' rel='noreferrer' style={{ fontSize: '0.72rem' }}>Separation Authority Glossary</a>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.4rem', marginTop: '0.7rem' }}>
              {toPerFieldRows(extractionConfidence.fieldConfidence || {}).map(([label, confidence]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.5rem', border: '1px solid #243244', borderRadius: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>{label}</span>
                  <span
                    aria-label={`${label} confidence`}
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: '#f8fafc',
                      backgroundColor: toBadgeColor(confidence),
                      borderRadius: '999px',
                      padding: '0.12rem 0.4rem',
                    }}
                  >
                    {confidenceText(confidence)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {panelEntries.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.7rem' }}>
              {panelEntries
                .filter((panel) => !panel.conditional || panel.items.some(([, value]) => String(value || '').trim()))
                .map((panel) => (
                  <div key={panel.title} style={{ border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.65rem', backgroundColor: '#111827' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase' }}>{panel.title}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.45rem' }}>
                      {panel.items
                        .filter(([, value]) => formatPanelValue(value))
                        .map(([label, value], index) => (
                          <div key={`${panel.title}-${label}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{label}</span>
                            <span style={{ fontSize: '0.72rem', color: '#e2e8f0', textAlign: 'right' }}>{formatPanelValue(value)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : null}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type='button'
              className='btn-primary'
              disabled={!extractionDone}
              onClick={openCompareDiff}
            >
              Compare Extracted vs Current Form
            </button>
            <button
              type='button'
              className='btn-primary'
              disabled={!extractionDone}
              onClick={applyExtractionToFormDirect}
              aria-label='Apply extracted values to form'
            >
              Apply to Form
            </button>
            {!glossaryStatus.spdCode || !glossaryStatus.reCode || !glossaryStatus.separationAuthority ? (
              <span style={{ color: '#f87171', fontSize: '0.75rem', fontWeight: 700 }}>
                One or more glossary links failed validation.
              </span>
            ) : null}
          </div>

          {applyWarnings.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#fbbf24', fontSize: '0.75rem' }}>
              {applyWarnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          ) : null}

          {(normalizedExtractionCodes.spdCode || normalizedExtractionCodes.reCode || normalizedExtractionCodes.separationAuthority) ? (
            <div style={{ fontSize: '0.74rem', color: '#cbd5e1' }}>
              <span style={{ marginRight: '0.7rem' }}>Normalized SPD: {normalizedExtractionCodes.spdCode || '(none)'}</span>
              <span style={{ marginRight: '0.7rem' }}>Normalized RE: {normalizedExtractionCodes.reCode || '(none)'}</span>
              <span>Authority Validated: {normalizedExtractionCodes.separationAuthority ? 'Yes' : 'No'}</span>
            </div>
          ) : null}
        </div>
      </Card>

      <Card title='Card B - Manual Service Intake'>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
            <label>
              <span>branchOfService</span>
              <select value={form.branchOfService} onChange={(event) => updateFormField('branchOfService', event.target.value)}>
                <option value=''>Select branch...</option>
                {BRANCH_VALUES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>

            <label>
              <span>serviceType</span>
              <select value={form.serviceType} onChange={(event) => updateFormField('serviceType', event.target.value)}>
                <option value=''>Select service type...</option>
                {SERVICE_TYPE_VALUES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>

            <label>
              <span>startDate</span>
              <input type='date' value={form.startDate} onChange={(event) => updateFormField('startDate', event.target.value)} />
            </label>

            <label>
              <span>endDate</span>
              <input type='date' value={form.endDate} onChange={(event) => updateFormField('endDate', event.target.value)} />
            </label>

            <label>
              <span>rankRate</span>
              <input value={form.rankRate} onChange={(event) => updateFormField('rankRate', event.target.value)} placeholder='E-5 / O-3 / Chief / PO2' />
            </label>

            <label>
              <span>dischargeType</span>
              <select value={form.dischargeType} onChange={(event) => updateFormField('dischargeType', event.target.value)}>
                <option value=''>Select discharge type...</option>
                {DISCHARGE_TYPE_VALUES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>

            <label>
              <span>serviceEra</span>
              <input value={form.serviceEra} onChange={(event) => updateFormField('serviceEra', event.target.value)} placeholder='Vietnam Era (1964-1975)' />
            </label>

            <label>
              <span>primaryMOS</span>
              <input value={form.primaryMOS} onChange={(event) => updateFormField('primaryMOS', normalizeMosCode(event.target.value))} placeholder='11B / 68W / 4N0X1' />
            </label>
          </div>

          <div style={{ border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.6rem' }}>
            <p style={{ fontSize: '0.78rem', color: '#93c5fd', fontWeight: 700 }}>MOS / AFSC / Rating - additionalMOS[]</p>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input placeholder='Code' value={mosTenureDraft.code} onChange={(event) => setMosTenureDraft((current) => ({ ...current, code: event.target.value }))} />
              <input placeholder='Years (optional)' value={mosTenureDraft.years} onChange={(event) => setMosTenureDraft((current) => ({ ...current, years: event.target.value }))} />
              <input placeholder='Months (optional)' value={mosTenureDraft.months} onChange={(event) => setMosTenureDraft((current) => ({ ...current, months: event.target.value }))} />
              <button type='button' onClick={addAdditionalMos} aria-label='Add additional MOS'>Add</button>
            </div>
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {(form.additionalMOS || []).map((code) => (
                <span key={code} style={{ border: '1px solid #334155', borderRadius: '999px', padding: '0.2rem 0.45rem' }}>
                  {code}
                  <button type='button' onClick={() => removeAdditionalMos(code)} style={{ marginLeft: '0.45rem' }}>x</button>
                </span>
              ))}
            </div>
          </div>

          <div style={{ border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.6rem' }}>
            <p style={{ fontSize: '0.78rem', color: '#93c5fd', fontWeight: 700 }}>Deployment & Combat</p>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr auto', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input
                placeholder='deploymentLocations[] entry'
                value={deploymentDraft}
                onChange={(event) => setDeploymentDraft(event.target.value)}
              />
              <button type='button' onClick={addDeploymentLocation} aria-label='Add deployment location'>Add</button>
            </div>
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {(form.deploymentLocations || []).map((location) => (
                <span key={location} style={{ border: '1px solid #334155', borderRadius: '999px', padding: '0.2rem 0.45rem' }}>
                  {location}
                  <button type='button' onClick={() => removeDeploymentLocation(location)} style={{ marginLeft: '0.45rem' }}>x</button>
                </span>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.5rem' }}>
              <input
                type='checkbox'
                checked={form.combatVeteran}
                onChange={(event) => updateFormField('combatVeteran', event.target.checked)}
              />
              combatVeteran
            </label>
          </div>

          <div style={{ border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.6rem' }}>
            <p style={{ fontSize: '0.78rem', color: '#93c5fd', fontWeight: 700 }}>hazardPayIndicators[]</p>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr auto', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input value={manualHazardDraft} onChange={(event) => setManualHazardDraft(event.target.value)} placeholder='Add hazard pay indicator' />
              <button type='button' onClick={addHazardIndicator} aria-label='Add hazard indicator'>Add</button>
            </div>
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {(form.hazardPayIndicators || []).map((indicator) => (
                <span key={indicator} style={{ border: '1px solid #334155', borderRadius: '999px', padding: '0.2rem 0.45rem' }}>
                  {indicator}
                  <button type='button' onClick={() => removeHazardIndicator(indicator)} style={{ marginLeft: '0.45rem' }}>x</button>
                </span>
              ))}
            </div>
          </div>

          {validationErrors.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#f87171', fontSize: '0.75rem' }}>
              {validationErrors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          ) : null}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type='button' className='btn-primary' onClick={addOrUpdateRecord}>
              {editingRecordId ? 'Update Record' : 'Add Record'}
            </button>
            <button type='button' onClick={cancelEdit}>Cancel Edit</button>
          </div>
        </div>
      </Card>

      <Card title='Card C - Analyzer'>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {suggestions.length === 0 ? (
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>No analyzer suggestions yet.</span>
          ) : (
            suggestions.map((item) => (
              <div key={item.id} style={{ border: '1px solid #334155', borderRadius: '0.45rem', padding: '0.55rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.78rem' }}>{item.label}</strong>
                  <span style={{ fontSize: '0.72rem', color: '#93c5fd' }}>{Math.round(item.confidence * 100)}%</span>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '0.3rem' }}>{item.rationale}</p>
                <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.4rem' }}>
                  <button type='button' onClick={() => updateSuggestionStatus(item.id, 'accepted')}>Accept</button>
                  <button type='button' onClick={() => updateSuggestionStatus(item.id, 'dismissed')}>Dismiss</button>
                  <span style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>Status: {item.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card title='Card D - Service Records List'>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {records.length === 0 ? (
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>No service records yet.</span>
          ) : (
            records.map((record) => (
              <div key={record.id} style={{ border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem' }}>
                  <div>
                    <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{record.branchOfService}</p>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{record.serviceType} • {record.startDate} to {record.endDate}</p>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Primary MOS: {record.primaryMOS || 'N/A'}
                      {' • '}
                      Secondary MOS: {(record.additionalMOS || []).join(', ') || 'N/A'}
                      {' • '}
                      Deployments: {(record.deploymentLocations || []).join(', ') || 'N/A'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'start' }}>
                    <button type='button' onClick={() => editRecord(record.id)}>Edit</button>
                    <button type='button' onClick={() => deleteRecord(record.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))
          )}

          <button type='button' className='btn-primary' onClick={saveRecords}>Save Records</button>
        </div>
      </Card>

      {saveMessage ? (
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#5eead4', paddingBottom: '1.2rem' }}>{saveMessage}</div>
      ) : null}

      {diffOpen ? (
        <div
          role='dialog'
          aria-modal='true'
          aria-label='Extracted versus current form comparison'
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(2, 6, 23, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 1200,
          }}
        >
          <div style={{ width: 'min(860px, 100%)', maxHeight: '80vh', overflow: 'auto', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.6rem', padding: '0.8rem' }}>
            <h3 style={{ marginBottom: '0.6rem' }}>Compare Extracted vs Current Form</h3>
            {diffRows.length === 0 ? (
              <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>No differences detected. The form already matches extracted values.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #334155', padding: '0.4rem' }}>Field</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #334155', padding: '0.4rem' }}>Current</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #334155', padding: '0.4rem' }}>Extracted</th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows.map((row) => (
                    <tr key={row.key}>
                      <td style={{ borderBottom: '1px solid #1e293b', padding: '0.4rem', fontSize: '0.75rem' }}>{row.key}</td>
                      <td style={{ borderBottom: '1px solid #1e293b', padding: '0.4rem', fontSize: '0.75rem' }}>{row.currentValue}</td>
                      <td style={{ borderBottom: '1px solid #1e293b', padding: '0.4rem', fontSize: '0.75rem' }}>{row.extractedValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.8rem' }}>
              <button type='button' onClick={() => setDiffOpen(false)}>Close</button>
              <button type='button' className='btn-primary' onClick={applyExtractedToForm}>Confirm Apply</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
