import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { attachCfrLinksToDbqRows } from './cfrIndexService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_DBQ_FILE = 'Index of DBQs 8-6-25.xlsx';
const MAX_DBQ_ROWS = 5000;

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveDbqWorkbookPath() {
  const envPath = process.env.DBQ_INDEX_FILE ? path.resolve(process.env.DBQ_INDEX_FILE) : null;
  const candidates = [
    envPath,
    path.join(REPO_ROOT, DEFAULT_DBQ_FILE),
    path.join(REPO_ROOT, 'resources', DEFAULT_DBQ_FILE),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`DBQ workbook not found. Expected ${DEFAULT_DBQ_FILE} in workspace root or set DBQ_INDEX_FILE.`);
}

function normalizeCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

export async function readDbqIndex() {
  const workbookPath = await resolveDbqWorkbookPath();
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('DBQ workbook has no worksheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const rows = rawRows.map((row) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row || {})) {
      normalized[String(key).trim()] = normalizeCell(value);
    }
    return normalized;
  });

  const linkedRows = await attachCfrLinksToDbqRows(rows);

  const columns = linkedRows.length > 0 ? Object.keys(linkedRows[0]) : [];
  const truncated = rows.length > MAX_DBQ_ROWS;
  const limitedRows = truncated ? linkedRows.slice(0, MAX_DBQ_ROWS) : linkedRows;

  return {
    fileName: path.basename(workbookPath),
    filePath: workbookPath,
    sheetName: firstSheetName,
    rowCount: rows.length,
    returnedRowCount: limitedRows.length,
    truncated,
    columns,
    rows: limitedRows,
    loadedAt: new Date().toISOString(),
  };
}
