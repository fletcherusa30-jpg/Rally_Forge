import { deriveWorkflow } from '../../context/workspaceDerivations.js';
import { runDerivedSignalsEngine } from '../../engine/derivedSignals/index.js';
import { runConditionGeneratorEngine } from '../../engine/conditionGenerator/index.js';
import { runLayStatementEngine } from '../../engine/layStatement/index.js';
import { runEvidenceIndexEngine } from '../../engine/evidenceIndex/index.js';
import { buildUnifiedTimeline } from '../../engine/timeline/index.js';
import { normalizeConditionName } from '../../engine/shared/conditionNormalization.js';

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value) {
  return String(value || '').trim();
}

function uniqueStrings(values) {
  return Array.from(new Set(asList(values).map((item) => asText(item)).filter(Boolean)));
}

function normalizeProfile(profile = {}) {
  return {
    firstName: asText(profile?.firstName),
    middleName: asText(profile?.middleName),
    lastName: asText(profile?.lastName),
    dateOfBirth: asText(profile?.dateOfBirth),
    ssnLast4: asText(profile?.ssnLast4 || profile?.ssn),
    email: asText(profile?.email),
    phone: asText(profile?.phone),
    city: asText(profile?.city),
    state: asText(profile?.state),
    preferredContactMethod: asText(profile?.preferredContactMethod),
    representationType: asText(profile?.representationType || profile?.representation?.type || profile?.representativeType),
  };
}

function normalizeService(workspace = {}, workflow = {}) {
  const records = asList(workspace?.militaryService?.records).length > 0
    ? asList(workspace?.militaryService?.records)
    : asList(workflow?.serviceSummary?.serviceRecords);

  return records.map((item) => ({
    branchOfService: asText(item?.branchOfService || item?.branch),
    serviceType: asText(item?.serviceType),
    startDate: asText(item?.startDate || item?.serviceStartDate),
    endDate: asText(item?.endDate || item?.serviceEndDate),
    rankRate: asText(item?.rankRate),
    dischargeType: asText(item?.dischargeType),
    serviceEra: asText(item?.serviceEra),
    primaryMOS: asText(item?.primaryMOS || item?.mos),
    additionalMOS: uniqueStrings(Array.isArray(item?.additionalMOS) ? item.additionalMOS : item?.additionalMos),
    deploymentLocations: uniqueStrings(asList(item?.deploymentLocations).map((dep) => asText(dep?.location || dep?.label || dep))),
    combatVeteran: Boolean(item?.combatVeteran || workflow?.serviceSummary?.combatVeteran),
    radiationExposure: uniqueStrings(item?.radiationExposure),
    hazardPayIndicators: uniqueStrings(item?.hazardPayIndicators),
    extractedFromDD214: Boolean(item?.extractedFromDD214 || item?.dd214Metadata || item?.dd214),
  }));
}

function normalizeStrSection(str = {}) {
  const extractedRows = asList(str?.extractedFindings);
  const extractedFindings = {
    diagnoses: uniqueStrings(extractedRows.filter((item) => asText(item?.findingType).toLowerCase() === 'diagnosis').map((item) => normalizeConditionName(item?.conditionName || item?.label))),
    injuries: uniqueStrings(extractedRows.filter((item) => asText(item?.findingType).toLowerCase() === 'injury').map((item) => normalizeConditionName(item?.conditionName || item?.label))),
    events: uniqueStrings(extractedRows.filter((item) => asText(item?.findingType).toLowerCase() === 'event').map((item) => normalizeConditionName(item?.conditionName || item?.label))),
    presumptiveSignals: uniqueStrings(extractedRows.filter((item) => item?.presumptiveMatch).map((item) => normalizeConditionName(item?.conditionName || item?.label))),
    audiogramSignals: uniqueStrings(extractedRows.filter((item) => /audiogram|hearing/i.test(asText(item?.label) + asText(item?.findingType))).map((item) => asText(item?.label || item?.conditionName))),
    radiationIndicators: uniqueStrings(extractedRows.filter((item) => /radiation|nuclear/i.test(asText(item?.label) + asText(item?.description))).map((item) => asText(item?.label || item?.conditionName))),
    evidenceSnippets: uniqueStrings(extractedRows.map((item) => item?.evidenceSnippet || item?.summaryText || item?.description)),
  };

  const manualEntries = asList(str?.manualEntries).map((item) => ({
    conditionName: normalizeConditionName(item?.conditionName),
    eventDate: asText(item?.eventDate || item?.dateOfEvent),
    description: asText(item?.description),
    serviceEventFlags: uniqueStrings([item?.inServiceEvent ? 'inServiceEvent' : '', item?.lineOfDuty ? `lineOfDuty:${item.lineOfDuty}` : '']),
    relatedContext: asText(item?.relatedContext || item?.continuityNotes || item?.nexusIndicators),
  }));

  return {
    manualEntries,
    extractedFindings,
  };
}

