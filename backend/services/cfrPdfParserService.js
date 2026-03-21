import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

function normalizeLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function hasNonPrintableAscii(value) {
  const raw = String(value || '');
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13) continue;
    if (code < 32 || code > 126) return true;
  }
  return false;
}

function toConfidence(line) {
  const raw = String(line || '');
  if (!raw.trim()) return 0;
  if (/�/.test(raw)) return 0.3;
  if (hasNonPrintableAscii(raw)) return 0.45;
  if (/(?:\bI\b|\bl\b|\b1\b){3,}/.test(raw)) return 0.5;
  return 0.95;
}

function extractDiagnosticRefs(text) {
  const refs = new Set();
  const source = String(text || '');

  for (const match of source.matchAll(/\b(?:diagnostic\s+code|dc)\s*[:#]?\s*(\d{4})\b/gi)) {
    refs.add(match[1]);
  }

  for (const match of source.matchAll(/(?:^|\s)(\d{4})(?=\s+[A-Z][A-Za-z])/g)) {
    refs.add(match[1]);
  }

  return [...refs].sort();
}

function parseParagraphLabel(line) {
  const normalized = String(line || '').trim();
  const labelMatch = normalized.match(/^\(([a-z]|\d+|[ivxlcdm]+|[A-Z])\)\s+/);
  if (!labelMatch) return null;

  const label = labelMatch[1];
  let level = 1;
  if (/^\d+$/.test(label)) level = 2;
  else if (/^[ivxlcdm]+$/.test(label)) level = 3;
  else if (/^[A-Z]$/.test(label)) level = 4;

  return {
    label: `(${label})`,
    level,
    text: normalized.includes(')') ? normalized.slice(normalized.indexOf(')') + 1).trim() : normalized,
    confidence: toConfidence(normalized),
  };
}

function parseSectionHeader(line) {
  const normalized = normalizeLine(line);
  const sectionMatch = normalized.match(/^§+\s*([0-9]+\.[0-9]+[a-z]?)\s+(.+)$/i);
  if (!sectionMatch) return null;
  return {
    sectionNumber: sectionMatch[1],
    sectionTitle: normalizeLine(sectionMatch[2]),
  };
}

function parsePartHeader(line) {
  const normalized = normalizeLine(line);
  const match = normalized.match(/^Part\s+([0-9]+)\s*[-—]?\s*(.*)$/i);
  if (!match) return null;
  return {
    partNumber: Number(match[1]),
    partTitle: normalizeLine(match[2] || ''),
  };
}

function parseSubpartHeader(line) {
  const normalized = normalizeLine(line);
  const match = normalized.match(/^Subpart\s+([A-Z0-9]+)\s*[-—]?\s*(.*)$/i);
  if (!match) return null;
  return {
    subpartLabel: match[1],
    subpartTitle: normalizeLine(match[2] || ''),
  };
}

function detectHeading(line) {
  const normalized = normalizeLine(line);
  if (!normalized) return null;
  if (/^§\s*/.test(normalized)) return null;
  if (/^\([a-zA-Z0-9ivxlcdm]+\)\s+/.test(normalized)) return null;
  const allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ,;:'\"()/-";
  if (!/^[A-Z]/.test(normalized) || normalized.length < 7) return null;
  for (const ch of normalized) {
    if (!allowed.includes(ch)) return null;
  }
  return normalized;
}

function convertPageItemsToLines(items) {
  const rows = new Map();

  for (const item of items || []) {
    const text = String(item?.str || '').trim();
    if (!text) continue;
    const y = Math.round(Number(item?.transform?.[5] || 0));
    const x = Number(item?.transform?.[4] || 0);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push({ x, text });
  }

  const lines = [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, rowItems]) => rowItems.sort((a, b) => a.x - b.x).map((entry) => entry.text).join(' '))
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  return lines;
}

async function extractPages(pdfPath) {
  const fileBuffer = await fs.readFile(pdfPath);
  const data = new Uint8Array(fileBuffer);
  const loadingTask = pdfjsLib.getDocument({ data, disableWorker: true });
  const pdf = await loadingTask.promise;

  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const text = await page.getTextContent();
    const lines = convertPageItemsToLines(text.items || []);
    pages.push({ pageNumber, lines });
  }

  return pages;
}

function selectSourcePdfs(candidatePaths = []) {
  const unique = new Set();
  const selected = [];
  for (const sourcePath of candidatePaths) {
    if (!sourcePath) continue;
    const resolved = path.resolve(sourcePath);
    if (unique.has(resolved)) continue;
    unique.add(resolved);
    selected.push(resolved);
  }
  return selected;
}

