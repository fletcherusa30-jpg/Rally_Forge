import { parseDD214Continuations, mergeContinuationIntoBlocks } from './dd214ContinuationParser.js';
import { DD214_BLOCK_MAP_SCHEMA_VERSION, resolveDD214Template } from './dd214TemplateLibrary.js';

function cleanValue(value) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function normalizeBlockId(blockNumber, blockSuffix) {
  const number = String(blockNumber || '').trim();
  const suffix = String(blockSuffix || '').trim().toLowerCase();
  if (!number) return null;
  return suffix ? `${number}${suffix}` : number;
}

function finalizeBuffer(buffer) {
  return cleanValue(buffer.join(' '));
}

function trimBlockNoise(value, blockId) {
  const text = String(value || '').trim();
  if (!text) return null;

  const terminators = blockId === '13'
    ? [
      /\bCONT\s+FROM\s+BLOCK\s+14\b/i,
      /\bSEE\s+ATTACHED\s+CONTINUATION\s+SHEET\b/i,
      /\bCERTIFICATE\s+OF\s+RELEASE\s+OR\s+DISCHARGE\b/i,
      /\bDD\s*FORM\s*214C\b/i,
      /\bCAUTION\s*:\s*NOT\s+TO\s+BE\s+USED\b/i,
      /\bMEMBER\s+REQUESTS\s+COPY\b/i,
      /\bSPECIAL\s+ADDITIONAL\s+INFORMATION\b/i,
    ]
    : [
      /\bMEMBER\s+REQUESTS\s+COPY\b/i,
      /\bDATE\s+SIGNED\b/i,
      /\bSIGNATURE\s+OF\s+MEMBER\b/i,
      /\bDD\s*FORM\s*214C\b/i,
      /\bCAUTION\s*:\s*NOT\s+TO\s+BE\s+USED\b/i,
    ];

  let trimmed = text;
  for (const pattern of terminators) {
    const match = trimmed.match(pattern);
    if (match?.index > 0) {
      trimmed = trimmed.slice(0, match.index).trim();
      break;
    }
  }

  return cleanValue(trimmed);
}

function parseAnchoredBlocks(text) {
  const lines = String(text || '').split(/\r?\n/);
  const blocks = {};
  let activeBlock = null;
  let buffer = [];

  const headerPattern = /^\s*(\d{1,2})([a-z])?[\.)]?\s+([^\n]*)$/i;

  for (const rawLine of lines) {
    const line = String(rawLine || '');
    const header = line.match(headerPattern);

    if (header) {
      if (activeBlock) blocks[activeBlock] = finalizeBuffer(buffer);

      activeBlock = normalizeBlockId(header[1], header[2]);
      buffer = [];
      const trailing = String(header[3] || '');
      // Capture inline value from the same line as the block header.
      // Require a colon separator when present; otherwise fall back to the full
      // trailing text only when it contains digits (date/code/numeric fields).
      // Pure label lines (e.g. "DATE ENTERED ACTIVE DUTY THIS PERIOD") have no
      // digits and are intentionally skipped so they don't pollute text blocks.
      const inline = trailing.includes(':')
        ? cleanValue(trailing.split(':').slice(1).join(':'))
        : (/\d/.test(trailing) ? cleanValue(trailing) : null);
      if (inline) buffer.push(inline);
      continue;
    }

    if (activeBlock) {
      const payload = cleanValue(line);
      if (payload) buffer.push(payload);
    }
  }

  if (activeBlock) blocks[activeBlock] = finalizeBuffer(buffer);
  return blocks;
}

function toLegacyShape(blocks, continuation) {
  const merged = mergeContinuationIntoBlocks(blocks, continuation);
  if (merged['13']) merged['13'] = trimBlockNoise(merged['13'], '13');
  if (merged['18']) merged['18'] = trimBlockNoise(merged['18'], '18');
  return {
    block1_name: merged['1'] || null,
    block2_branch: merged['2'] || null,
    block3_ssn: merged['3'] || null,
    block11_specialty: merged['11'] || null,
    block12a_entry: merged['12a'] || null,
    block12b_separation: merged['12b'] || null,
    block12c_netActive: merged['12c'] || null,
    block12d_priorActive: merged['12d'] || null,
    block12e_priorInactive: merged['12e'] || null,
    block12f_foreign: merged['12f'] || null,
    block12g_sea: merged['12g'] || null,
    block13_awards: merged['13'] || null,
    block18_remarks: merged['18'] || null,
    block25_authority: merged['25'] || null,
    block26_spd: merged['26'] || null,
    block27_re: merged['27'] || null,
    block28_reason: merged['28'] || null,
  };
}

export function detectDD214Blocks(rawText, variantDetection = null) {
  const text = String(rawText || '');
  const template = resolveDD214Template(variantDetection, text);
  const anchoredBlocks = parseAnchoredBlocks(text);
  const continuation = parseDD214Continuations(text);
  const blocks = mergeContinuationIntoBlocks(anchoredBlocks, continuation);
  if (blocks['13']) blocks['13'] = trimBlockNoise(blocks['13'], '13');
  if (blocks['18']) blocks['18'] = trimBlockNoise(blocks['18'], '18');

  return {
    schemaVersion: DD214_BLOCK_MAP_SCHEMA_VERSION,
    templateId: template.templateId,
    templateLabel: template.label,
    expectedBlocks: template.expectedBlocks,
    supportsContinuation: template.supportsContinuation,
    blocks,
    continuation,
    ...toLegacyShape(anchoredBlocks, continuation),
  };
}