function normalizeCurrentTreatment(section = {}) {
  const extracted = section?.extractedFindings && typeof section.extractedFindings === 'object' && !Array.isArray(section.extractedFindings)
    ? section.extractedFindings
    : {};

  return {
    manualEntries: asList(section?.manualEntries).map((item) => ({
      conditionName: normalizeConditionName(item?.conditionName),
      symptomSummary: asText(item?.symptomSummary),
      status: asText(item?.status),
      providerName: asText(item?.providerName),
      providerType: asText(item?.providerType),
      treatmentDetails: asText(item?.treatmentDetails),
      treatmentStartDate: asText(item?.treatmentStartDate),
      treatmentEndDate: asText(item?.treatmentEndDate),
      medications: asList(item?.medications).map((med) => ({
        medicationName: asText(med?.medicationName),
        dosage: asText(med?.dosage),
        sideEffects: asText(med?.sideEffects),
      })),
    })),
    extractedFindings: {
      currentConditions: uniqueStrings(asList(extracted?.currentConditions).map((item) => normalizeConditionName(item))),
      functionalLimitations: uniqueStrings(extracted?.functionalLimitations),
      treatmentEvents: uniqueStrings(extracted?.treatmentEvents),
      providerSignals: uniqueStrings(extracted?.providerSignals),
      medicationMentions: uniqueStrings(extracted?.medicationMentions),
      worseningIndicators: uniqueStrings(asList(extracted?.worseningIndicators).map((item) => normalizeConditionName(item))),
      evidenceSnippets: uniqueStrings(extracted?.evidenceSnippets),
    },
  };
}

function normalizeRatingDecision(section = {}) {
  const extracted = section?.extractedFindings && typeof section.extractedFindings === 'object' && !Array.isArray(section.extractedFindings)
    ? section.extractedFindings
    : {};

  return {
    manualEntries: asList(section?.manualEntries).map((item) => ({
      conditionName: normalizeConditionName(item?.conditionName),
      percentage: asText(item?.percentage),
      effectiveDate: asText(item?.effectiveDate),
      isServiceConnected: Boolean(item?.isServiceConnected),
      isDenied: Boolean(item?.isDenied),
      denialReason: asText(item?.denialReason),
      smcCodes: uniqueStrings(item?.smcCodes),
      dependents: asText(item?.dependents),
      combinedRating: asText(item?.combinedRating),
    })),
    extractedFindings: {
      combinedRating: asText(extracted?.combinedRating),
      decisionMetadata: extracted?.decisionMetadata && typeof extracted.decisionMetadata === 'object' ? extracted.decisionMetadata : {},
      serviceConnectedConditions: asList(extracted?.serviceConnectedConditions).map((item) => ({
        ...item,
        conditionName: normalizeConditionName(item?.conditionName || item?.label || item?.condition || item),
      })),
      deniedConditions: asList(extracted?.deniedConditions).map((item) => ({
        ...item,
        conditionName: normalizeConditionName(item?.conditionName || item?.label || item?.condition || item),
      })),
      smcAdjustments: asList(extracted?.smcAdjustments),
      dependentAdjustments: asList(extracted?.dependentAdjustments),
      effectiveDates: asList(extracted?.effectiveDates),
      confidenceBySection: extracted?.confidenceBySection && typeof extracted.confidenceBySection === 'object' ? extracted.confidenceBySection : {},
      evidenceSpans: asList(extracted?.evidenceSpans),
    },
    conflicts: asList(section?.conflicts),
  };
}

export function buildClaimDataUnified(workspace = {}, workflowInput = null) {
  const workflow = workflowInput || deriveWorkflow(workspace);

  const profile = normalizeProfile(workspace?.profile || {});
  const service = normalizeService(workspace, workflow);
  const str = normalizeStrSection(workspace?.serviceTreatmentRecords || {});
  const currentTreatment = normalizeCurrentTreatment(workspace?.currentTreatment || {});
  const ratingDecision = normalizeRatingDecision(workspace?.vaDecision || {});

  const draftUnified = {
    profile,
    service,
    str,
    currentTreatment,
    ratingDecision,
    derivedSignals: {
      exposures: [],
      presumptives: [],
      secondaryCandidates: [],
      worseningIndicators: [],
      unratedConditions: [],
    },
    generatedConditions: [],
    layStatement: '',
    evidenceIndex: [],
    timeline: [],
  };

  const timeline = buildUnifiedTimeline(draftUnified);
  const derivedSignals = runDerivedSignalsEngine(draftUnified);

  const baseUnified = {
    ...draftUnified,
    derivedSignals,
    timeline,
  };

  const generatedConditions = runConditionGeneratorEngine(baseUnified);
  const layStatement = runLayStatementEngine(baseUnified, generatedConditions);
  const evidenceIndex = runEvidenceIndexEngine({ ...baseUnified, generatedConditions }, generatedConditions);

  return {
    ...baseUnified,
    generatedConditions,
    layStatement,
    evidenceIndex,
  };
}
