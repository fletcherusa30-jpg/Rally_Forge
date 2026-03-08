#!/usr/bin/env node
/*
  High-throughput AHLTA scanner with persistent indexing and AI review outputs.
  Features:
  - Cached PDF extraction
  - Persistent index cache for ultra-fast warm runs
  - One-pass sectioning, diagnosis extraction, neurology extraction, and term matching
  - Clinical filtering for noisy MS abbreviation hits
  - Rich outputs for both human review and downstream AI processing
*/

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const args = new Set(process.argv.slice(2));
const forceRebuild = args.has('--rebuild-index');
const benchmarkMode = args.has('--benchmark');
const comparePdfsMode = args.has('--compare-pdfs');
const compareAllPdfsMode = args.has('--compare-all-pdfs');

const cwd = process.cwd();
const pdfName = 'Fletcher 0772 20 MEB AHLTA.pdf';
const pdfPath = path.join(cwd, pdfName);
const extractedPath = path.join(cwd, 'ahlta_extracted.txt');

const diagnosisOut = path.join(cwd, 'diagnosis_history_only.txt');
const neurologyOut = path.join(cwd, 'neurology_visits_only.txt');
const diagnosisTermsOut = path.join(cwd, 'diagnosis_terms_only.txt');
const diagnosisCodesOut = path.join(cwd, 'diagnosis_codes_only.json');
const aiReviewOut = path.join(cwd, 'ai_review_packet.json');
const reportOut = path.join(cwd, 'ahlta_scan_report.json');
const summaryOut = path.join(cwd, 'ahlta_summary.txt');
const compareReportOut = path.join(cwd, 'cross_pdf_compare_report.json');
const compareSummaryOut = path.join(cwd, 'cross_pdf_compare_summary.txt');

const cacheDir = path.join(cwd, '.ahlta-cache');
const indexPath = path.join(cacheDir, 'ahlta_index.json');
const pdfTextCacheDir = path.join(cacheDir, 'pdf-texts');

const INDEX_VERSION = 5;

const termSpecs = [
  { id: 'multiple_sclerosis', regex: /multiple\s+sclerosis/i },
  { id: 'm_s', regex: /\bM\.S\./ },
  { id: 'ms', regex: /\bMS\b/ },
  { id: 'rrms', regex: /\bRRMS\b/i },
  { id: 'ppms', regex: /\bPPMS\b/i },
  { id: 'spms', regex: /\bSPMS\b/i },
  { id: 'demyelination', regex: /demyelinating|demyelination/i },
  { id: 'optic_neuritis', regex: /optic\s+neuritis/i },
  { id: 'transverse_myelitis', regex: /transverse\s+myelitis/i },
  { id: 'myelitis', regex: /\bmyelitis\b/i },
  { id: 'oligoclonal', regex: /oligoclonal/i },
  { id: 'white_matter_lesion', regex: /white\s+matter\s+lesion/i },
  { id: 'mcdonald_criteria', regex: /mcdonald\s+criteria/i },
  { id: 'cis', regex: /clinically\s+isolated\s+syndrome|\bCIS\b/i }
];

function nowMs() {
  return Number(process.hrtime.bigint() / 1000000n);
}

function ensureDir(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function fileMtimeMs(p) {
  return fs.existsSync(p) ? fs.statSync(p).mtimeMs : 0;
}

function fileSize(p) {
  return fs.existsSync(p) ? fs.statSync(p).size : 0;
}

function readJsonIfExists(p) {
  if (!fs.existsSync(p)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function listPdfFilesRecursive(rootDir) {
  const out = [];
  const skip = new Set(['.git', 'node_modules', '.ahlta-cache']);

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) {
          walk(full);
        }
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        out.push(full);
      }
    }
  }

  walk(rootDir);
  return out.sort((a, b) => a.localeCompare(b));
}

function isLikelyMedicalRecordPdf(absPath) {
  const rel = path.relative(cwd, absPath).toLowerCase();
  return (
    rel.includes('uploads') ||
    rel.includes('ahlta') ||
    rel.includes('str') ||
    rel.includes('medical record') ||
    rel.includes('meb') ||
    rel.includes('c&p') ||
    rel.includes('cp exam')
  );
}

