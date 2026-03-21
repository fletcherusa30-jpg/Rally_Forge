import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../backend/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const URL_REGEX = /(?:https?:\/\/[^\s"'`<>]+|\/(?:api|ai|assets|static|health)[A-Za-z0-9_./:?=&%-]*)/g;

function parseArgs(argv) {
  const args = argv.slice(2);
  const getValue = (name, fallback = null) => {
    const index = args.indexOf(name);
    if (index === -1) return fallback;
    return args[index + 1] ?? fallback;
  };

  return {
    manifestPath: path.resolve(getValue('--manifest', path.join(repoRoot, 'config', 'url-manifest.json'))),
    writeReportPath: path.resolve(getValue('--report', path.join(repoRoot, 'artifacts', 'url-validation-report.json'))),
    autoFix: args.includes('--autofix'),
    pretty: args.includes('--pretty'),
    includeDocs: args.includes('--include-docs'),
  };
}

function wildcardToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

function normalizeSlashes(input) {
  return String(input || '').replace(/\\/g, '/');
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listFilesRecursively(basePath, extensions, excludes) {
  const files = [];
  const stack = [basePath];

  while (stack.length) {
    const current = stack.pop();
    const stat = await fs.stat(current);

    if (stat.isDirectory()) {
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        const rel = normalizeSlashes(path.relative(repoRoot, fullPath));
        if (excludes.some((ex) => rel === ex || rel.startsWith(`${ex}/`))) {
          continue;
        }
        stack.push(fullPath);
      }
      continue;
    }

    const ext = path.extname(current).toLowerCase();
    if (extensions.includes(ext)) {
      files.push(current);
    }
  }

  return files;
}

function toLineNumber(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content[i] === '\n') line += 1;
  }
  return line;
}

function normalizeUrlToken(token) {
  const raw = String(token || '').trim();
  if (!raw) return raw;

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const parsed = new URL(raw);
      return parsed.pathname + (parsed.search || '');
    } catch {
      return raw;
    }
  }

  return raw;
}

function buildLegacyMap(manifest) {
  const map = new Map();
  for (const entry of manifest.legacyMappings || []) {
    map.set(entry.legacy, entry);
  }
  return map;
}

function isCanonical(url, canonicalSet, patternRegexes) {
  if (canonicalSet.has(url)) return true;
  return patternRegexes.some((regex) => regex.test(url));
}

function classifyUrl(url, manifest, legacyMap, canonicalSet, patternRegexes) {
  if (isCanonical(url, canonicalSet, patternRegexes)) {
    return {
      status: 'correct',
      expected: url,
      requiredFix: ''
    };
  }

  if (legacyMap.has(url)) {
    const mapped = legacyMap.get(url);
    return {
      status: 'incorrect',
      expected: mapped.canonical,
      requiredFix: `Replace ${url} with ${mapped.canonical}`,
    };
  }

  const isLocalUrl = url.startsWith('/api/') || url.startsWith('/ai/') || url.startsWith('/assets/') || url.startsWith('/static/') || url.startsWith('/health');
  if (isLocalUrl) {
    return {
      status: 'legacy',
      expected: '',
      requiredFix: 'Remove or map this URL in config/url-manifest.json',
    };
  }

  return null;
}

