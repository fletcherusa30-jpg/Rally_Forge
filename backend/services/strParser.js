/**
 * STR Parser - Service Treatment Records and Clinical Documents
 * Extracts medical information from VA Service Treatment Records (STR) and Clinical Treatment Records (CTR)
 */

function parseSTR(payload = {}) {
  return {
    type: 'STR',
    sourceType: 'service-treatment-record',
    parsed: {
      facilityCode: payload.facilityCode || null,
      treatmentDates: {
        from: payload.treatmentDates?.from || null,
        to: payload.treatmentDates?.to || null,
      },
      conditions: extractConditions(payload.conditions || []),
      medications: extractMedications(payload.medications || []),
      notes: extractNotes(payload.notes || payload.clinicalNotes || ''),
      provider: {
        name: payload.provider?.name || null,
        specialty: payload.provider?.specialty || null,
      },
    },
  };
}

function parseCTR(payload = {}) {
  return {
    type: 'CTR',
    sourceType: 'clinical-treatment-record',
    parsed: {
      treatmentFacility: payload.treatmentFacility || null,
      treatmentDates: {
        from: payload.treatmentDates?.from || null,
        to: payload.treatmentDates?.to || null,
      },
      conditions: extractConditions(payload.conditions || []),
      diagnosesCodes: payload.diagnosisCodes || [],
      treatments: extractTreatments(payload.treatments || []),
      outcomes: payload.outcomes || null,
      notes: extractNotes(payload.notes || payload.clinicalNotes || ''),
    },
  };
}

function extractConditions(conditions) {
  if (!Array.isArray(conditions)) return [];
  return conditions.map((c) => ({
    name: String(c.name || c || '').trim(),
    icdCode: String(c.icdCode || '').trim() || null,
    serviceConnected: Boolean(c.serviceConnected),
    rating: c.rating || null,
  }));
}

function extractMedications(medications) {
  if (!Array.isArray(medications)) return [];
  return medications.map((m) => ({
    name: String(m.name || m || '').trim(),
    dosage: String(m.dosage || '').trim() || null,
    frequency: String(m.frequency || '').trim() || null,
    startDate: m.startDate || null,
    endDate: m.endDate || null,
  }));
}

function extractTreatments(treatments) {
  if (!Array.isArray(treatments)) return [];
  return treatments.map((t) => ({
    type: String(t.type || '').trim(),
    description: String(t.description || '').trim(),
    dates: {
      from: t.dates?.from || null,
      to: t.dates?.to || null,
    },
  }));
}

function extractNotes(notes) {
  return String(notes || '').trim().substring(0, 5000);
}

export {
  extractConditions,
  extractMedications,
  extractNotes,
  extractTreatments,
  parseCTR,
  parseSTR,
};