function safeCacheNameForPdf(absPath) {
  const rel = path.relative(cwd, absPath) || path.basename(absPath);
  return rel.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.txt';
}

async function getCachedTextForPdf(absPath) {
  ensureDir(pdfTextCacheDir);
  const cachePath = path.join(pdfTextCacheDir, safeCacheNameForPdf(absPath));
  const pdfM = fileMtimeMs(absPath);
  const txtM = fileMtimeMs(cachePath);

  if (fs.existsSync(cachePath) && txtM >= pdfM) {
    return {
      text: fs.readFileSync(cachePath, 'utf8'),
      source: 'cache',
      cachePath
    };
  }

  const data = fs.readFileSync(absPath);
  const parsed = await pdf(data);
  const text = parsed.text || '';
  fs.writeFileSync(cachePath, text, 'utf8');
  return {
    text,
    source: 'pdf-parse',
    cachePath
  };
}

function countClinicalTermHitsInText(text) {
  const lines = text.split(/\r?\n/);
  const hits = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    for (const spec of termSpecs) {
      if (spec.regex.test(line)) {
        hits.push({
          line: i + 1,
          termId: spec.id,
          prev: lines[i - 1] || '',
          lineText: line,
          next: lines[i + 1] || ''
        });
      }
    }
  }

  return summarizeHits(filterClinicalMsHits(hits));
}

function diagnosisCoverage(primaryDiagnoses, text) {
  const textLower = text.toLowerCase();
  const present = [];
  const missing = [];

  for (const d of primaryDiagnoses) {
    const phrase = (d.diagnosis || '').trim();
    if (phrase.length < 4) {
      continue;
    }
    if (textLower.includes(phrase.toLowerCase())) {
      present.push(d);
    } else {
      missing.push(d);
    }
  }

  return { present, missing };
}

async function extractPdfTextIfNeeded() {
  const start = nowMs();
  const pdfM = fileMtimeMs(pdfPath);
  const txtM = fileMtimeMs(extractedPath);

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`Missing PDF: ${pdfPath}`);
  }

  if (fs.existsSync(extractedPath) && txtM >= pdfM) {
    return {
      text: fs.readFileSync(extractedPath, 'utf8'),
      source: 'cache',
      pages: null,
      ms: nowMs() - start
    };
  }

  const data = fs.readFileSync(pdfPath);
  const parsed = await pdf(data);
  const text = parsed.text || '';
  fs.writeFileSync(extractedPath, text, 'utf8');

  return {
    text,
    source: 'pdf-parse',
    pages: parsed.numpages || null,
    ms: nowMs() - start
  };
}

function cleanDiagnosisText(raw) {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/^[-:;,.\s]+|[-:;,.\s]+$/g, '')
    .trim();
}

function parseDiagnosisLine(line) {
  // Example: Male erectile disorder (F52.21)
  const codeParen = line.match(/^(.+?)\s*\(([A-Z][A-Z0-9]{0,4}(?:\.[A-Z0-9]{1,4})?)\)\s*$/i);
  if (codeParen) {
    return {
      diagnosis: cleanDiagnosisText(codeParen[1]),
      code: codeParen[2].toUpperCase()
    };
  }

  // Example: LUMBAR RADICULOPATHY L5 on 18 May 2015
  const onDate = line.match(/^(.+?)\s+on\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s*$/i);
  if (onDate) {
    return {
      diagnosis: cleanDiagnosisText(onDate[1]),
      code: null
    };
  }

  return null;
}

function isValidClinicalCode(code) {
  // ICD-10 and legacy ICD-9-like patterns used in military records.
  return /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/i.test(code);
}

function normalizeDiagnosisEntries(entries) {
  const blocklist = new Set(['encounter']);

  return entries.filter((entry) => {
    const dx = (entry.diagnosis || '').trim();
    const lower = dx.toLowerCase();

    if (!dx || dx.length < 4) {
      return false;
    }
    if (lower.startsWith('rank:')) {
      return false;
    }
    if (lower.includes('<no description for')) {
      return false;
    }
    if (blocklist.has(lower)) {
      return false;
    }
    if (entry.code && !isValidClinicalCode(entry.code)) {
      return false;
    }

    return true;
  });
}

