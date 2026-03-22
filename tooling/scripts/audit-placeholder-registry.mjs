import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, 'app', 'frontend-modern', 'src');

const EXCLUDED_PATH_SEGMENTS = [
  `${path.sep}tests${path.sep}`,
  `${path.sep}__tests__${path.sep}`,
  `${path.sep}system${path.sep}placeholders${path.sep}`,
];

const FILE_EXTENSIONS = new Set(['.js', '.jsx']);
const HARD_CODED_PLACEHOLDER_PATTERN = /placeholder\s*=\s*(['"]).*?\1/;

function shouldScanFile(filePath) {
  if (!FILE_EXTENSIONS.has(path.extname(filePath))) {
    return false;
  }

  return !EXCLUDED_PATH_SEGMENTS.some((segment) => filePath.includes(segment));
}

function walkFiles(dirPath, collector) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      walkFiles(absolutePath, collector);
      continue;
    }

    if (entry.isFile() && shouldScanFile(absolutePath)) {
      collector.push(absolutePath);
    }
  }
}

function toRelative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function main() {
  if (!fs.existsSync(SOURCE_ROOT)) {
    console.error('[audit:placeholders] Source path not found:', SOURCE_ROOT);
    process.exit(1);
  }

  const files = [];
  walkFiles(SOURCE_ROOT, files);

  const violations = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const match = line.match(HARD_CODED_PLACEHOLDER_PATTERN);
      if (!match) {
        continue;
      }

      const hasOpeningTagNearby = (() => {
        for (let back = 0; back <= 6; back += 1) {
          const lineIndex = i - back;
          if (lineIndex < 0) break;
          const candidate = lines[lineIndex];
          if (/<[A-Za-z][^>]*$/.test(candidate) || /<[A-Za-z][^>]*\s/.test(candidate)) {
            return true;
          }
          if (candidate.includes('=>') || candidate.includes('function ') || candidate.includes('const ') || candidate.includes('let ') || candidate.includes('var ')) {
            if (back > 0) break;
          }
        }
        return false;
      })();

      if (!hasOpeningTagNearby) {
        continue;
      }

      violations.push({
        file: toRelative(filePath),
        line: i + 1,
        snippet: match[0],
      });
    }
  }

  if (violations.length > 0) {
    console.error('[audit:placeholders] Found hardcoded placeholder attributes. Use system/placeholders registry.');
    for (const violation of violations) {
      console.error(` - ${violation.file}:${violation.line} -> ${violation.snippet}`);
    }
    process.exit(1);
  }

  console.log('[audit:placeholders] Passed. No hardcoded placeholder attributes found.');
}

main();
