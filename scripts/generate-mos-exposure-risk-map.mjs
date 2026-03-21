import fs from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';

const root = process.cwd();
const inputPath = process.env.MOS_EXPOSURE_XLSX
  ? path.resolve(root, process.env.MOS_EXPOSURE_XLSX)
  : path.resolve(root, 'knowledge/mos/MOS_Exposure_Risk.xlsx');
const outputPath = process.env.MOS_EXPOSURE_JSON
  ? path.resolve(root, process.env.MOS_EXPOSURE_JSON)
  : path.resolve(root, 'knowledge/mos/mos-exposure-risk.json');

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function pickField(row, headerMap, candidates) {
  for (const candidate of candidates) {
    const key = headerMap.get(normalizeHeader(candidate));
    if (key && row[key] != null && String(row[key]).trim()) {
      return String(row[key]).trim();
    }
  }
  return '';
}

function splitExposureList(value) {
  return String(value || '')
    .split(/[;,|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toExposureId(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

if (!fs.existsSync(inputPath)) {
  console.error(`Missing workbook: ${inputPath}`);
  console.error('Set MOS_EXPOSURE_XLSX or place MOS_Exposure_Risk.xlsx in knowledge/mos/.');
  process.exit(1);
}

const workbook = xlsx.readFile(inputPath);
const firstSheetName = workbook.SheetNames[0];
if (!firstSheetName) {
  console.error('Workbook has no sheets.');
  process.exit(1);
}

const sheet = workbook.Sheets[firstSheetName];
const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
if (!Array.isArray(rows) || rows.length === 0) {
  console.error('Workbook has no data rows.');
  process.exit(1);
}

const sampleRow = rows[0] || {};
const headerMap = new Map(
  Object.keys(sampleRow).map((key) => [normalizeHeader(key), key])
);

const entries = rows
  .map((row) => {
    const branch = pickField(row, headerMap, ['branch', 'service branch']);
    const mosCode = pickField(row, headerMap, ['mos code', 'mos', 'rate', 'afsc']);
    const title = pickField(row, headerMap, ['title', 'mos title', 'role', 'job title']);
    const noiseRisk = pickField(row, headerMap, ['noise risk', 'hearing risk', 'risk level', 'risk']);
    const exposureRaw = pickField(row, headerMap, ['exposures', 'potential exposures', 'exposure types']);
    const hint = pickField(row, headerMap, ['hint', 'notes', 'rationale']);
    const confidence = pickField(row, headerMap, ['confidence', 'confidence level']);

    if (!branch || !mosCode) {
      return null;
    }

    const exposureLabels = splitExposureList(exposureRaw);
    const exposures = exposureLabels.map((label) => ({
      id: toExposureId(label),
      label,
      confidence: confidence || noiseRisk || '',
      hint,
    }));

    return {
      branch,
      mosCode: mosCode.toUpperCase(),
      title,
      noiseRisk: noiseRisk.toLowerCase() || '',
      exposures,
    };
  })
  .filter(Boolean);

const payload = {
  version: '1.0.0',
  source: path.relative(root, inputPath).replace(/\\/g, '/'),
  generatedAt: new Date().toISOString(),
  entries,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(`Generated ${entries.length} MOS exposure entries`);
console.log(`Output: ${outputPath}`);
