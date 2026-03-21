const VARIANT_TYPES = Object.freeze({
  DD214_MEMBER_1: 'DD214_MEMBER_1',
  DD214_MEMBER_4: 'DD214_MEMBER_4',
  DD214_SERVICE_COPY: 'DD214_SERVICE_COPY',
  DD214_VETERANS_COPY: 'DD214_VETERANS_COPY',
  DD214_REDACTED: 'DD214_REDACTED',
  DD214_CONTINUATION: 'DD214_CONTINUATION',
  DD215_CORRECTION: 'DD215_CORRECTION',
  NGB22: 'NGB22',
  NGB23: 'NGB23',
  DD214_LEGACY_PRE_1980: 'DD214_LEGACY_PRE_1980',
  DD214_GENERIC: 'DD214_GENERIC',
  UNKNOWN: 'UNKNOWN',
});

function has(text, pattern) {
  return pattern.test(String(text || ''));
}

function detectCopyType(text) {
  if (has(text, /\bMEMBER\s*[- ]?4\b/i)) return VARIANT_TYPES.DD214_MEMBER_4;
  if (has(text, /\bMEMBER\s*[- ]?1\b/i)) return VARIANT_TYPES.DD214_MEMBER_1;
  if (has(text, /\bSERVICE\s+COPY\b/i)) return VARIANT_TYPES.DD214_SERVICE_COPY;
  if (has(text, /\bVETERANS?\s+COPY\b/i)) return VARIANT_TYPES.DD214_VETERANS_COPY;
  return null;
}

function detectFormType(text) {
  if (has(text, /\bDD\s*FORM\s*215\b|\bCORRECTION\s+TO\s+DD\s*FORM\s*214\b/i)) return VARIANT_TYPES.DD215_CORRECTION;
  if (has(text, /\bNGB\s*FORM\s*22\b|\bREPORT\s+OF\s+SEPARATION\s+AND\s+RECORD\s+OF\s+SERVICE\b/i)) return VARIANT_TYPES.NGB22;
  if (has(text, /\bNGB\s*FORM\s*23\b|\bRETIREMENT\s+POINTS\b/i)) return VARIANT_TYPES.NGB23;
  if (has(text, /\bDD\s*FORM\s*214\b|\bCERTIFICATE\s+OF\s+RELEASE\s+OR\s+DISCHARGE\s+FROM\s+ACTIVE\s+DUTY\b/i)) return VARIANT_TYPES.DD214_GENERIC;
  return VARIANT_TYPES.UNKNOWN;
}

function detectLayout(text) {
  const raw = String(text || '');
  const lines = raw.split(/\r?\n/);
  const longLines = lines.filter((line) => line.length >= 120).length;
  const withPipe = lines.filter((line) => /\|/.test(line)).length;
  const twoColumnSignals = lines.filter((line) => /\s{10,}.+\s{10,}/.test(line)).length;

  if (withPipe > 5 || twoColumnSignals > 5) return 'two-column';
  if (longLines > Math.max(8, Math.floor(lines.length * 0.2))) return 'horizontal';
  if (lines.filter((line) => /^\s*\d{1,2}[a-z]?\./i.test(line)).length > 8) return 'block-indexed';
  return 'single-column';
}

export function detectDD214Variant(rawText) {
  const text = String(rawText || '');
  const formType = detectFormType(text);
  const copyType = detectCopyType(text);

  const variantType =
    copyType ||
    (has(text, /\bCONT(INUATION)?\s+SHEET\b|\bDD\s*FORM\s*214C\b/i) ? VARIANT_TYPES.DD214_CONTINUATION : null) ||
    (has(text, /\bREDACTED\b|\bXXX-XX-\d{4}\b|\bPRIVACY\s+ACT\b/i) ? VARIANT_TYPES.DD214_REDACTED : null) ||
    (has(text, /\bDD\s*FORM\s*214\b.*\b(NOV|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*(19[0-7]\d)\b/i)
      ? VARIANT_TYPES.DD214_LEGACY_PRE_1980
      : null) ||
    formType;

  return {
    formType,
    variantType,
    layoutType: detectLayout(text),
    supportsBlockMap: /\b1\.|\b2\.|\b3\.|\b12a\b|\b12b\b|\b25\b|\b26\b|\b27\b|\b28\b/i.test(text),
    isMultiPageLikely: /\bCONTINUATION\s+SHEET\b|\bPAGE\s+\d+\s+OF\s+\d+\b/i.test(text),
  };
}

export function looksLikeSupportedSeparationDocument(rawText) {
  const variant = detectDD214Variant(rawText);
  return variant.formType !== VARIANT_TYPES.UNKNOWN;
}

export { VARIANT_TYPES };
