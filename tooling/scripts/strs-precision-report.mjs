import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeText, scanSTRText } from '../../backend/engine/strs/strs-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const goldsetPath = path.join(repoRoot, 'tests', 'treatment', 'fixtures', 'strs-event-goldset.json');
const reportDir = path.join(repoRoot, '_reports');
const reportPath = path.join(reportDir, 'strs-precision-report.json');

function runCase(entry) {
  const result = scanSTRText(normalizeText(entry.text));
  const labels = (result?.Extracted?.Events || []).map((event) => event.label);

  const missing = (entry.expectPresent || []).filter((label) => !labels.includes(label));
  const unexpected = (entry.expectAbsent || []).filter((label) => labels.includes(label));

  return {
    id: entry.id,
    description: entry.description,
    passed: missing.length === 0 && unexpected.length === 0,
    observedLabels: labels,
    missingExpected: missing,
    unexpectedFound: unexpected,
  };
}

function summarize(caseResults) {
  const total = caseResults.length;
  const passed = caseResults.filter((item) => item.passed).length;
  const failed = total - passed;

  return {
    total,
    passed,
    failed,
    passRate: total > 0 ? Number(((passed / total) * 100).toFixed(2)) : 0,
  };
}

function main() {
  if (!fs.existsSync(goldsetPath)) {
    console.error(`Gold set not found: ${goldsetPath}`);
    process.exit(1);
  }

  const goldset = JSON.parse(fs.readFileSync(goldsetPath, 'utf8'));
  const cases = Array.isArray(goldset?.cases) ? goldset.cases : [];

  const caseResults = cases.map(runCase);
  const summary = summarize(caseResults);

  fs.mkdirSync(reportDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    source: path.relative(repoRoot, goldsetPath),
    summary,
    cases: caseResults,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('STR precision audit complete');
  console.log(`Pass rate: ${summary.passed}/${summary.total} (${summary.passRate}%)`);
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);

  if (summary.failed > 0) {
    process.exit(1);
  }
}

main();
