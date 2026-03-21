import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAllStrsFeedback, summarizeStrsFeedback } from '../../backend/services/strsFeedbackStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const reportDir = path.join(repoRoot, '_reports');
const jsonReportPath = path.join(reportDir, 'strs-feedback-tuning-report.json');
const markdownReportPath = path.join(reportDir, 'strs-feedback-tuning-report.md');

function buildTopFalsePositiveContexts(items) {
  const falsePositives = items.filter((item) => String(item?.classification || '').toLowerCase() === 'false_positive');
  const grouped = new Map();

  falsePositives.forEach((item) => {
    const label = String(item?.findingLabel || 'Unknown finding').trim() || 'Unknown finding';
    const current = grouped.get(label) || { count: 0, examples: [] };
    current.count += 1;
    if (current.examples.length < 3) {
      current.examples.push({
        fileName: item?.fileName || 'unknown file',
        matchedText: item?.matchedText || '',
        context: item?.context || '',
        page: item?.page || null,
        reason: item?.reason || '',
      });
    }
    grouped.set(label, current);
  });

  return Array.from(grouped.entries())
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 10)
    .map(([label, value]) => ({
      label,
      count: value.count,
      examples: value.examples,
      recommendation: `Review deterministic event/condition context rules for ${label}.`,
    }));
}

function buildMarkdownReport(report) {
  const lines = [
    '# STR Feedback Tuning Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total feedback items: ${report.summary.total}`,
    `- True positives: ${report.summary.truePositive}`,
    `- False positives: ${report.summary.falsePositive}`,
    '',
    '## Top False-Positive Labels',
    '',
  ];

  if (report.topFalsePositiveContexts.length === 0) {
    lines.push('No false positives have been recorded yet.');
    return `${lines.join('\n')}\n`;
  }

  report.topFalsePositiveContexts.forEach((entry, index) => {
    lines.push(`${index + 1}. ${entry.label} (${entry.count})`);
    lines.push(`Recommendation: ${entry.recommendation}`);
    entry.examples.forEach((example, exampleIndex) => {
      lines.push(`Example ${exampleIndex + 1}: ${example.fileName}${example.page ? `, page ${example.page}` : ''}`);
      if (example.matchedText) {
        lines.push(`Matched text: "${example.matchedText}"`);
      }
      if (example.context) {
        lines.push(`Context: ${example.context}`);
      }
      if (example.reason) {
        lines.push(`Reviewer note: ${example.reason}`);
      }
    });
    lines.push('');
  });

  return `${lines.join('\n')}\n`;
}

function main() {
  const items = readAllStrsFeedback();
  const summary = summarizeStrsFeedback();
  const topFalsePositiveContexts = buildTopFalsePositiveContexts(items);

  const report = {
    generatedAt: new Date().toISOString(),
    source: 'backend/data/strs-feedback/feedback.jsonl',
    summary,
    topFalsePositiveContexts,
  };

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(markdownReportPath, buildMarkdownReport(report));

  console.log('STR feedback tuning report complete');
  console.log(`False positives: ${summary.falsePositive}`);
  console.log(`JSON report: ${path.relative(repoRoot, jsonReportPath)}`);
  console.log(`Markdown report: ${path.relative(repoRoot, markdownReportPath)}`);
}

main();