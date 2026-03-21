import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, '.reports');
const REPORT_JSON = path.join(REPORT_DIR, 'dev-audit-report.json');
const REPORT_MD = path.join(REPORT_DIR, 'dev-audit-report.md');
const BASELINE_JSON = path.join(REPORT_DIR, 'dev-audit-baseline.json');

const args = new Set(process.argv.slice(2));
const updateBaseline = args.has('--update-baseline');
const strictHighOnly = args.has('--strict-high-only');

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  '.reports',
  '.vite',
  '.idea',
  '.vscode',
  'logs',
  'artifacts',
  'New folder',
  '_certification',
]);

const EXCLUDE_PATH_SNIPPETS = [
  '/tooling/maintenance/_repairs/',
  '/knowledge/_quarantine/',
];

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function runCommand(cmd, commandArgs = []) {
  const result = spawnSync(cmd, commandArgs, {
    cwd: ROOT,
    shell: process.platform === 'win32',
    encoding: 'utf8',
    timeout: 180000,
  });

  const stdout = (result.stdout || '').toString();
  const stderr = (result.stderr || '').toString();
  return {
    command: [cmd, ...commandArgs].join(' '),
    ok: (result.status ?? 1) === 0,
    code: result.status ?? 1,
    stdout,
    stderr,
    outputPreview: `${stdout}\n${stderr}`.trim().split(/\r?\n/).slice(0, 18),
  };
}

function runCheck(name, cmd, commandArgs = [], { required = true } = {}) {
  const result = runCommand(cmd, commandArgs);
  return { name, required, ...result };
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) {
        out.push(...(await walkFiles(full)));
      }
      continue;
    }

    out.push(full);
  }

  return out;
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function shouldExcludePath(filePath) {
  const relative = `/${rel(filePath)}`;
  return EXCLUDE_PATH_SNIPPETS.some((snippet) => relative.includes(snippet));
}

async function waitForUrl(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  return false;
}

async function withTemporaryBackend(work) {
  runCommand('node', ['tooling/scripts/free-dev-ports.mjs']);

  const backend = spawn(process.execPath, ['backend/server.js'], {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const stdout = [];
  const stderr = [];
  backend.stdout.on('data', (d) => stdout.push(String(d)));
  backend.stderr.on('data', (d) => stderr.push(String(d)));

  try {
    const ready = await waitForUrl('http://localhost:4000/api/health', 30000);
    if (!ready) {
      return {
        runtimeReady: {
          name: 'runtimeHealth',
          required: true,
          command: 'node backend/server.js',
          ok: false,
          code: 1,
          stdout: stdout.join(''),
          stderr: stderr.join(''),
          outputPreview: ['Backend did not become healthy within timeout.'],
        },
      };
    }

    const output = await work();
    return {
      runtimeReady: {
        name: 'runtimeHealth',
        required: true,
        command: 'node backend/server.js',
        ok: true,
        code: 0,
        stdout: stdout.join(''),
        stderr: stderr.join(''),
        outputPreview: ['Backend health endpoint reachable at /api/health'],
      },
      ...output,
    };
  } finally {
    if (!backend.killed) {
      backend.kill('SIGTERM');
    }
  }
}

async function scanDuplicates(files) {
  const byHash = new Map();

  for (const filePath of files) {
    if (shouldExcludePath(filePath)) continue;

    const stat = await fs.stat(filePath);
    if (stat.size > 2 * 1024 * 1024) continue;
    if (stat.size === 0) continue;

    const buf = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const digest = hash(buf);
    const key = `${digest}:${stat.size}:${extension}`;
    const list = byHash.get(key) ?? [];
    list.push(filePath);
    byHash.set(key, list);
  }

  const exactDuplicates = [];
  for (const [, list] of byHash.entries()) {
    if (list.length > 1) {
      exactDuplicates.push({
        canonical: rel(list[0]),
        duplicates: list.slice(1).map(rel),
      });
    }
  }

  return exactDuplicates;
}

function normalizeMd(content) {
  return content
    .toLowerCase()
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

async function scanMdQuality(mdFiles) {
  const findings = [];
  const normalizedBuckets = new Map();

  for (const md of mdFiles) {
    if (shouldExcludePath(md)) continue;

    const content = await fs.readFile(md, 'utf8');
    const relative = rel(md);

    if (!/^\uFEFF?\s*#\s+\S+/m.test(content)) {
      findings.push({
        id: `md:missing-title:${relative}`,
        severity: 'medium',
        message: `Missing H1 title in ${relative}`,
      });
    }

    if (content.length < 120) {
      findings.push({
        id: `md:thin:${relative}`,
        severity: 'low',
        message: `Very short markdown document in ${relative}`,
      });
    }

    const norm = normalizeMd(content);
    if (norm.length > 200) {
      const digest = hash(norm);
      const list = normalizedBuckets.get(digest) ?? [];
      list.push(relative);
      normalizedBuckets.set(digest, list);
    }

    const linkMatches = content.match(/\[[^\]]+\]\(([^)]+)\)/g) ?? [];
    for (const link of linkMatches) {
      const targetMatch = link.match(/\(([^)]+)\)/);
      if (!targetMatch) continue;
      const target = targetMatch[1];
      if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('#')) continue;

      const resolved = path.resolve(path.dirname(md), target.split('#')[0]);
      if (!(await exists(resolved))) {
        findings.push({
          id: `md:broken-link:${relative}:${target}`,
          severity: 'medium',
          message: `Broken relative markdown link in ${relative}: ${target}`,
        });
      }
    }
  }

  const semanticDuplicates = [];
  for (const [, list] of normalizedBuckets.entries()) {
    if (list.length > 1) semanticDuplicates.push(list);
  }

  return { findings, semanticDuplicates };
}

