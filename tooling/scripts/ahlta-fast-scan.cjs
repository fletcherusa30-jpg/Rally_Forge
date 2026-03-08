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

const argv = process.argv.slice(2);
const args = new Set(argv);
const forceRebuild = args.has('--rebuild-index');
const benchmarkMode = args.has('--benchmark');
const comparePdfsMode = args.has('--compare-pdfs');
const compareAllPdfsMode = args.has('--compare-all-pdfs');

// Parse --focus-condition "condition name"
let focusCondition = 'multiple_sclerosis'; // default
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--focus-condition' && i + 1 < argv.length) {
    focusCondition = argv[i + 1].toLowerCase().replace(/\s+/g, '_');
    break;
  }
}

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

const INDEX_VERSION = 7; // Bumped to exclude knowledge base PDFs from medical record scans

function getTermSpecsForCondition(condition) {
  const specs = {
    multiple_sclerosis: [
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
    ],
    ptsd: [
      { id: 'ptsd', regex: /\bPTSD\b/i },
      { id: 'post_traumatic_stress', regex: /post[- ]traumatic\s+stress/i },
      { id: 'combat_stress', regex: /combat\s+stress/i },
      { id: 'trauma_related', regex: /trauma[- ]related/i },
      { id: 'hypervigilance', regex: /hypervigilance|hypervigilant/i },
      { id: 'flashbacks', regex: /flashback/i },
      { id: 'nightmares', regex: /nightmare/i },
      { id: 'avoidance', regex: /avoidance\s+behavior/i },
      { id: 'intrusive_thoughts', regex: /intrusive\s+thought/i },
      { id: 'anxiety_disorder', regex: /anxiety\s+disorder/i }
    ],
    migraine: [
      { id: 'migraine', regex: /migraine/i },
      { id: 'headache', regex: /headache/i },
      { id: 'cephalgia', regex: /cephalgia/i },
      { id: 'tension_headache', regex: /tension\s+headache/i },
      { id: 'cluster_headache', regex: /cluster\s+headache/i },
      { id: 'photophobia', regex: /photophobia/i },
      { id: 'aura', regex: /\b(visual\s+)?aura\b/i },
      { id: 'chronic_headache', regex: /chronic\s+headache/i }
    ],
    radiculopathy: [
      { id: 'radiculopathy', regex: /radiculopathy/i },
      { id: 'radicular', regex: /radicular\s+(pain|syndrome)/i },
      { id: 'nerve_root', regex: /nerve\s+root\s+(compression|impingement)/i },
      { id: 'sciatica', regex: /sciatica/i },
      { id: 'herniated_disc', regex: /herniated\s+disc/i },
      { id: 'bulging_disc', regex: /bulging\s+disc/i },
      { id: 'cervical_radiculopathy', regex: /cervical\s+radiculopathy/i },
      { id: 'lumbar_radiculopathy', regex: /lumbar\s+radiculopathy/i }
    ],
    tbi: [
      { id: 'tbi', regex: /\bTBI\b/i },
      { id: 'traumatic_brain_injury', regex: /traumatic\s+brain\s+injury/i },
      { id: 'concussion', regex: /concussion/i },
      { id: 'post_concussive', regex: /post[- ]concussive/i },
      { id: 'blast_injury', regex: /blast\s+injury/i },
      { id: 'head_trauma', regex: /head\s+trauma/i },
      { id: 'closed_head_injury', regex: /closed\s+head\s+injury/i },
      { id: 'cognitive_impairment', regex: /cognitive\s+impairment/i }
    ],
    tinnitus: [
      { id: 'tinnitus', regex: /tinnitus/i },
      { id: 'ringing_ears', regex: /ringing\s+(in\s+)?(the\s+)?ears?/i },
      { id: 'auditory', regex: /auditory\s+(disorder|dysfunction)/i },
      { id: 'hearing_loss', regex: /hearing\s+loss/i },
      { id: 'acoustic_trauma', regex: /acoustic\s+trauma/i }
    ]
  };

  return specs[condition] || specs.multiple_sclerosis;
}

