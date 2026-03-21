import React, { useEffect, useMemo } from 'react';
import { WorkflowCarryForwardCard } from '../../components/WorkflowCarryForwardCard.jsx';
import { Card } from '../../components/Card.jsx';
import { useClaimWorkspace } from '../../context/ClaimWorkspaceContext.jsx';
import { downloadBlob } from '../../services/caseSummaryExport.js';
import {
  buildUnifiedSummaryJson,
  buildUnifiedSummaryPayload,
  formatUnifiedSummaryTxt,
} from './normalization.js';
import { CLAIM_CATEGORY_LABEL } from './schema.js';
import { ExposureScenarioWizard } from './ExposureScenarioWizard.jsx';

const DASHBOARD_CARD_STYLE = {
  border: '1px solid rgba(131, 169, 194, 0.18)',
  borderRadius: '12px',
  padding: '0.85rem',
  backgroundColor: '#101827',
};

function formatEvidenceList(list = []) {
  if (!Array.isArray(list) || list.length === 0) {
    return <span style={{ color: '#64748b' }}>None</span>;
  }
  return (
    <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1rem', color: '#d8e4ee', lineHeight: 1.5 }}>
      {list.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

function buildCarryForward(claimDataUnified = {}) {
  const profile = claimDataUnified?.profile || {};
  const service = Array.isArray(claimDataUnified?.service) ? claimDataUnified.service : [];
  const str = claimDataUnified?.str || {};
  const treatment = claimDataUnified?.currentTreatment || {};
  const ratingDecision = claimDataUnified?.ratingDecision || {};

  const veteranName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim();
  const primaryService = service[0] || {};

  return {
    veteranName,
    branchMos: [primaryService?.branchOfService, primaryService?.primaryMOS].filter(Boolean).join(' | '),
    strFindingsTotal: (Array.isArray(str?.extractedFindings?.diagnoses) ? str.extractedFindings.diagnoses.length : 0)
      + (Array.isArray(str?.extractedFindings?.injuries) ? str.extractedFindings.injuries.length : 0)
      + (Array.isArray(str?.extractedFindings?.events) ? str.extractedFindings.events.length : 0),
    treatmentSignalsTotal: (Array.isArray(treatment?.extractedFindings?.currentConditions) ? treatment.extractedFindings.currentConditions.length : 0)
      + (Array.isArray(treatment?.extractedFindings?.treatmentEvents) ? treatment.extractedFindings.treatmentEvents.length : 0),
    ratedConditionsTotal: Array.isArray(ratingDecision?.extractedFindings?.serviceConnectedConditions) ? ratingDecision.extractedFindings.serviceConnectedConditions.length : 0,
    deniedConditionsTotal: Array.isArray(ratingDecision?.extractedFindings?.deniedConditions) ? ratingDecision.extractedFindings.deniedConditions.length : 0,
  };
}

function getConditionConfidenceLevel(condition) {
  const level = String(condition?.confidence || condition?.confidence?.level || '').toLowerCase();
  if (['high', 'medium', 'low'].includes(level)) return level;
  const score = Number(condition?.confidenceScore ?? condition?.confidence?.score ?? 0);
  if (score >= 85) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

function getConditionConfidenceScore(condition) {
  const score = Number(condition?.confidenceScore ?? condition?.confidence?.score);
  if (Number.isFinite(score)) return score;
  const level = getConditionConfidenceLevel(condition);
  if (level === 'high') return 90;
  if (level === 'medium') return 70;
  return 40;
}

function ConditionSynthesisCard({ condition }) {
  const confidenceLevel = getConditionConfidenceLevel(condition);
  const confidenceScore = getConditionConfidenceScore(condition);
  const confidenceColor =
    confidenceLevel === 'high'
      ? '#22c55e'
      : confidenceLevel === 'medium'
        ? '#f59e0b'
        : '#ef4444';

  return (
    <article style={{ ...DASHBOARD_CARD_STYLE, display: 'grid', gap: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>{condition.conditionName}</div>
        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: '#8ab4d6', border: '1px solid rgba(138, 180, 214, 0.32)', borderRadius: '999px', padding: '0.2rem 0.55rem' }}>
            {CLAIM_CATEGORY_LABEL[condition.category] || condition.category}
          </span>
          <span style={{ fontSize: '0.72rem', color: confidenceColor, border: `1px solid ${confidenceColor}44`, borderRadius: '999px', padding: '0.2rem 0.55rem' }}>
            Confidence {confidenceScore}%
          </span>
        </div>
      </div>

      <div style={{ fontSize: '0.82rem', color: '#a7bed0', lineHeight: 1.55 }}>
        <strong style={{ color: '#e2e8f0' }}>Why this is claimable:</strong> {condition.whyClaimable}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.65rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>STR evidence</div>
          {formatEvidenceList(condition.evidence.str)}
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Treatment evidence</div>
          {formatEvidenceList(condition.evidence.treatment)}
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Exposure evidence</div>
          {formatEvidenceList(condition.evidence.service)}
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Rating decision context</div>
          {formatEvidenceList(condition.evidence.ratingDecision)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.6rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Missing evidence</div>
          {formatEvidenceList(condition.missingEvidence)}
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Recommended DBQs</div>
          {formatEvidenceList(condition.recommendedDBQs)}
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Recommended forms</div>
          {formatEvidenceList(condition.recommendedForms)}
        </div>
      </div>

      <div>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Follow-up questions</div>
        {formatEvidenceList(condition.followUpQuestions)}
      </div>
    </article>
  );
}

export function ClaimGeneratorSummaryTab() {
  const { claimDataUnified, updateWorkspace } = useClaimWorkspace();
  const derivedSignals = claimDataUnified?.derivedSignals || {};
  const carryForward = useMemo(() => buildCarryForward(claimDataUnified), [claimDataUnified]);

  const summary = useMemo(() => buildUnifiedSummaryPayload(claimDataUnified), [claimDataUnified]);

  useEffect(() => {
    const nextSection = {
      generatedConditions: summary.generatedConditions,
      readinessScore: summary.readinessScore,
      evidenceIndex: summary.evidenceIndex,
      recommendedActions: summary.recommendedActions,
      followUpChecklist: summary.followUpChecklist,
      layStatement: summary.layStatement,
      layStatementTemplate: summary.layStatementTemplate,
      updatedAt: summary.updatedAt,
    };

    const currentSection = claimDataUnified?.claimGeneratorSummary || {};
    const currentComparable = JSON.stringify({
      generatedConditions: Array.isArray(currentSection.generatedConditions) ? currentSection.generatedConditions : [],
      readinessScore: Number(currentSection.readinessScore || 0),
      evidenceIndex: Array.isArray(currentSection.evidenceIndex) ? currentSection.evidenceIndex : [],
      recommendedActions: Array.isArray(currentSection.recommendedActions) ? currentSection.recommendedActions : [],
      followUpChecklist: Array.isArray(currentSection.followUpChecklist) ? currentSection.followUpChecklist : [],
      layStatement: currentSection.layStatement || '',
      layStatementTemplate: currentSection.layStatementTemplate || '',
      updatedAt: currentSection.updatedAt || null,
    });
    const nextComparable = JSON.stringify({
      generatedConditions: nextSection.generatedConditions,
      readinessScore: Number(nextSection.readinessScore || 0),
      evidenceIndex: nextSection.evidenceIndex,
      recommendedActions: nextSection.recommendedActions,
      followUpChecklist: nextSection.followUpChecklist,
      layStatement: nextSection.layStatement || '',
      layStatementTemplate: nextSection.layStatementTemplate || '',
      updatedAt: nextSection.updatedAt || null,
    });

    if (currentComparable === nextComparable) {
      return;
    }

    updateWorkspace((current) => ({
      ...current,
      claimGeneratorSummary: {
        ...nextSection,
      },
    }));
  }, [
    claimDataUnified?.claimGeneratorSummary,
    updateWorkspace,
    summary.generatedConditions,
    summary.readinessScore,
    summary.evidenceIndex,
    summary.recommendedActions,
    summary.followUpChecklist,
    summary.layStatement,
    summary.layStatementTemplate,
    summary.updatedAt,
  ]);

  const onExportTxt = () => {
    const text = formatUnifiedSummaryTxt(summary);
    downloadBlob(text, `claim-generator-summary-${new Date().toISOString().split('T')[0]}.txt`, 'text/plain');
  };

  const onExportJson = () => {
    const json = buildUnifiedSummaryJson(summary);
    downloadBlob(JSON.stringify(json, null, 2), `claim-generator-summary-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  };

  return (
    <section className='page-shell'>
      <header className='page-header'>
        <div>
          <div className='page-eyebrow'>Workflow</div>
          <h1 className='page-title'>Claim Generator &amp; Summary</h1>
          <p className='page-copy'>
            Final synthesis stage that generates claimable conditions, evidence reasoning, filing recommendations, and follow-up questions.
          </p>
        </div>
        <div className='page-badge'>Final Synthesis</div>
      </header>

      <WorkflowCarryForwardCard
        title='Steps 1-5 Carry Forward'
        description='Profile, service, STR, treatment, and rating-decision data are synthesized here as the final decision-prep checkpoint before filing.'
        items={[
          { label: 'Veteran', value: carryForward.veteranName, color: '#5eead4' },
          { label: 'Branch/MOS', value: carryForward.branchMos },
          { label: 'STR Findings', value: `${Number(carryForward.strFindingsTotal || 0)} total` },
          { label: 'Treatment Signals', value: `${Number(carryForward.treatmentSignalsTotal || 0)} total` },
          { label: 'VA Decisions', value: `${Number(carryForward.ratedConditionsTotal || 0)} rated / ${Number(carryForward.deniedConditionsTotal || 0)} denied` },
        ]}
      />

      <Card title='Export Toolbar'>
        <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
          <button type='button' className='app-nav-link' style={{ width: 'auto' }} onClick={onExportTxt}>
            <span className='app-nav-icon'>TXT</span>
            <span>Export TXT</span>
          </button>
          <button type='button' className='app-nav-link' style={{ width: 'auto' }} onClick={onExportJson}>
            <span className='app-nav-icon'>JSON</span>
            <span>Export JSON</span>
          </button>
          <button type='button' className='app-nav-link' style={{ width: 'auto' }} onClick={() => window.print()}>
            <span className='app-nav-icon'>PRT</span>
            <span>Print</span>
          </button>
        </div>
      </Card>

      <ExposureScenarioWizard />

      <section className='dashboard-grid' style={{ marginBottom: '1rem' }}>
        <article className='rf-card'>
          <h2 className='rf-card-title'>Workflow Readiness</h2>
          <div className='rf-card-body'>
            Profile: {derivedSignals?.readiness?.profile ? 'Ready' : 'Pending'}<br />
            Military Service: {derivedSignals?.readiness?.militaryService ? 'Ready' : 'Pending'}<br />
            STR Evidence: {derivedSignals?.readiness?.serviceTreatmentRecords ? 'Ready' : 'Pending'}<br />
            Current Treatment: {derivedSignals?.readiness?.currentTreatment ? 'Ready' : 'Pending'}<br />
            VA Decision: {derivedSignals?.readiness?.vaDecision ? 'Ready' : 'Optional'}
          </div>
        </article>

        <article className='rf-card'>
          <h2 className='rf-card-title'>Claim Signals</h2>
          <div className='rf-card-body'>
            Total generated: {summary.generatedConditions.length}<br />
            Presumptive: {summary.generatedConditions.filter((item) => item.category === 'presumptive').length}<br />
            Secondary: {summary.generatedConditions.filter((item) => item.category === 'secondary').length}<br />
            Aggravation: {summary.generatedConditions.filter((item) => item.category === 'aggravation').length}<br />
            Reopen: {summary.generatedConditions.filter((item) => item.category === 'reopen').length}<br />
            Increase: {summary.generatedConditions.filter((item) => item.category === 'increase').length}
          </div>
        </article>

        <article className='rf-card'>
          <h2 className='rf-card-title'>Recommended Next Actions</h2>
          <div className='rf-card-body'>
            <ul style={{ margin: 0, paddingLeft: '1rem', lineHeight: 1.6 }}>
              {summary.recommendedActions.slice(0, 7).map((action) => <li key={action}>{action}</li>)}
            </ul>
          </div>
        </article>

        <article className='rf-card'>
          <h2 className='rf-card-title'>Filing Readiness Score</h2>
          <div className='rf-card-body'>
            Overall readiness: {summary.readinessScore}%<br />
            Claim-ready: {summary.generatedConditions.filter((item) => getConditionConfidenceScore(item) >= 85).length}<br />
            Developing: {summary.generatedConditions.filter((item) => getConditionConfidenceScore(item) >= 60 && getConditionConfidenceScore(item) < 85).length}<br />
            Needs evidence: {summary.generatedConditions.filter((item) => getConditionConfidenceScore(item) < 60).length}<br />
            Last generated: {summary.updatedAt ? new Date(summary.updatedAt).toLocaleString() : 'N/A'}
          </div>
        </article>

        {summary.evidenceIndex.length > 0 && (
          <article className='rf-card'>
            <h2 className='rf-card-title'>Evidence Index</h2>
            <div className='rf-card-body' style={{ maxHeight: '12rem', overflow: 'auto' }}>
              <ul style={{ margin: 0, paddingLeft: '1rem', lineHeight: 1.45 }}>
                {summary.evidenceIndex.slice(0, 40).map((row, index) => (
                  <li key={`${row.sourceType}-${row.conditionName}-${index}`}>
                    [{row.sourceType}] {row.conditionName}: {row.evidence}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        )}
      </section>

      {summary.followUpChecklist.length > 0 && (
        <Card title='Follow-Up Checklist'>
          <ul style={{ margin: 0, paddingLeft: '1rem', lineHeight: 1.6 }}>
            {summary.followUpChecklist.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </Card>
      )}

      {summary.layStatement && (
        <Card title='Auto-Generated Lay Statement'>
          <div style={{ whiteSpace: 'pre-wrap', color: '#d8e4ee', lineHeight: 1.65 }}>
            {summary.layStatement}
          </div>
        </Card>
      )}

      {summary.generatedConditions.length > 0 && (
        <Card title='Generated Claimable Conditions'>
          <div style={{ display: 'grid', gap: '0.7rem' }}>
            {summary.generatedConditions.map((condition) => (
              <ConditionSynthesisCard key={`${condition.conditionName}-${condition.category}`} condition={condition} />
            ))}
          </div>
        </Card>
      )}

      {!summary.validation.valid && (
        <Card title='Validation'>
          <div style={{ color: '#fca5a5' }}>
            <p style={{ marginTop: 0 }}>The synthesis payload has validation issues:</p>
            <ul style={{ margin: 0, paddingLeft: '1rem' }}>
              {summary.validation.issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          </div>
        </Card>
      )}
    </section>
  );
}
