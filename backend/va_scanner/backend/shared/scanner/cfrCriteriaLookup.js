import { getCfrPart, getCfrSectionForDiagnosticCode } from '../../../../services/cfrIndexService.js';

function normalize(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function buildSnippet(text, needle) {
  const source = String(text || '');
  const lower = source.toLowerCase();
  const idx = lower.indexOf(String(needle || '').toLowerCase());
  if (idx < 0) return source.slice(0, 220) || null;
  const start = Math.max(0, idx - 80);
  const end = Math.min(source.length, idx + String(needle).length + 120);
  return source.slice(start, end).replace(/\s+/g, ' ').trim();
}

function scoreSection(section, conditionName, diagnosticCode) {
  const haystack = normalize(`${section?.sectionNumber || ''} ${section?.title || ''} ${section?.rawText || ''}`);
  const condition = normalize(conditionName);
  const code = String(diagnosticCode || '').replace(/\s+/g, '');

  let score = 0;
  if (condition && haystack.includes(condition)) score += 3;
  if (code && haystack.includes(code)) score += 4;
  if (code && code.includes('.') && haystack.includes(code.replace('.', ''))) score += 2;

  return score;
}

export async function lookupCfrCriteria(conditions = []) {
  const part4 = await getCfrPart(4);
  const part4Sections = part4?.sections || [];
  const lookups = [];

  for (const condition of Array.isArray(conditions) ? conditions : []) {
    const conditionName = condition?.conditionName || condition?.condition || null;
    const diagnosticCode = condition?.diagnosticCode || null;

    const sectionByCode = diagnosticCode ? await getCfrSectionForDiagnosticCode(diagnosticCode) : null;

    const ranked = (Array.isArray(part4Sections) ? part4Sections : [])
      .map((section) => ({ section, score: scoreSection(section, conditionName, diagnosticCode) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ section, score }) => ({
        sectionId: section?.id || null,
        sectionNumber: section?.sectionNumber || null,
        title: section?.sectionTitle || section?.title || null,
        matchScore: score,
        snippet: buildSnippet(`${section?.sectionTitle || section?.title || ''}`, diagnosticCode || conditionName),
      }));

    if (sectionByCode && !ranked.some((item) => item.sectionNumber === sectionByCode.sectionNumber)) {
      ranked.unshift({
        sectionId: sectionByCode?.id || null,
        sectionNumber: sectionByCode?.sectionNumber || null,
        title: sectionByCode?.sectionTitle || null,
        matchScore: 999,
        snippet: buildSnippet(`${sectionByCode?.sectionTitle || ''}`, diagnosticCode || conditionName),
      });
    }

    lookups.push({
      conditionName,
      diagnosticCode,
      matchedCriteria: ranked,
      note: ranked.length
        ? 'Criteria references found in local CFR index.'
        : 'No CFR criteria match found in local index for this condition/code.',
    });
  }

  return {
    schemaVersion: '1.0.0',
    source: 'local-cfr-index-only',
    lookups,
  };
}