async function existingFile(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function discoverLocalCfrPdfSources() {
  const candidates = [
    path.join(REPO_ROOT, '38 CFR Title 38.pdf'),
    path.join(REPO_ROOT, 'Title 38 CFR.pdf'),
    path.join(REPO_ROOT, '38 CFR Part 3 (up to date as of 3-12-2026).pdf'),
    path.join(REPO_ROOT, '38 CFR Part 4 (up to date as of 3-12-2026).pdf'),
    path.join(REPO_ROOT, '38 CFR Part 3 (up to date as of 2-12-2026).pdf'),
    path.join(REPO_ROOT, '38 CFR Part 4 (up to date as of 2-12-2026).pdf'),
  ];

  const available = [];
  for (const candidate of candidates) {
    if (await existingFile(candidate)) available.push(candidate);
  }

  return selectSourcePdfs(available);
}

export async function buildStructuredCfrIndexFromPdf({ sourcePdfs }) {
  const pdfs = selectSourcePdfs(sourcePdfs);
  if (!pdfs.length) {
    throw new Error('No local CFR PDF sources found.');
  }

  const partMap = new Map();
  const sectionIdByPartAndNumber = new Map();

  let activePart = null;
  let activePartTitle = null;
  let activeSubpart = null;
  let activeSection = null;
  let sectionOffsetCursor = 0;
  let sectionCounter = 0;

  const ensurePart = (partNumber, fallbackTitle = '') => {
    if (!partMap.has(partNumber)) {
      partMap.set(partNumber, {
        partNumber,
        partTitle: fallbackTitle || `Part ${partNumber}`,
        sections: [],
      });
    }
    return partMap.get(partNumber);
  };

  const finalizeSection = () => {
    if (!activeSection) return;
    activeSection.rawTextLocation.offsets.end = sectionOffsetCursor;
    activeSection.diagnosticCodeRefs = activeSection.partNumber === 4
      ? extractDiagnosticRefs(activeSection._rawTextBuffer.join('\n'))
      : [];
    delete activeSection._rawTextBuffer;
    activeSection = null;
  };

  for (const pdfPath of pdfs) {
    const pages = await extractPages(pdfPath);
    const forcedPart = /part\s*3/i.test(path.basename(pdfPath))
      ? 3
      : (/part\s*4/i.test(path.basename(pdfPath)) ? 4 : null);

    for (const page of pages) {
      const lines = page.lines;

      for (const line of lines) {
        const maybePart = parsePartHeader(line);
        if (maybePart) {
          activePart = maybePart.partNumber;
          activePartTitle = maybePart.partTitle || activePartTitle || `Part ${activePart}`;
          ensurePart(activePart, activePartTitle);
        }

        if (forcedPart && !activePart) {
          activePart = forcedPart;
          activePartTitle = `Part ${forcedPart}`;
          ensurePart(activePart, activePartTitle);
        }

        const maybeSubpart = parseSubpartHeader(line);
        if (maybeSubpart) {
          activeSubpart = maybeSubpart;
        }

        const header = parseSectionHeader(line);
        if (header) {
          const partNumber = forcedPart || activePart;
          if (!partNumber || ![3, 4].includes(partNumber)) {
            continue;
          }

          finalizeSection();

          const part = ensurePart(partNumber, activePartTitle || `Part ${partNumber}`);
          const sectionId = `cfr38-p${partNumber}-s${header.sectionNumber.toLowerCase()}`;

          activeSection = {
            id: sectionId,
            titleNumber: 38,
            partNumber,
            sectionNumber: header.sectionNumber,
            sectionTitle: header.sectionTitle,
            subpart: activeSubpart
              ? { label: activeSubpart.subpartLabel, title: activeSubpart.subpartTitle || null }
              : null,
            headings: [],
            paragraphStructure: [],
            diagnosticCodeRefs: [],
            rawTextLocation: {
              pdfPageRange: { start: page.pageNumber, end: page.pageNumber },
              offsets: { start: sectionOffsetCursor, end: sectionOffsetCursor },
            },
            confidence: toConfidence(line),
            _rawTextBuffer: [],
          };

          part.sections.push(activeSection);
          sectionIdByPartAndNumber.set(`${partNumber}|${header.sectionNumber}`.toLowerCase(), sectionId);
          sectionCounter += 1;
          continue;
        }

        if (!activeSection) {
          continue;
        }

        activeSection.rawTextLocation.pdfPageRange.end = page.pageNumber;
        activeSection._rawTextBuffer.push(line);
        sectionOffsetCursor += line.length + 1;

        const heading = detectHeading(line);
        if (heading && !activeSection.headings.includes(heading)) {
          activeSection.headings.push(heading);
        }

        const paragraph = parseParagraphLabel(line);
        if (paragraph) {
          activeSection.paragraphStructure.push(paragraph);
        }

        const confidence = toConfidence(line);
        if (confidence < activeSection.confidence) {
          activeSection.confidence = confidence;
        }
      }
    }
  }

  finalizeSection();

  const parts = [...partMap.values()]
    .filter((part) => [3, 4].includes(part.partNumber))
    .sort((a, b) => a.partNumber - b.partNumber)
    .map((part) => ({
      ...part,
      sections: (part.sections || []).sort((a, b) => {
        if (a.sectionNumber === b.sectionNumber) return 0;
        return a.sectionNumber < b.sectionNumber ? -1 : 1;
      }),
    }));

  return {
    cfrIndex: {
      title: 38,
      parts,
    },
    metadata: {
      builtAt: new Date().toISOString(),
      sources: pdfs,
      sectionsIndexed: sectionCounter,
      focusedParts: [3, 4],
      sectionIdByPartAndNumber: Object.fromEntries(sectionIdByPartAndNumber.entries()),
    },
  };
}

export async function writeStructuredCfrIndex({ sourcePdfs, outputPath }) {
  const indexBundle = await buildStructuredCfrIndexFromPdf({ sourcePdfs });
  const target = outputPath || path.join(REPO_ROOT, 'knowledge', 'cfr', 'cfr-index.json');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(indexBundle, null, 2), 'utf8');
  return { outputPath: target, ...indexBundle };
}