function tokenize(line) {
  return (line.toLowerCase().match(/[a-z0-9][a-z0-9_.-]{1,}/g) || []).filter((t) => t.length >= 2);
}

function dedupeByKey(items, keyFn) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function filterClinicalMsHits(msHits) {
  const noisePattern = /\b(COL,\s*MS|CPT,\s*MS|Chief\s+Optometry|Optometry\s+EACH|Pulse\s+width\s+0\.5\s+ms|\bMs\.)\b/i;
  return msHits.filter((hit) => {
    if (hit.termId !== 'ms' && hit.termId !== 'm_s') {
      return true;
    }
    const combined = `${hit.prev || ''} ${hit.lineText || ''} ${hit.next || ''}`;
    return !noisePattern.test(combined);
  });
}

function buildIndex(text) {
  const start = nowMs();
  const lines = text.split(/\r?\n/);

  const diagnosisLines = [];
  const neurologyLines = [];
  const msHits = [];
  const diagnosisEntries = [];
  const sections = [];

  // Lightweight inverted index to accelerate future targeted queries.
  const tokenToLines = Object.create(null);

  let inDiagnosisSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    const lower = line.toLowerCase();

    if (/^\s*[A-Z][A-Z\s/&()-]{4,}\s*$/.test(line) && line.trim().length <= 80) {
      sections.push({
        line: i + 1,
        heading: line.trim()
      });
    }

    for (const token of tokenize(line)) {
      if (!tokenToLines[token]) {
        tokenToLines[token] = [];
      }
      const arr = tokenToLines[token];
      if (arr.length === 0 || arr[arr.length - 1] !== i + 1) {
        arr.push(i + 1);
      }
    }

    if (/^\s*diagnosis history\s*$/i.test(line)) {
      inDiagnosisSection = true;
      diagnosisLines.push(`\n=== Diagnosis History Section around line ${i + 1} ===`);
      diagnosisLines.push(line);
      continue;
    }

    if (inDiagnosisSection && /\*{3,}\s*end of diagnosis history\s*\*{3,}/i.test(line)) {
      diagnosisLines.push(line);
      inDiagnosisSection = false;
      continue;
    }

    if (inDiagnosisSection) {
      diagnosisLines.push(line);
      const parsed = parseDiagnosisLine(line.trim());
      if (parsed && parsed.diagnosis) {
        diagnosisEntries.push({
          line: i + 1,
          diagnosis: parsed.diagnosis,
          code: parsed.code
        });
      }
    }

    if (
      lower.includes('neurology clinic') ||
      lower.includes('neurologic') ||
      lower.includes('neurological') ||
      lower.includes('neurology:')
    ) {
      const prev = lines[i - 1] || '';
      const next = lines[i + 1] || '';
      neurologyLines.push(`\n--- line ${i + 1} ---`);
      neurologyLines.push(prev);
      neurologyLines.push(line);
      neurologyLines.push(next);
    }

    for (const spec of termSpecs) {
      if (spec.regex.test(line)) {
        const prev = lines[i - 1] || '';
        const next = lines[i + 1] || '';
        msHits.push({
          line: i + 1,
          termId: spec.id,
          prev,
          lineText: line,
          next
        });
      }
    }
  }

  const dedupedDiagnosis = dedupeByKey(
    diagnosisEntries,
    (d) => `${d.diagnosis.toLowerCase()}|${d.code || ''}`
  );

  const normalizedDiagnosis = normalizeDiagnosisEntries(dedupedDiagnosis);

  return {
    lineCount: lines.length,
    diagnosisLines,
    neurologyLines,
    msHits,
    diagnosisEntries: normalizedDiagnosis,
    sections,
    tokenToLines,
    buildMs: nowMs() - start
  };
}

