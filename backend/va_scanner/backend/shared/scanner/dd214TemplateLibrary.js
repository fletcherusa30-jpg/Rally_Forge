export const DD214_BLOCK_MAP_SCHEMA_VERSION = '1.0.0';

export const DD214_TEMPLATE_LIBRARY = Object.freeze({
  DD214_MEMBER_1: {
    templateId: 'dd214-member-1',
    label: 'DD Form 214 Member 1',
    supportsContinuation: true,
    expectedBlocks: ['1', '2', '3', '11', '12a', '12b', '12c', '13', '18', '25', '26', '27', '28'],
  },
  DD214_MEMBER_4: {
    templateId: 'dd214-member-4',
    label: 'DD Form 214 Member 4',
    supportsContinuation: true,
    expectedBlocks: ['1', '2', '3', '11', '12a', '12b', '12c', '13', '18', '25', '26', '27', '28'],
  },
  DD214_SERVICE_COPY: {
    templateId: 'dd214-service-copy',
    label: 'DD Form 214 Service Copy',
    supportsContinuation: true,
    expectedBlocks: ['1', '2', '3', '11', '12a', '12b', '12c', '13', '18', '25', '26', '27', '28'],
  },
  DD214_CONTINUATION: {
    templateId: 'dd214-continuation',
    label: 'DD Form 214 Continuation Sheet / DD214C',
    supportsContinuation: true,
    expectedBlocks: ['13', '18'],
  },
  DD214_LEGACY_PRE_1980: {
    templateId: 'dd214-legacy-pre-1980',
    label: 'DD Form 214 Legacy Pre-1980',
    supportsContinuation: false,
    expectedBlocks: ['1', '2', '3', '11', '12a', '12b', '12c', '13', '18'],
  },
  TRANSPROC_IPPSA: {
    templateId: 'dd214-transproc-ippsa',
    label: 'TRANSPROC / IPPS-A Exported DD214',
    supportsContinuation: true,
    expectedBlocks: ['1', '2', '3', '11', '12a', '12b', '12c', '13', '18', '25', '26', '27', '28'],
  },
  DEFAULT: {
    templateId: 'dd214-generic',
    label: 'DD Form 214 Generic',
    supportsContinuation: true,
    expectedBlocks: ['1', '2', '11', '12a', '12b', '12c', '13', '18'],
  },
});

function detectTransprocIppsa(text) {
  return /\b(?:TRANSPROC|IPPS-A|INTEGRATED\s+PERSONNEL\s+AND\s+PAY\s+SYSTEM)\b/i.test(String(text || ''));
}

export function resolveDD214Template(variantDetection, rawText = '') {
  if (detectTransprocIppsa(rawText)) return DD214_TEMPLATE_LIBRARY.TRANSPROC_IPPSA;
  const key = String(variantDetection?.variantType || '').toUpperCase();
  return DD214_TEMPLATE_LIBRARY[key] || DD214_TEMPLATE_LIBRARY.DEFAULT;
}