function getConditionDisplayName(condition) {
  const names = {
    multiple_sclerosis: 'Multiple Sclerosis',
    ptsd: 'PTSD',
    migraine: 'Migraine/Headache',
    radiculopathy: 'Radiculopathy',
    tbi: 'Traumatic Brain Injury (TBI)',
    tinnitus: 'Tinnitus'
  };
  return names[condition] || condition;
}

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
  
  // EXCLUDE knowledge base, reference docs, and training materials
  if (rel.includes('knowledge/') ||
      rel.includes('rates/') ||
      rel.includes('scanner/va scanner/rates') ||
      rel.includes('job aid') ||
      rel.includes('suggested diagnostic') ||
      rel.includes('rvsr') ||
      rel.includes('source_documents') ||
      rel.includes('rate database') ||
      rel.includes('disability rates')) {
    return false;
  }
  
  // INCLUDE only actual medical records
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

function countClinicalTermHitsInText(text, termSpecs, condition) {
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

  return summarizeHits(applyConditionSpecificFilter(hits, condition), termSpecs);
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

function applyConditionSpecificFilter(hits, condition) {
  if (condition === 'multiple_sclerosis') {
    // MS-specific noise: rank abbreviations (COL, MS; CPT, MS), milliseconds, optometry titles
    const noisePattern = /\b(COL,\s*MS|CPT,\s*MS|Chief\s+Optometry|Optometry\s+EACH|Pulse\s+width\s+0\.5\s+ms|\bMs\.)\b/i;
    return hits.filter((hit) => {
      if (hit.termId !== 'ms' && hit.termId !== 'm_s') {
        return true;
      }
      const combined = `${hit.prev || ''} ${hit.lineText || ''} ${hit.next || ''}`;
      return !noisePattern.test(combined);
    });
  }

  if (condition === 'tbi') {
    // TBI noise: tactical ballistic inserts, etc.
    const noisePattern = /\b(tactical\s+ballistic|test\s+battle\s+interface)\b/i;
    return hits.filter((hit) => {
      if (hit.termId !== 'tbi') {
        return true;
      }
      const combined = `${hit.prev || ''} ${hit.lineText || ''} ${hit.next || ''}`;
      return !noisePattern.test(combined);
    });
  }

  // Default: no filtering for other conditions
  return hits;
}

function buildIndex(text, termSpecs, condition) {
  const start = nowMs();
  const lines = text.split(/\r?\n/);

  const diagnosisLines = [];
  const neurologyLines = [];
  const termHits = []; // renamed from msHits for generality
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
        termHits.push({
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
    termHits, // renamed from msHits
    diagnosisEntries: normalizedDiagnosis,
    sections,
    tokenToLines,
    buildMs: nowMs() - start
  };
}

function summarizeHits(hits, termSpecs) {
  const countsByTerm = {};
  for (const spec of termSpecs) {
    countsByTerm[spec.id] = 0;
  }
  for (const hit of hits) {
    countsByTerm[hit.termId] = (countsByTerm[hit.termId] || 0) + 1;
  }
  return countsByTerm;
}

function computeQuality(indexData, termHits) {
  const hasDiagnosis = indexData.diagnosisLines.length > 0;
  const hasNeurology = indexData.neurologyLines.length > 0;
  const hasSections = indexData.sections.length > 0;
  const hasText = indexData.textLength > 1000;

  let score = 0;
  if (hasText) score += 30;
  if (hasDiagnosis) score += 25;
  if (hasNeurology) score += 20;
  if (hasSections) score += 15;
  if (termHits.length === 0) score += 10;

  return {
    score,
    hasText,
    hasDiagnosis,
    hasNeurology,
    hasSections
  };
}

function buildAiReviewPacket(indexData, termHits, countsByTerm, quality, condition) {
  const nonConditionNeurology = indexData.neurologyLines
    .filter((line) => typeof line === 'string' && line.trim() && !line.startsWith('--- line'))
    .slice(0, 50);

  const diagnosisWithCodes = indexData.diagnosisEntries.filter((d) => d.code);

  const verdict = termHits.length === 0 ? 'not_found' : 'possible_mentions_found';
  const confidence = termHits.length === 0 ? 'high' : 'medium';

  const conditionName = getConditionDisplayName(condition);

  return {
    targetCondition: conditionName,
    verdict,
    confidence,
    evidence: {
      conditionHitCount: termHits.length,
      countsByTerm,
      termHits: termHits.slice(0, 100),
      neurologyContextSample: nonConditionNeurology,
      diagnosisCount: indexData.diagnosisEntries.length,
      diagnosisWithCodesCount: diagnosisWithCodes.length
    },
    reviewNotes:
      termHits.length === 0
        ? [
            `No explicit ${conditionName} diagnosis string found in extracted text.`,
            `No related terminology markers found.`,
            'Neurology references exist but are not tied to this condition in this document.'
          ]
        : [
            `Found ${termHits.length} potential ${conditionName} mentions.`,
            'Manual review recommended to confirm clinical context.'
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

function writeOutputsFromIndex(indexData, report, condition) {
  fs.writeFileSync(diagnosisOut, indexData.diagnosisLines.join('\n'), 'utf8');
  fs.writeFileSync(neurologyOut, indexData.neurologyLines.join('\n'), 'utf8');

  const diagnosisTerms = indexData.diagnosisEntries.map((d) => d.diagnosis).sort((a, b) => a.localeCompare(b));
  fs.writeFileSync(diagnosisTermsOut, diagnosisTerms.join('\n') + '\n', 'utf8');

  const diagnosisCodes = indexData.diagnosisEntries
    .filter((d) => d.code)
    .map((d) => ({ diagnosis: d.diagnosis, code: d.code, line: d.line }))
    .sort((a, b) => a.code.localeCompare(b.code));
  fs.writeFileSync(diagnosisCodesOut, JSON.stringify(diagnosisCodes, null, 2), 'utf8');

  const quality = computeQuality(indexData, report.conditionSummary.hits || []);
  const aiPacket = buildAiReviewPacket(
    indexData,
    report.conditionSummary.hits || [],
    report.conditionSummary.countsByTerm || {},
    quality,
    condition
  );
  fs.writeFileSync(aiReviewOut, JSON.stringify(aiPacket, null, 2), 'utf8');

  const summary = [
    `File: ${report.file}`,
    `Source: ${report.textSource}`,
    `Text length: ${report.textLength}`,
    `Line count: ${report.lineCount}`,
    `Condition: ${getConditionDisplayName(condition)}`,
    `Clinical hits: ${report.conditionSummary.hitCount}`,
    `Diagnosis entries: ${indexData.diagnosisEntries.length}`,
    `Neurology lines captured: ${indexData.neurologyLines.length}`,
    `Timing total (ms): ${report.timingsMs.total}`
  ].join('\n');
  fs.writeFileSync(summaryOut, summary + '\n', 'utf8');

  fs.writeFileSync(reportOut, JSON.stringify(report, null, 2), 'utf8');
}

async function runScan(options = { forceRebuild: false, condition: 'multiple_sclerosis' }) {
  ensureDir(cacheDir);
  const t0 = nowMs();

  const condition = options.condition || 'multiple_sclerosis';
  const termSpecs = getTermSpecsForCondition(condition);

  const existingIndex = readJsonIfExists(indexPath);

  if (!options.forceRebuild && isIndexValid(existingIndex) && existingIndex.condition === condition) {
    const termHitsWarm = applyConditionSpecificFilter(existingIndex.termHits || [], condition);
    const countsByTermWarm = summarizeHits(termHitsWarm, termSpecs);
    const reportWarm = {
      file: pdfName,
      textSource: 'index-cache',
      pages: existingIndex.pages || null,
      textLength: existingIndex.textLength,
      lineCount: existingIndex.lineCount,
      condition: condition,
      conditionName: getConditionDisplayName(condition),
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
      conditionSummary: {
        hitCount: termHitsWarm.length,
        countsByTerm: countsByTermWarm,
        hits: termHitsWarm.slice(0, 200)
      }
    };

    writeOutputsFromIndex(existingIndex, reportWarm, condition);
    return reportWarm;
  }

  const extracted = await extractPdfTextIfNeeded();
  const indexed = buildIndex(extracted.text, termSpecs, condition);

  const termHits = applyConditionSpecificFilter(indexed.termHits, condition);
  const countsByTerm = summarizeHits(termHits, termSpecs);

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
    termHits,
    condition,
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
    condition: condition,
    conditionName: getConditionDisplayName(condition),
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
    conditionSummary: {
      hitCount: termHits.length,
      countsByTerm,
      hits: termHits.slice(0, 200)
    }
  };

  writeOutputsFromIndex(indexData, report, condition);
  return report;
}

async function runBenchmark(condition) {
  const first = await runScan({ forceRebuild: true, condition });
  const second = await runScan({ forceRebuild: false, condition });

  const coldMs = first.timingsMs.total;
  const warmMs = Math.max(1, second.timingsMs.total);
  const speedup = (coldMs / warmMs).toFixed(2);

  console.log('Benchmark complete.');
  console.log(`Cold total (ms): ${coldMs}`);
  console.log(`Warm total (ms): ${warmMs}`);
  console.log(`Warm speedup: ${speedup}x`);
}

async function runCrossPdfCompare(condition) {
  const t0 = nowMs();
  ensureDir(cacheDir);

  const termSpecs = getTermSpecsForCondition(condition);

  // Ensure primary index exists for diagnosis baseline.
  const primaryReport = await runScan({ forceRebuild: false, condition });
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
    const countsByTerm = countClinicalTermHitsInText(extracted.text, termSpecs, condition);
    const coverage = diagnosisCoverage(index.diagnosisEntries, extracted.text);

    files.push({
      file: path.relative(cwd, file),
      textLength: extracted.text.length,
      textSource: extracted.source,
      conditionTermCounts: countsByTerm,
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
    condition: condition,
    conditionName: getConditionDisplayName(condition),
    comparedFileCount: files.length,
    files,
    timingsMs: {
      total: nowMs() - t0
    }
  };

  fs.writeFileSync(compareReportOut, JSON.stringify(report, null, 2), 'utf8');

  const summaryLines = [
    `Primary file: ${report.primaryFile}`,
    `Target condition: ${report.conditionName}`,
    `Compared files: ${report.comparedFileCount}`,
    `Total time (ms): ${report.timingsMs.total}`,
    ''
  ];

  const primaryTermKey = Object.keys(files[0]?.conditionTermCounts || {})[0] || 'condition';

  for (const f of files) {
    summaryLines.push(`File: ${f.file}`);
    summaryLines.push(`- Text source: ${f.textSource}`);
    summaryLines.push(`- Baseline diagnoses present: ${f.diagnosisCoverage.presentCount}/${f.diagnosisCoverage.baselineDiagnosisCount}`);
    summaryLines.push(`- Baseline diagnoses missing: ${f.diagnosisCoverage.missingCount}`);
    summaryLines.push(`- ${getConditionDisplayName(condition)} term hits: ${f.conditionTermCounts[primaryTermKey] || 0}`);
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
      await runCrossPdfCompare(focusCondition);
      return;
    }

    if (benchmarkMode) {
      await runBenchmark(focusCondition);
      return;
    }

    const report = await runScan({ forceRebuild, condition: focusCondition });

    console.log('AHLTA scan complete.');
    console.log(`Target condition: ${report.conditionName}`);
    console.log(`Text source: ${report.textSource}`);
    console.log(`Diagnosis output: ${report.outputs.diagnosis}`);
    console.log(`Neurology output: ${report.outputs.neurology}`);
    console.log(`Diagnosis terms: ${report.outputs.diagnosisTerms}`);
    console.log(`Diagnosis codes: ${report.outputs.diagnosisCodes}`);
    console.log(`AI review packet: ${report.outputs.aiReview}`);
    console.log(`Condition hits: ${report.conditionSummary.hitCount}`);
    console.log(
      `Timing (ms): extraction=${report.timingsMs.extraction}, scan=${report.timingsMs.scan}, total=${report.timingsMs.total}`
    );
  } catch (err) {
    console.error(err.message || String(err));
    process.exit(1);
  }
})();
