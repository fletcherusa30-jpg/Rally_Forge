// Case summary export helpers — no React dependencies.
// Extracted from CaseSummaryPage so the logic can be tested
// in isolation and reused by future export surfaces.

import { getLaneRecommendation } from './laneFormMap.js';

export function buildEvidenceIndex(conditionRecords) {
  const index = new Map();
  for (const record of conditionRecords) {
    const allRefs = [
      ...record.sourceEvidence.current,
      ...record.sourceEvidence.inService,
      ...record.sourceEvidence.rated,
      ...record.sourceEvidence.denied,
    ];
    for (const ref of allRefs) {
      const key = ref.sourceName;
      if (!index.has(key)) {
        index.set(key, { sourceName: ref.sourceName, sourceType: ref.sourceType, conditions: new Set() });
      }
      index.get(key).conditions.add(record.condition);
    }
  }
  return Array.from(index.values()).map((entry) => ({ ...entry, conditions: Array.from(entry.conditions) }));
}

export function buildCaseSummaryPacket(workflow) {
  const evidenceIndex = buildEvidenceIndex(workflow.conditionRecords);

  const evidenceIndexSection =
    evidenceIndex.length > 0
      ? evidenceIndex
          .map(
            (entry, i) =>
              `  ${i + 1}. ${entry.sourceName} [${entry.sourceType}]\n     Supports: ${entry.conditions.join(', ')}`
          )
          .join('\n')
      : '  No source documents linked yet. Upload STRs, treatment records, or a VA decision to populate this index.';

  const conditionActionPlan = workflow.conditionRecords
    .map((item, index) => {
      const laneRec = getLaneRecommendation(item.recommendedLane);
      const sourceLines = [
        ...item.sourceEvidence.current.map((e) => `      Current: ${e.label} [${e.sourceName}]`),
        ...item.sourceEvidence.inService.map((e) => `      In-service: ${e.label} [${e.sourceName}]`),
        ...item.sourceEvidence.rated.map((e) => `      Rated: ${e.label} [${e.sourceName}]`),
        ...item.sourceEvidence.denied.map((e) => `      Denied: ${e.label} [${e.sourceName}]`),
      ];

      return `  ${index + 1}. ${item.condition}
     Filing Lane:  ${item.recommendedLane}
     Readiness:    ${item.readinessState} (${item.readinessScore}%)
     Reason:       ${item.readinessReason}
     Gaps:         ${item.evidenceGaps.length > 0 ? item.evidenceGaps.join('; ') : 'None currently identified'}
     Score factors:
${item.scoreFactors.map((f) => `       ${f.impact} ${f.label}`).join('\n')}
     Required forms:
       ${laneRec.forms.join('\n       ')}
     Action tip:
       ${laneRec.tip}
     Linked evidence:
${sourceLines.length > 0 ? sourceLines.join('\n') : '       No source-level evidence linked yet'}`;
    })
    .join('\n\n');

  return `RALLY FORGE CASE SUMMARY PACKET
Generated: ${new Date().toLocaleString()}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

SECTION 1 — WORKFLOW SNAPSHOT
  Profile:              ${workflow.readiness.profile ? '\u2713 Ready' : '\u25cb Pending'}
  Military Service:     ${workflow.readiness.militaryService ? '\u2713 Ready' : '\u25cb Pending'}
  STR Evidence:         ${workflow.readiness.serviceTreatmentRecords ? '\u2713 Ready' : '\u25cb Pending'}
  Current Treatment:    ${workflow.readiness.currentTreatment ? '\u2713 Ready' : '\u25cb Pending'}
  VA Decision:          ${workflow.readiness.vaDecision ? '\u2713 Ready' : '\u25cb Optional'}
  Analyzer Inputs:      ${workflow.readiness.analyzer ? '\u2713 Ready' : '\u25cb Pending'}

SECTION 2 — CLAIM SIGNALS
  Presumptive deployment matches:  ${workflow.serviceSummary.presumptiveMatches}
  Potential new claims identified:  ${workflow.potentialNewClaims.length}
  Denied conditions on decision:    ${workflow.vaSummary.deniedConditions.length}
  Rated conditions on decision:     ${workflow.vaSummary.serviceConnectedConditions.length}
  Condition workspaces assembled:   ${workflow.conditionSummary.total}
  Claim-ready conditions:           ${workflow.conditionSummary.claimReadyCount}
  Developing conditions:            ${workflow.conditionSummary.developingCount}
  Conditions needing more evidence: ${workflow.conditionSummary.needsEvidenceCount}
  Average filing readiness:         ${workflow.conditionSummary.averageReadinessScore}%

SECTION 3 — RECOMMENDED NEXT ACTIONS
${workflow.nextActions.map((item, i) => `  ${i + 1}. ${item}`).join('\n')}

SECTION 4 — EVIDENCE INDEX
  (All source documents cross-referenced with the conditions they support)
${evidenceIndexSection}

SECTION 5 — CONDITION ACTION PLAN
  (Per-condition filing lane, required forms, and evidence traceability)
${conditionActionPlan}

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
DISCLAIMER: This packet is an organizational aid. It does not constitute
legal advice. Consult a VSO, attorney, or accredited claims agent before
submitting to the VA.
`;
}

export function buildCaseSummaryJson(workflow) {
  const evidenceIndex = buildEvidenceIndex(workflow.conditionRecords);
  return {
    generated: new Date().toISOString(),
    workflowReadiness: workflow.readiness,
    claimSignals: {
      presumptiveMatches: workflow.serviceSummary.presumptiveMatches,
      potentialNewClaims: workflow.potentialNewClaims.length,
      deniedConditions: workflow.vaSummary.deniedConditions.length,
      ratedConditions: workflow.vaSummary.serviceConnectedConditions.length,
      averageReadinessScore: workflow.conditionSummary.averageReadinessScore,
      claimReadyCount: workflow.conditionSummary.claimReadyCount,
      developingCount: workflow.conditionSummary.developingCount,
      needsEvidenceCount: workflow.conditionSummary.needsEvidenceCount,
    },
    nextActions: workflow.nextActions,
    evidenceIndex,
    conditions: workflow.conditionRecords.map((item) => ({
      condition: item.condition,
      aliases: item.aliases,
      recommendedLane: item.recommendedLane,
      requiredForms: getLaneRecommendation(item.recommendedLane).forms,
      actionTip: getLaneRecommendation(item.recommendedLane).tip,
      readinessScore: item.readinessScore,
      readinessState: item.readinessState,
      readinessReason: item.readinessReason,
      evidenceGaps: item.evidenceGaps,
      scoreFactors: item.scoreFactors,
      sourceEvidence: item.sourceEvidence,
    })),
  };
}

export function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
