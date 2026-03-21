import { getCfrSectionForDiagnosticCode } from '../../../../services/cfrIndexService.js';

let cachedDirectLookups = new Map();

function normalizeCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9.]/g, '')
    .replace(/\.+/g, '.');
}

function codeWithoutDot(value) {
  return normalizeCode(value).replace(/\./g, '');
}

async function resolveCodeFromCfrIndex(rawCode) {
  const normalized = normalizeCode(rawCode);
  const normalizedNoDot = codeWithoutDot(normalized);
  if (!normalizedNoDot) return null;

  if (cachedDirectLookups.has(normalizedNoDot)) {
    return cachedDirectLookups.get(normalizedNoDot);
  }

  const direct = await getCfrSectionForDiagnosticCode(normalizedNoDot);
  const record = direct
    ? {
        code: normalized,
        title: direct?.sectionTitle || null,
        cfrSection: direct?.sectionNumber || null,
      }
    : null;

  cachedDirectLookups.set(normalizedNoDot, record);
  return record;
}

export async function validateDiagnosticCodes(conditions = []) {
  const validations = [];

  for (const condition of Array.isArray(conditions) ? conditions : []) {
    const rawCode = condition?.diagnosticCode || null;
    const normalized = normalizeCode(rawCode);

    if (!normalized) {
      validations.push({
        conditionName: condition?.conditionName || condition?.condition || null,
        diagnosticCode: null,
        isValid: false,
        reason: 'No diagnostic code found in source text.',
        matchedReference: null,
      });
      continue;
    }

    const match = await resolveCodeFromCfrIndex(normalized);
    validations.push({
      conditionName: condition?.conditionName || condition?.condition || null,
      diagnosticCode: normalized,
      isValid: Boolean(match),
      reason: match ? 'Diagnostic code found in local knowledge index.' : 'Diagnostic code not found in local knowledge index.',
      matchedReference: match
        ? {
            code: match.code,
            title: match.title,
            cfrSection: match.cfrSection,
          }
        : null,
    });
  }

  return {
    schemaVersion: '1.0.0',
    source: 'local-knowledge-index-only',
    validations,
  };
}
