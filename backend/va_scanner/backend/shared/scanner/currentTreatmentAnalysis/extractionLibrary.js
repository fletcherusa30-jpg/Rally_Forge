/**
 * Deterministic extraction library for current treatment text.
 */

function parseDateFromText(text) {
  const ymd = text.match(/\b(20\d{2}|19\d{2})[\/-](\d{1,2})[\/-](\d{1,2})\b/);
  if (ymd) return `${ymd[1]}-${String(ymd[2]).padStart(2, '0')}-${String(ymd[3]).padStart(2, '0')}`;

  const mdy = text.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2}|19\d{2})\b/);
  if (mdy) return `${mdy[3]}-${String(mdy[1]).padStart(2, '0')}-${String(mdy[2]).padStart(2, '0')}`;

  return null;
}

function splitLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function pushUnique(target, keySet, key, item) {
  const normalizedKey = String(key || '').toLowerCase();
  if (keySet.has(normalizedKey)) return;
  keySet.add(normalizedKey);
  target.push(item);
}

export function extractCurrentTreatmentData(text) {
  const lines = splitLines(text);
  const conditions = [];
  const worseningConditions = [];
  const functionalLimitations = [];
  const medications = [];
  const treatments = [];
  const providers = [];
  const testsAndResults = [];
  const appointments = [];

  const seen = {
    conditions: new Set(),
    worsening: new Set(),
    functional: new Set(),
    medications: new Set(),
    treatments: new Set(),
    providers: new Set(),
    tests: new Set(),
    appointments: new Set(),
  };

  const conditionPattern = /\b(?:diagnosis|assessment|impression|condition)\s*[:\-]?\s*(.+)$/i;
  const worseningPattern = /\b(?:worsen(?:ed|ing)?|progress(?:ed|ion)|increased pain|decline|flare(?:-?up)?)\b/i;
  const functionalPattern = /\b(?:unable to|difficulty|limited|cannot|reduced range|missed work|interferes with)\b/i;
  const medicationPattern = /\b(?:medication|prescribed|rx|started on|continue(?:d)? on)\s*[:\-]?\s*(.+)$/i;
  const treatmentPattern = /\b(?:therapy|rehab|injection|surgery|procedure|treatment plan|counseling|follow-?up)\b/i;
  const providerPattern = /\b(?:dr\.|doctor|np\b|pa\b|provider|clinic|specialist|psychiatry|orthopedic|neurology|primary care)\b/i;
  const testPattern = /\b(?:mri|ct|x-?ray|ultrasound|emg|lab(?:s)?|bloodwork|a1c|spirometry|pft)\b/i;
  const appointmentPattern = /\b(?:follow-?up|next visit|seen on|appointment|return in)\b/i;

  lines.forEach((line, index) => {
    const date = parseDateFromText(line);
    const lineNumber = index + 1;

    const conditionMatch = line.match(conditionPattern);
    if (conditionMatch) {
      const value = String(conditionMatch[1] || '').trim() || line;
      pushUnique(conditions, seen.conditions, `${value}|${date || ''}`, { value, date, lineNumber, rawText: line });
    }

    if (worseningPattern.test(line)) {
      pushUnique(worseningConditions, seen.worsening, `${line}|${date || ''}`, { value: line, date, lineNumber, rawText: line });
    }

    if (functionalPattern.test(line)) {
      pushUnique(functionalLimitations, seen.functional, `${line}|${date || ''}`, { value: line, date, lineNumber, rawText: line });
    }

    const medicationMatch = line.match(medicationPattern);
    if (medicationMatch || /\b(?:ibuprofen|gabapentin|sertraline|fluoxetine|naproxen|tramadol|acetaminophen|albuterol|omeprazole)\b/i.test(line)) {
      const value = String(medicationMatch?.[1] || medicationMatch?.[0] || line).trim();
      pushUnique(medications, seen.medications, `${value}|${date || ''}`, { value, date, lineNumber, rawText: line });
    }

    if (treatmentPattern.test(line)) {
      pushUnique(treatments, seen.treatments, `${line}|${date || ''}`, { value: line, date, lineNumber, rawText: line });
    }

    if (providerPattern.test(line)) {
      pushUnique(providers, seen.providers, `${line}|${date || ''}`, { value: line, date, lineNumber, rawText: line });
    }

    if (testPattern.test(line)) {
      pushUnique(testsAndResults, seen.tests, `${line}|${date || ''}`, { value: line, date, lineNumber, rawText: line });
    }

    if (appointmentPattern.test(line)) {
      pushUnique(appointments, seen.appointments, `${line}|${date || ''}`, { value: line, date, lineNumber, rawText: line });
    }
  });

  return {
    currentConditions: conditions,
    worseningConditions,
    functionalLimitations,
    medications,
    treatments,
    providers,
    testsAndResults,
    appointments,
  };
}
