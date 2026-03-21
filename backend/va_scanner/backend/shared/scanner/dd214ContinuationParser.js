function cleanLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeBlockId(raw) {
  const token = String(raw || '').toLowerCase().replace(/\s+/g, '');
  if (token === '13' || token === '18') return token;
  return null;
}

export function parseDD214Continuations(rawText) {
  const text = String(rawText || '');
  const lines = text.split(/\r?\n/);
  const continuation = { '13': [], '18': [] };

  for (const line of lines) {
    const inline = line.match(/\bCONT(?:INUED)?\s+FROM\s+BLOCK\s*(13|18)\s*[:\-]?\s*(.*)$/i);
    if (inline) {
      const blockId = normalizeBlockId(inline[1]);
      const payload = cleanLine(inline[2]);
      if (blockId && payload) continuation[blockId].push(payload);
    }
  }

  const continuationSections = [
    ...text.matchAll(/\b(?:DD\s*FORM\s*214C|CONTINUATION\s+SHEET)\b[\s\S]{0,4000}/gi),
  ].map((match) => match[0]);

  for (const section of continuationSections) {
    const chunks = section.split(/\r?\n/);
    let active = null;
    for (const line of chunks) {
      const start = line.match(/^\s*(?:CONT(?:INUED)?\s+FROM\s+)?BLOCK\s*(13|18)\b[:\-]?\s*(.*)$/i);
      if (start) {
        active = normalizeBlockId(start[1]);
        const first = cleanLine(start[2]);
        if (active && first) continuation[active].push(first);
        continue;
      }

      if (active) {
        if (/^\s*(?:BLOCK\s*\d+|\d{1,2}[a-z]?\.|PAGE\s+\d+\s+OF\s+\d+)\b/i.test(line)) {
          active = null;
          continue;
        }
        const value = cleanLine(line);
        if (value) continuation[active].push(value);
      }
    }
  }

  return {
    '13': [...new Set(continuation['13'])],
    '18': [...new Set(continuation['18'])],
  };
}

export function mergeContinuationIntoBlocks(blockMap, continuationMap) {
  const merged = { ...(blockMap || {}) };
  const continuation = continuationMap || { '13': [], '18': [] };

  ['13', '18'].forEach((blockId) => {
    const base = String(merged[blockId] || '').trim();
    const extra = (continuation[blockId] || []).map((item) => cleanLine(item)).filter(Boolean);
    if (extra.length === 0) return;
    merged[blockId] = base ? `${base}\n${extra.join('\n')}` : extra.join('\n');
  });

  return merged;
}