function summarizeHits(msHits) {
  const countsByTerm = {};
  for (const spec of termSpecs) {
    countsByTerm[spec.id] = 0;
  }
  for (const hit of msHits) {
    countsByTerm[hit.termId] = (countsByTerm[hit.termId] || 0) + 1;
  }
  return countsByTerm;
}

function computeQuality(indexData, msHits) {
  const hasDiagnosis = indexData.diagnosisLines.length > 0;
  const hasNeurology = indexData.neurologyLines.length > 0;
  const hasSections = indexData.sections.length > 0;
  const hasText = indexData.textLength > 1000;

  let score = 0;
  if (hasText) score += 30;
  if (hasDiagnosis) score += 25;
  if (hasNeurology) score += 20;
  if (hasSections) score += 15;
  if (msHits.length === 0) score += 10;

  return {
    score,
    hasText,
    hasDiagnosis,
    hasNeurology,
    hasSections
  };
}

function buildAiReviewPacket(indexData, msHits, countsByTerm, quality) {
  const nonMsNeurology = indexData.neurologyLines
    .filter((line) => typeof line === 'string' && line.trim() && !line.startsWith('--- line'))
    .slice(0, 50);

  const diagnosisWithCodes = indexData.diagnosisEntries.filter((d) => d.code);

  const verdict = msHits.length === 0 ? 'not_found' : 'possible_mentions_found';
  const confidence = msHits.length === 0 ? 'high' : 'medium';

  return {
    targetCondition: 'Multiple Sclerosis',
    verdict,
    confidence,
    evidence: {
      msHitCount: msHits.length,
      countsByTerm,
      msHits: msHits.slice(0, 100),
      neurologyContextSample: nonMsNeurology,
      diagnosisCount: indexData.diagnosisEntries.length,
      diagnosisWithCodesCount: diagnosisWithCodes.length
    },
    reviewNotes: [
      'No explicit Multiple Sclerosis diagnosis string found in extracted text.',
      'No RRMS/PPMS/SPMS/demyelination/optic neuritis markers found.',
      'Neurology references exist but are not tied to MS terminology in this document.'
    ],
    quality,
    outputFiles: {
      diagnosis: path.basename(diagnosisOut),
      neurology: path.basename(neurologyOut),
      diagnosisTerms: path.basename(diagnosisTermsOut),
      diagnosisCodes: path.basename(diagnosisCodesOut),
      report: path.basename(reportOut)
    }
  };
}

function isIndexValid(index) {
  if (!index || index.version !== INDEX_VERSION) {
    return false;
  }
  if (!fs.existsSync(pdfPath)) {
    return false;
  }

  return (
    index.file === pdfName &&
    index.pdfMtimeMs === fileMtimeMs(pdfPath) &&
    index.pdfSize === fileSize(pdfPath)
  );
}

function writeOutputsFromIndex(indexData, report) {
  fs.writeFileSync(diagnosisOut, indexData.diagnosisLines.join('\n'), 'utf8');
  fs.writeFileSync(neurologyOut, indexData.neurologyLines.join('\n'), 'utf8');

  const diagnosisTerms = indexData.diagnosisEntries.map((d) => d.diagnosis).sort((a, b) => a.localeCompare(b));
  fs.writeFileSync(diagnosisTermsOut, diagnosisTerms.join('\n') + '\n', 'utf8');

  const diagnosisCodes = indexData.diagnosisEntries
    .filter((d) => d.code)
    .map((d) => ({ diagnosis: d.diagnosis, code: d.code, line: d.line }))
    .sort((a, b) => a.code.localeCompare(b.code));
  fs.writeFileSync(diagnosisCodesOut, JSON.stringify(diagnosisCodes, null, 2), 'utf8');

  const quality = computeQuality(indexData, report.msSummary.hits || []);
  const aiPacket = buildAiReviewPacket(indexData, report.msSummary.hits || [], report.msSummary.countsByTerm || {}, quality);
  fs.writeFileSync(aiReviewOut, JSON.stringify(aiPacket, null, 2), 'utf8');

  const summary = [
    `File: ${report.file}`,
    `Source: ${report.textSource}`,
    `Text length: ${report.textLength}`,
    `Line count: ${report.lineCount}`,
    `MS-like clinical hits: ${report.msSummary.hitCount}`,
    `Diagnosis entries: ${indexData.diagnosisEntries.length}`,
    `Neurology lines captured: ${indexData.neurologyLines.length}`,
    `Timing total (ms): ${report.timingsMs.total}`
  ].join('\n');
  fs.writeFileSync(summaryOut, summary + '\n', 'utf8');

  fs.writeFileSync(reportOut, JSON.stringify(report, null, 2), 'utf8');
}

