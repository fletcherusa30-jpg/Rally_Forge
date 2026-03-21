import React from 'react';

function SignalBadge({ label, value, accent }) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(11, 18, 32, 0.6)',
        border: '1px solid rgba(131, 169, 194, 0.2)',
        borderRadius: '8px',
        padding: '0.65rem 0.8rem',
      }}
    >
      <div style={{ fontSize: '0.7rem', color: '#9db1c2', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: accent || '#e8f1f7' }}>{value}</div>
    </div>
  );
}

export function ClaimSignalsBar({ workflow }) {
  const { conditionSummary, strsSummary, treatmentSummary, serviceSummary, potentialNewClaims, vaSummary } = workflow;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: '0.6rem',
      }}
    >
      <SignalBadge label='Condition Workspaces' value={conditionSummary.total} />
      <SignalBadge label='Claim-Ready' value={conditionSummary.claimReadyCount} accent='#4db6ac' />
      <SignalBadge label='Developing' value={conditionSummary.developingCount} accent='#f6b44c' />
      <SignalBadge label='Needs Evidence' value={conditionSummary.needsEvidenceCount} accent='#9db1c2' />
      <SignalBadge label='Avg Readiness' value={`${conditionSummary.averageReadinessScore}%`} accent='#4db6ac' />
      <SignalBadge
        label='STR Evidence'
        value={strsSummary.uploadedCount + strsSummary.manualCount}
      />
      <SignalBadge
        label='Current Conditions'
        value={treatmentSummary.currentDiagnoses.length + treatmentSummary.manualConditions.length}
      />
      <SignalBadge label='Potential New Claims' value={potentialNewClaims.length} accent='#4db6ac' />
      <SignalBadge label='Denied on Decision' value={vaSummary.deniedConditions.length} accent='#f6b44c' />
      <SignalBadge label='Presumptive Matches' value={serviceSummary.presumptiveMatches} />
    </div>
  );
}