async function withServer(run) {
  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;

  try {
    return await run(`http://localhost:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

async function runServiceChecks(manifest) {
  const checks = manifest.serviceChecks || [];
  return withServer(async (baseUrl) => {
    const results = [];

    for (const check of checks) {
      const method = check.method || 'GET';
      let status = null;
      let ok = false;
      let error = null;

      try {
        const response = await fetch(`${baseUrl}${check.url}`, { method });
        status = response.status;
        ok = (check.expectAnyOf || [200]).includes(status);
      } catch (err) {
        error = err.message;
      }

      results.push({
        url: check.url,
        method,
        expectedStatuses: check.expectAnyOf || [200],
        status,
        ok,
        error,
      });
    }

    return results;
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const manifestRaw = await fs.readFile(args.manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestRaw);

  const includeDocs = args.includeDocs;
  const includeRoots = (manifest.validation?.include || []).filter((p) => includeDocs || !String(p).startsWith('docs'));
  const extensions = (manifest.validation?.extensions || ['.js', '.jsx', '.ts', '.tsx']).map((ext) => ext.toLowerCase());
  const excludes = (manifest.validation?.exclude || []).map(normalizeSlashes);

  const files = [];
  for (const includePath of includeRoots) {
    const absolute = path.resolve(repoRoot, includePath);
    if (!(await exists(absolute))) {
      continue;
    }

    const stat = await fs.stat(absolute);
    if (stat.isDirectory()) {
      const found = await listFilesRecursively(absolute, extensions, excludes);
      files.push(...found);
    } else if (extensions.includes(path.extname(absolute).toLowerCase())) {
      files.push(absolute);
    }
  }

  const uniqueFiles = [...new Set(files.map((f) => path.resolve(f)))];
  const canonicalSet = new Set((manifest.canonical?.exact || []).map(String));
  const patternRegexes = (manifest.canonical?.patterns || []).map((pattern) => new RegExp(pattern));
  const legacyMap = buildLegacyMap(manifest);

  const urlValidationReport = [];
  const fileChanges = new Map();
  const foundUrls = new Set();

  for (const absoluteFile of uniqueFiles) {
    const relPath = normalizeSlashes(path.relative(repoRoot, absoluteFile));
    const original = await fs.readFile(absoluteFile, 'utf-8');
    let nextContent = original;

    const matches = [...original.matchAll(URL_REGEX)];
    for (const match of matches) {
      const actualToken = match[0];
      const normalizedUrl = normalizeUrlToken(actualToken);
      if (!normalizedUrl) continue;

      foundUrls.add(normalizedUrl);
      const classification = classifyUrl(normalizedUrl, manifest, legacyMap, canonicalSet, patternRegexes);
      if (!classification) continue;

      const line = toLineNumber(original, match.index ?? 0);
      urlValidationReport.push({
        url: normalizedUrl,
        status: classification.status,
        expected: classification.expected || '',
        actual: normalizedUrl,
        file: relPath,
        line,
        requiredFix: classification.requiredFix,
      });

      if (args.autoFix && classification.status === 'incorrect' && classification.expected) {
        nextContent = nextContent.split(actualToken).join(classification.expected);
      }
    }

    if (args.autoFix && nextContent !== original) {
      fileChanges.set(absoluteFile, nextContent);
    }
  }

  const missingReportRows = [];
  for (const required of manifest.requiredUrls || []) {
    const expectedUrl = String(required.url || '');
    if (!expectedUrl) continue;

    if (!foundUrls.has(expectedUrl)) {
      const targetFile = (required.requiredIn || [])[0] || '';
      missingReportRows.push({
        url: expectedUrl,
        status: 'missing',
        expected: expectedUrl,
        actual: '',
        file: targetFile,
        line: '',
        requiredFix: `Insert ${expectedUrl} in one of: ${(required.requiredIn || []).join(', ')}`,
      });
    }
  }

  urlValidationReport.push(...missingReportRows);

  if (args.autoFix) {
    for (const [filePath, content] of fileChanges.entries()) {
      await fs.writeFile(filePath, content, 'utf-8');
    }
  }

  const serviceChecks = await runServiceChecks(manifest);
  const serviceChecksPassed = serviceChecks.every((check) => check.ok);

  const totals = {
    correct: urlValidationReport.filter((row) => row.status === 'correct').length,
    incorrect: urlValidationReport.filter((row) => row.status === 'incorrect').length,
    missing: urlValidationReport.filter((row) => row.status === 'missing').length,
    legacy: urlValidationReport.filter((row) => row.status === 'legacy').length,
  };

  const finalCheck = {
    allUrlsMatchManifest: totals.incorrect === 0 && totals.missing === 0,
    noLegacyUrlsRemain: totals.legacy === 0,
    scannersAndMicroservicesResolveCorrectly: serviceChecksPassed,
  };

  const output = {
    manifest: normalizeSlashes(path.relative(repoRoot, args.manifestPath)),
    scannedFiles: uniqueFiles.length,
    autoFixApplied: args.autoFix,
    urlValidationReport,
    summary: totals,
    serviceChecks,
    finalCheck,
  };

  await fs.mkdir(path.dirname(args.writeReportPath), { recursive: true });
  await fs.writeFile(args.writeReportPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log(JSON.stringify(output, null, args.pretty ? 2 : 0));

  if (!finalCheck.allUrlsMatchManifest || !finalCheck.noLegacyUrlsRemain || !finalCheck.scannersAndMicroservicesResolveCorrectly) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