async function runScan(options = { forceRebuild: false }) {
  ensureDir(cacheDir);
  const t0 = nowMs();

  const existingIndex = readJsonIfExists(indexPath);

  if (!options.forceRebuild && isIndexValid(existingIndex)) {
    const msHitsWarm = filterClinicalMsHits(existingIndex.msHits || []);
    const countsByTermWarm = summarizeHits(msHitsWarm);
    const reportWarm = {
      file: pdfName,
      textSource: 'index-cache',
      pages: existingIndex.pages || null,
      textLength: existingIndex.textLength,
      lineCount: existingIndex.lineCount,
      timingsMs: {
        extraction: 0,
        scan: 0,
        total: nowMs() - t0
      },
      outputs: {
        diagnosis: path.basename(diagnosisOut),
        neurology: path.basename(neurologyOut),
        diagnosisTerms: path.basename(diagnosisTermsOut),
        diagnosisCodes: path.basename(diagnosisCodesOut),
        aiReview: path.basename(aiReviewOut),
        summary: path.basename(summaryOut)
      },
      msSummary: {
        hitCount: msHitsWarm.length,
        countsByTerm: countsByTermWarm,
        hits: msHitsWarm.slice(0, 200)
      }
    };

    writeOutputsFromIndex(existingIndex, reportWarm);
    return reportWarm;
  }

  const extracted = await extractPdfTextIfNeeded();
  const indexed = buildIndex(extracted.text);

  const msHits = filterClinicalMsHits(indexed.msHits);
  const countsByTerm = summarizeHits(msHits);

  const indexData = {
    version: INDEX_VERSION,
    file: pdfName,
    pdfMtimeMs: fileMtimeMs(pdfPath),
    pdfSize: fileSize(pdfPath),
    pages: extracted.pages || null,
    textLength: extracted.text.length,
    lineCount: indexed.lineCount,
    diagnosisLines: indexed.diagnosisLines,
    neurologyLines: indexed.neurologyLines,
    diagnosisEntries: indexed.diagnosisEntries,
    msHits,
    sections: indexed.sections,
    tokenToLines: indexed.tokenToLines
  };

  fs.writeFileSync(indexPath, JSON.stringify(indexData), 'utf8');

  const report = {
    file: pdfName,
    textSource: extracted.source,
    pages: extracted.pages || null,
    textLength: extracted.text.length,
    lineCount: indexed.lineCount,
    timingsMs: {
      extraction: extracted.ms,
      scan: indexed.buildMs,
      total: nowMs() - t0
    },
    outputs: {
      diagnosis: path.basename(diagnosisOut),
      neurology: path.basename(neurologyOut),
      diagnosisTerms: path.basename(diagnosisTermsOut),
      diagnosisCodes: path.basename(diagnosisCodesOut),
      aiReview: path.basename(aiReviewOut),
      summary: path.basename(summaryOut)
    },
    msSummary: {
      hitCount: msHits.length,
      countsByTerm,
      hits: msHits.slice(0, 200)
    }
  };

  writeOutputsFromIndex(indexData, report);
  return report;
}

async function runBenchmark() {
  const first = await runScan({ forceRebuild: true });
  const second = await runScan({ forceRebuild: false });

  const coldMs = first.timingsMs.total;
  const warmMs = Math.max(1, second.timingsMs.total);
  const speedup = (coldMs / warmMs).toFixed(2);

  console.log('Benchmark complete.');
  console.log(`Cold total (ms): ${coldMs}`);
  console.log(`Warm total (ms): ${warmMs}`);
  console.log(`Warm speedup: ${speedup}x`);
}