async function loadBaselineIssueIds() {
  if (!(await exists(BASELINE_JSON))) return new Set();
  try {
    const baseline = JSON.parse(await fs.readFile(BASELINE_JSON, 'utf8'));
    return new Set(Array.isArray(baseline.issueIds) ? baseline.issueIds : []);
  } catch {
    return new Set();
  }
}

function issueFingerprint(issue) {
  return issue.id || hash(JSON.stringify(issue));
}

async function main() {
  await fs.mkdir(REPORT_DIR, { recursive: true });

  const allFiles = (await walkFiles(ROOT)).filter((f) => !shouldExcludePath(f));
  const mdFiles = allFiles.filter((f) => f.toLowerCase().endsWith('.md'));

  const lint = runCheck('lintErrorsOnly', 'npm', ['run', 'lint', '--', '--quiet', '--max-warnings', '10000']);

  const docsAudit = runCheck('docsAudit', 'npm', ['run', 'audit:docs']);

  const runtimeChecks = await withTemporaryBackend(async () => ({
    smoke: runCheck('apiSmoke', 'npm', ['run', 'test:api-smoke']),
  }));

  const checks = {
    runtimeHealth: runtimeChecks.runtimeReady,
    lint,
    smoke: runtimeChecks.smoke ?? {
      name: 'apiSmoke',
      required: true,
      command: 'npm run test:api-smoke',
      ok: false,
      code: 1,
      stdout: '',
      stderr: '',
      outputPreview: ['Smoke tests were not executed because backend startup failed.'],
    },
    docsAudit,
  };

  const exactDuplicates = await scanDuplicates(allFiles);
  const { findings: mdFindings, semanticDuplicates } = await scanMdQuality(mdFiles);

  const issues = [];

  for (const [key, check] of Object.entries(checks)) {
    if (check.required !== false && !check.ok) {
      issues.push({
        id: `check:failed:${key}`,
        severity: 'high',
        message: `${key} failed (${check.command})`,
      });
    }
  }

  for (const duplicate of exactDuplicates) {
    issues.push({
      id: `dup:exact:${duplicate.canonical}:${duplicate.duplicates.join('|')}`,
      severity: 'medium',
      message: `Exact duplicate files found: ${duplicate.canonical} has ${duplicate.duplicates.length} duplicate(s)`,
    });
  }

  for (const finding of mdFindings) issues.push(finding);

  for (const list of semanticDuplicates) {
    issues.push({
      id: `dup:md-semantic:${list.join('|')}`,
      severity: 'low',
      message: `Potentially duplicated markdown content across ${list.length} files`,
    });
  }

  const baselineIds = await loadBaselineIssueIds();
  const currentIds = new Set(issues.map(issueFingerprint));

  const newIssues = issues.filter((i) => !baselineIds.has(issueFingerprint(i)));
  const resolvedIssues = [...baselineIds].filter((id) => !currentIds.has(id));

  const summary = {
    generatedAt: new Date().toISOString(),
    totals: {
      filesScanned: allFiles.length,
      markdownFiles: mdFiles.length,
      issues: issues.length,
      newIssues: newIssues.length,
      resolvedIssues: resolvedIssues.length,
      exactDuplicateGroups: exactDuplicates.length,
      markdownSimilarityGroups: semanticDuplicates.length,
    },
    checks,
    duplicates: {
      exact: exactDuplicates,
      markdownSimilar: semanticDuplicates,
    },
    markdown: {
      findings: mdFindings,
    },
    issues,
    delta: {
      newIssues,
      resolvedIssueIds: resolvedIssues,
    },
    severityCounts: {
      high: issues.filter((i) => i.severity === 'high').length,
      medium: issues.filter((i) => i.severity === 'medium').length,
      low: issues.filter((i) => i.severity === 'low').length,
    },
    deltaSeverityCounts: {
      high: newIssues.filter((i) => i.severity === 'high').length,
      medium: newIssues.filter((i) => i.severity === 'medium').length,
      low: newIssues.filter((i) => i.severity === 'low').length,
    },
  };

  await fs.writeFile(REPORT_JSON, JSON.stringify(summary, null, 2), 'utf8');

  const mdLines = [];
  mdLines.push('# Developer Audit Report');
  mdLines.push('');
  mdLines.push(`Generated: ${summary.generatedAt}`);
  mdLines.push('');
  mdLines.push('## Summary');
  mdLines.push(`- Files scanned: ${summary.totals.filesScanned}`);
  mdLines.push(`- Markdown files scanned: ${summary.totals.markdownFiles}`);
  mdLines.push(`- Total issues: ${summary.totals.issues}`);
  mdLines.push(`- New issues since baseline: ${summary.totals.newIssues}`);
  mdLines.push(`- Resolved issues since baseline: ${summary.totals.resolvedIssues}`);
  mdLines.push(`- Severity counts (all): high=${summary.severityCounts.high}, medium=${summary.severityCounts.medium}, low=${summary.severityCounts.low}`);
  mdLines.push(`- Severity counts (new): high=${summary.deltaSeverityCounts.high}, medium=${summary.deltaSeverityCounts.medium}, low=${summary.deltaSeverityCounts.low}`);
  mdLines.push(`- Exact duplicate groups: ${summary.totals.exactDuplicateGroups}`);
  mdLines.push(`- Markdown similarity groups: ${summary.totals.markdownSimilarityGroups}`);
  mdLines.push('');
  mdLines.push('## Check Results');
  for (const [name, check] of Object.entries(checks)) {
    mdLines.push(`- ${name}: ${check.ok ? 'PASS' : 'FAIL'} (${check.command})`);
    for (const line of check.outputPreview.slice(0, 4)) {
      mdLines.push(`  - ${line}`);
    }
  }
  mdLines.push('');
  mdLines.push('## Exact Duplicates');
  if (exactDuplicates.length === 0) {
    mdLines.push('- None found');
  } else {
    for (const d of exactDuplicates.slice(0, 25)) {
      mdLines.push(`- Canonical: ${d.canonical}`);
      for (const dup of d.duplicates.slice(0, 8)) mdLines.push(`  - Duplicate: ${dup}`);
    }
  }
  mdLines.push('');
  mdLines.push('## New Issues');
  if (newIssues.length === 0) {
    mdLines.push('- No new issues relative to baseline.');
  } else {
    for (const issue of newIssues.slice(0, 100)) {
      mdLines.push(`- [${issue.severity}] ${issue.message}`);
    }
  }
  mdLines.push('');
  mdLines.push('## Improvement Suggestions');
  mdLines.push('- Prioritize high-severity failures from check results before low-severity markdown cleanup.');
  mdLines.push('- Consolidate exact duplicate files only after confirming intended ownership path.');
  mdLines.push('- Keep baseline updated (`--update-baseline`) after a clean stabilization pass.');

  await fs.writeFile(REPORT_MD, mdLines.join('\n'), 'utf8');

  if (updateBaseline) {
    await fs.writeFile(
      BASELINE_JSON,
      JSON.stringify({ generatedAt: summary.generatedAt, issueIds: [...currentIds] }, null, 2),
      'utf8'
    );
  }

  console.log(`[dev-audit-assistant] report written: ${rel(REPORT_JSON)}`);
  console.log(`[dev-audit-assistant] report written: ${rel(REPORT_MD)}`);
  if (updateBaseline) {
    console.log(`[dev-audit-assistant] baseline updated: ${rel(BASELINE_JSON)}`);
  }

  if (strictHighOnly) {
    const highRegressions = summary.deltaSeverityCounts.high;
    if (highRegressions > 0) {
      console.error(`[dev-audit-assistant] strict-high-only failed: ${highRegressions} new high-severity issue(s).`);
      process.exit(1);
    }
    console.log('[dev-audit-assistant] strict-high-only passed: no new high-severity regressions.');
    process.exit(0);
  }

  process.exit(summary.totals.issues > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[dev-audit-assistant] fatal error:', err.message);
  process.exit(1);
});
