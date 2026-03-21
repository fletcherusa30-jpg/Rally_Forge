import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPart3, loadPart4, loadDiagnosticCodes } from './knowledgeBaseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_INDEX_PATH = path.join(REPO_ROOT, 'knowledge', 'cfr', 'cfr-index.json');
const DEFAULT_DBQ_LINKS_PATH = path.join(REPO_ROOT, 'knowledge', 'cfr', 'cfr-dbq-links.json');

let cache = null;
let dbqLinksCache = null;

function normalizeSection(value) {
  return String(value || '').replace(/^§\s*/, '').trim().toLowerCase();
}

function toPartNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseEcfrUrl(ecfrUrl) {
  const url = String(ecfrUrl || '').trim();
  if (!url) return null;

  const titleMatch = url.match(/title-(\d+)/i);
  const partMatch = url.match(/part-(\d+)/i);

  const sectionHashMatch = url.match(/#(?:§|section-)?(?:[0-9]+\.)?([0-9]+\.[0-9]+[a-z]?)/i);
  const inPathSectionMatch = url.match(/part-\d+\/section-([0-9]+\.[0-9]+[a-z]?)/i);

  return {
    title: titleMatch ? Number(titleMatch[1]) : 38,
    part: partMatch ? Number(partMatch[1]) : null,
    section: normalizeSection(sectionHashMatch?.[1] || inPathSectionMatch?.[1] || ''),
    ecfrUrl: url,
  };
}

function buildSectionMaps(index) {
  const byPart = new Map();
  const byPartSection = new Map();
  const byId = new Map();

  const parts = index?.cfrIndex?.parts || [];
  for (const part of parts) {
    const partNum = toPartNumber(part?.partNumber);
    if (!partNum) continue;

    byPart.set(partNum, part);

    for (const section of part?.sections || []) {
      const key = `${partNum}|${normalizeSection(section?.sectionNumber)}`;
      byPartSection.set(key, section);
      if (section?.id) byId.set(section.id, section);
    }
  }

  return { byPart, byPartSection, byId };
}

function mapDbqRowsToCfrLinks(rows, maps) {
  const links = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const ecfrUrl = row?.['URL for eCFR reference'] || row?.ecfrUrl || row?.ecfr || '';
    const parsed = parseEcfrUrl(ecfrUrl);
    const part = parsed?.part;
    const section = normalizeSection(parsed?.section);

    const localSection = part && section ? maps.byPartSection.get(`${part}|${section}`) : null;

    const link = {
      dxCode: String(row?.['DX Code'] || row?.dxCode || '').trim() || null,
      requiredDbq: row?.['Required DBQ'] || row?.requiredDbq || null,
      cfrLink: {
        title: parsed?.title || 38,
        part: part || null,
        section: section || null,
        localSectionId: localSection?.id || null,
        ecfrUrl: parsed?.ecfrUrl || null,
      },
    };

    links.push(link);
  }

  return links;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadFallbackIndex() {
  const [part3, part4, diagnosticCodes] = await Promise.all([
    loadPart3(),
    loadPart4(),
    loadDiagnosticCodes(),
  ]);

  const makeSections = (partNumber, sections = []) => sections.map((section, idx) => ({
    id: `cfr38-p${partNumber}-legacy-${idx + 1}`,
    titleNumber: 38,
    partNumber,
    sectionNumber: normalizeSection(section?.sectionNumber || `${partNumber}.${idx + 1}`),
    sectionTitle: section?.title || null,
    headings: [],
    paragraphStructure: [],
    diagnosticCodeRefs: [],
    rawTextLocation: {
      pdfPageRange: { start: null, end: null },
      offsets: { start: null, end: null },
    },
    confidence: 0.4,
  }));

  const part4Sections = makeSections(4, part4);
  const dcRefs = new Map();
  for (const dc of Array.isArray(diagnosticCodes) ? diagnosticCodes : []) {
    const section = normalizeSection(dc?.section || dc?.cfrSection || dc?.cfr || '');
    if (!section) continue;
    if (!dcRefs.has(section)) dcRefs.set(section, new Set());
    if (dc?.code) dcRefs.get(section).add(String(dc.code));
  }

  for (const section of part4Sections) {
    const refs = dcRefs.get(normalizeSection(section.sectionNumber));
    if (refs) section.diagnosticCodeRefs = [...refs].sort();
  }

  return {
    cfrIndex: {
      title: 38,
      parts: [
        {
          partNumber: 3,
          partTitle: 'Part 3 (fallback)',
          sections: makeSections(3, part3),
        },
        {
          partNumber: 4,
          partTitle: 'Part 4 (fallback)',
          sections: part4Sections,
        },
      ],
    },
    metadata: {
      builtAt: new Date().toISOString(),
      source: 'knowledgeBaseService fallback',
      confidence: 'low',
    },
  };
}

export async function loadCfrIndex({ forceReload = false } = {}) {
  if (!forceReload && cache) return cache;

  let index = null;
  if (await exists(DEFAULT_INDEX_PATH)) {
    const raw = await fs.readFile(DEFAULT_INDEX_PATH, 'utf8');
    index = JSON.parse(raw);
  } else {
    index = await loadFallbackIndex();
  }

  const maps = buildSectionMaps(index);
  cache = { index, maps };
  return cache;
}

export async function getCfrPart(partNumber) {
  const { maps } = await loadCfrIndex();
  return maps.byPart.get(Number(partNumber)) || null;
}

export async function getCfrSection({ partNumber, sectionNumber }) {
  const { maps } = await loadCfrIndex();
  const key = `${Number(partNumber)}|${normalizeSection(sectionNumber)}`;
  return maps.byPartSection.get(key) || null;
}

export async function getCfrSectionById(sectionId) {
  const { maps } = await loadCfrIndex();
  return maps.byId.get(sectionId) || null;
}

export async function getCfrSectionForDiagnosticCode(code) {
  const normalizedCode = String(code || '').replace(/[^0-9]/g, '');
  if (!normalizedCode) return null;

  const { index } = await loadCfrIndex();
  for (const part of index?.cfrIndex?.parts || []) {
    if (Number(part?.partNumber) !== 4) continue;
    for (const section of part?.sections || []) {
      const refs = (section?.diagnosticCodeRefs || []).map((ref) => String(ref).replace(/[^0-9]/g, ''));
      if (refs.includes(normalizedCode)) {
        return section;
      }
    }
  }

  return null;
}

export async function attachCfrLinksToDbqRows(rows = []) {
  const { maps } = await loadCfrIndex();
  const links = mapDbqRowsToCfrLinks(rows, maps);

  return rows.map((row, idx) => ({
    ...row,
    cfrLink: links[idx]?.cfrLink || {
      title: 38,
      part: null,
      section: null,
      localSectionId: null,
      ecfrUrl: null,
    },
  }));
}

export async function writeDbqCfrLinks(rows = []) {
  const { maps } = await loadCfrIndex();
  const links = mapDbqRowsToCfrLinks(rows, maps);
  await fs.mkdir(path.dirname(DEFAULT_DBQ_LINKS_PATH), { recursive: true });
  await fs.writeFile(
    DEFAULT_DBQ_LINKS_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), links }, null, 2),
    'utf8'
  );
  return { outputPath: DEFAULT_DBQ_LINKS_PATH, linksCount: links.length };
}

export async function loadDbqCfrLinks({ forceReload = false } = {}) {
  if (!forceReload && dbqLinksCache) return dbqLinksCache;

  if (await exists(DEFAULT_DBQ_LINKS_PATH)) {
    const raw = await fs.readFile(DEFAULT_DBQ_LINKS_PATH, 'utf8');
    dbqLinksCache = JSON.parse(raw);
    return dbqLinksCache;
  }

  dbqLinksCache = { generatedAt: null, links: [] };
  return dbqLinksCache;
}

export async function getDbqLinksForSection(sectionId) {
  const bundle = await loadDbqCfrLinks();
  return (bundle?.links || []).filter((entry) => entry?.cfrLink?.localSectionId === sectionId);
}

export async function getDbqLinkByDxCode(dxCode) {
  const normalized = String(dxCode || '').replace(/[^0-9]/g, '');
  if (!normalized) return null;

  const bundle = await loadDbqCfrLinks();
  return (bundle?.links || []).find((entry) => String(entry?.dxCode || '').replace(/[^0-9]/g, '') === normalized) || null;
}

export { parseEcfrUrl, normalizeSection };