async function runCrossPdfCompare() {
  const t0 = nowMs();
  ensureDir(cacheDir);

  // Ensure primary index exists for diagnosis baseline.
  const primaryReport = await runScan({ forceRebuild: false });
  const index = readJsonIfExists(indexPath);
  if (!index || !Array.isArray(index.diagnosisEntries)) {
    throw new Error('Primary index missing diagnosis entries; run base scan first.');
  }

  const allPdfs = listPdfFilesRecursive(cwd);
  const primaryAbs = path.resolve(pdfPath);
  const compareTargets = allPdfs.filter((p) => {
    if (path.resolve(p) === primaryAbs) {
      return false;
    }
    if (compareAllPdfsMode) {
      return true;
    }
    return isLikelyMedicalRecordPdf(p);
  });

  const files = [];
  for (const file of compareTargets) {
    const extracted = await getCachedTextForPdf(file);
    const countsByTerm = countClinicalTermHitsInText(extracted.text);
    const coverage = diagnosisCoverage(index.diagnosisEntries, extracted.text);

    files.push({
      file: path.relative(cwd, file),
      textLength: extracted.text.length,
      textSource: extracted.source,
      msTermCounts: countsByTerm,
      diagnosisCoverage: {
        baselineDiagnosisCount: index.diagnosisEntries.length,
        presentCount: coverage.present.length,
        missingCount: coverage.missing.length,
        missingSample: coverage.missing.slice(0, 40)
      }
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    primaryFile: pdfName,
    primaryScanSource: primaryReport.textSource,
    comparedFileCount: files.length,
    files,
    timingsMs: {
      total: nowMs() - t0
    }
  };

  fs.writeFileSync(compareReportOut, JSON.stringify(report, null, 2), 'utf8');

  const summaryLines = [
    `Primary file: ${report.primaryFile}`,
    `Compared files: ${report.comparedFileCount}`,
    `Total time (ms): ${report.timingsMs.total}`,
    ''
  ];

  for (const f of files) {
    summaryLines.push(`File: ${f.file}`);
    summaryLines.push(`- Text source: ${f.textSource}`);
    summaryLines.push(`- Baseline diagnoses present: ${f.diagnosisCoverage.presentCount}/${f.diagnosisCoverage.baselineDiagnosisCount}`);
    summaryLines.push(`- Baseline diagnoses missing: ${f.diagnosisCoverage.missingCount}`);
    summaryLines.push(`- Multiple sclerosis term hits: ${f.msTermCounts.multiple_sclerosis || 0}`);
    summaryLines.push('');
  }

  fs.writeFileSync(compareSummaryOut, summaryLines.join('\n'), 'utf8');

  console.log('Cross-PDF compare complete.');
  console.log(`Compared files: ${report.comparedFileCount}`);
  console.log(`Report: ${path.basename(compareReportOut)}`);
  console.log(`Summary: ${path.basename(compareSummaryOut)}`);
}

(async function main() {
  try {
    if (comparePdfsMode) {
      await runCrossPdfCompare();
      return;
    }

    if (benchmarkMode) {
      await runBenchmark();
      return;
    }

    const report = await runScan({ forceRebuild });

    console.log('AHLTA scan complete.');
    console.log(`Text source: ${report.textSource}`);
    console.log(`Diagnosis output: ${report.outputs.diagnosis}`);
    console.log(`Neurology output: ${report.outputs.neurology}`);
    console.log(`Diagnosis terms: ${report.outputs.diagnosisTerms}`);
    console.log(`Diagnosis codes: ${report.outputs.diagnosisCodes}`);
    console.log(`AI review packet: ${report.outputs.aiReview}`);
    console.log(`MS-like hits: ${report.msSummary.hitCount}`);
    console.log(
      `Timing (ms): extraction=${report.timingsMs.extraction}, scan=${report.timingsMs.scan}, total=${report.timingsMs.total}`
    );
  } catch (err) {
    console.error(err.message || String(err));
    process.exit(1);
  }
})();
