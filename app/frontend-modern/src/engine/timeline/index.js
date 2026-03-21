/**
 * Engine: timelineBuilder
 * Purpose: Build a normalized, deduplicated, sorted unified timeline across all claim sections.
 * Inputs: claimDataUnified service/str/currentTreatment/ratingDecision sections.
 * Outputs: Array of timeline events with normalized date, source, sourceTag, and summary.
 * Trigger conditions: Any silent update to tab sections participating in unified claim data.
 */
function asList(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value) {
  return String(value || '').trim();
}

function normalizeDate(value) {
  const text = asText(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    if (/^\d{4}$/.test(text)) return `${text}-01-01`;
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function pushEvent(events, event) {
  const summary = asText(event?.summary);
  if (!summary) return;
  events.push({
    date: normalizeDate(event?.date),
    source: asText(event?.source),
    summary,
    sourceTag: asText(event?.sourceTag || event?.source),
    conditionName: asText(event?.conditionName),
  });
}

function uniqueTimeline(events = []) {
  const seen = new Set();
  const deduped = [];
  events.forEach((event) => {
    const key = `${event.date || 'null'}|${event.source}|${event.summary}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(event);
  });
  return deduped;
}

export function buildUnifiedTimeline(claimDataUnified = {}) {
  const events = [];

  asList(claimDataUnified?.service).forEach((item) => {
    pushEvent(events, { date: item?.startDate, source: 'Service', sourceTag: 'service', summary: `Service period started (${item?.branchOfService || 'Unknown branch'})` });
    pushEvent(events, { date: item?.endDate, source: 'Service', sourceTag: 'service', summary: `Service period ended (${item?.branchOfService || 'Unknown branch'})` });
    asList(item?.deploymentLocations).forEach((location) => pushEvent(events, { date: item?.startDate, source: 'Service', sourceTag: 'deployment', summary: `Deployment: ${asText(location)}` }));
    asList(item?.additionalMOS).forEach((mos) => pushEvent(events, { date: item?.startDate, source: 'Service', sourceTag: 'mos', summary: `MOS update: ${asText(mos)}` }));
    asList(item?.hazardPayIndicators).forEach((hazard) => pushEvent(events, { date: item?.startDate, source: 'Service', sourceTag: 'hazard', summary: `Hazard pay indicator: ${asText(hazard)}` }));
    asList(item?.radiationExposure).forEach((rad) => pushEvent(events, { date: item?.startDate, source: 'Service', sourceTag: 'radiation', summary: `Radiation operation: ${asText(rad)}` }));
  });

  asList(claimDataUnified?.str?.manualEntries).forEach((item) => {
    pushEvent(events, {
      date: item?.eventDate,
      source: 'STR',
      sourceTag: 'manual',
      conditionName: item?.conditionName,
      summary: `STR manual entry: ${asText(item?.conditionName)} - ${asText(item?.description)}`,
    });
  });

  asList(claimDataUnified?.str?.extractedFindings?.diagnoses).forEach((condition) => pushEvent(events, { source: 'STR', sourceTag: 'diagnosis', conditionName: condition, summary: `STR diagnosis: ${asText(condition)}` }));
  asList(claimDataUnified?.str?.extractedFindings?.injuries).forEach((condition) => pushEvent(events, { source: 'STR', sourceTag: 'injury', conditionName: condition, summary: `STR injury: ${asText(condition)}` }));
  asList(claimDataUnified?.str?.extractedFindings?.events).forEach((condition) => pushEvent(events, { source: 'STR', sourceTag: 'event', conditionName: condition, summary: `STR event: ${asText(condition)}` }));
  asList(claimDataUnified?.str?.extractedFindings?.audiogramSignals).forEach((item) => pushEvent(events, { source: 'STR', sourceTag: 'audiogram', summary: `Audiogram shift: ${asText(item)}` }));
  asList(claimDataUnified?.str?.extractedFindings?.presumptiveSignals).forEach((item) => pushEvent(events, { source: 'STR', sourceTag: 'presumptive', conditionName: item, summary: `Presumptive signal: ${asText(item)}` }));

  asList(claimDataUnified?.currentTreatment?.manualEntries).forEach((item) => {
    pushEvent(events, {
      date: item?.treatmentStartDate,
      source: 'Treatment',
      sourceTag: 'manual',
      conditionName: item?.conditionName,
      summary: `Treatment started: ${asText(item?.conditionName)} with ${asText(item?.providerName)}`,
    });
    pushEvent(events, {
      date: item?.treatmentEndDate,
      source: 'Treatment',
      sourceTag: 'manual',
      conditionName: item?.conditionName,
      summary: `Treatment update: ${asText(item?.treatmentDetails)}`,
    });
    asList(item?.medications).forEach((med) => {
      pushEvent(events, {
        date: item?.treatmentStartDate,
        source: 'Treatment',
        sourceTag: 'medication',
        conditionName: item?.conditionName,
        summary: `Medication change: ${asText(med?.medicationName)} ${asText(med?.dosage)}`,
      });
    });
  });

  asList(claimDataUnified?.currentTreatment?.extractedFindings?.currentConditions).forEach((condition) => pushEvent(events, { source: 'Treatment', sourceTag: 'diagnosis', conditionName: condition, summary: `Current condition: ${asText(condition)}` }));
  asList(claimDataUnified?.currentTreatment?.extractedFindings?.functionalLimitations).forEach((item) => pushEvent(events, { source: 'Treatment', sourceTag: 'functional', summary: `Functional limitation: ${asText(item)}` }));
  asList(claimDataUnified?.currentTreatment?.extractedFindings?.worseningIndicators).forEach((item) => pushEvent(events, { source: 'Treatment', sourceTag: 'worsening', conditionName: item, summary: `Worsening indicator: ${asText(item)}` }));

  asList(claimDataUnified?.ratingDecision?.manualEntries).forEach((item) => {
    pushEvent(events, {
      date: item?.effectiveDate,
      source: 'Rating Decision',
      sourceTag: 'manual',
      conditionName: item?.conditionName,
      summary: `Rating decision: ${asText(item?.conditionName)} ${asText(item?.percentage)}%`,
    });
  });

  asList(claimDataUnified?.ratingDecision?.extractedFindings?.serviceConnectedConditions).forEach((item) => pushEvent(events, { date: item?.effectiveDate, source: 'Rating Decision', sourceTag: 'grant', conditionName: item?.conditionName || item, summary: `Granted: ${asText(item?.conditionName || item)}` }));
  asList(claimDataUnified?.ratingDecision?.extractedFindings?.deniedConditions).forEach((item) => pushEvent(events, { date: item?.effectiveDate, source: 'Rating Decision', sourceTag: 'denial', conditionName: item?.conditionName || item, summary: `Denied: ${asText(item?.conditionName || item)}` }));
  asList(claimDataUnified?.ratingDecision?.extractedFindings?.smcAdjustments).forEach((item) => pushEvent(events, { source: 'Rating Decision', sourceTag: 'smc', summary: `SMC adjustment: ${asText(item?.type || item)}` }));

  return uniqueTimeline(events).sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.summary.localeCompare(b.summary);
  });
}
