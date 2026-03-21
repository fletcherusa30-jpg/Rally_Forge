import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '..');

function walk(dir) {
  const output = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...walk(full));
      return;
    }
    if (/\.(js|jsx)$/.test(entry.name)) {
      output.push(full);
    }
  });
  return output;
}

function resolveImport(fromFile, specifier) {
  if (/\.(css|scss|sass|less|json|svg|png|jpe?g|avif|webp|md)$/i.test(specifier)) {
    return fromFile;
  }

  const root = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    root,
    `${root}.js`,
    `${root}.jsx`,
    `${root}.ts`,
    `${root}.tsx`,
    `${root}.mjs`,
    `${root}.cjs`,
    path.join(root, 'index.js'),
    path.join(root, 'index.jsx'),
    path.join(root, 'index.ts'),
    path.join(root, 'index.tsx'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function getRelativeImports(content) {
  const matches = [];
  const fromRegex = /from\s+['"](\.[^'"]+)['"]/g;
  const sideEffectRegex = /import\s+['"](\.[^'"]+)['"]/g;

  let hit;
  while ((hit = fromRegex.exec(content))) {
    matches.push(hit[1]);
  }
  while ((hit = sideEffectRegex.exec(content))) {
    matches.push(hit[1]);
  }

  return matches;
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('File-Level Review Tests', () => {
  it('validates no TODO/placeholder/deprecated markers in source files', () => {
    const files = walk(SRC_DIR).filter((filePath) => !filePath.includes(`${path.sep}tests${path.sep}`));

    files.forEach((filePath) => {
      const content = read(filePath);
      expect(content).not.toMatch(/\bTODO\b/);
      expect(content).not.toMatch(/\bFIXME\b/);
      expect(content).not.toMatch(/placeholder code/i);
      expect(content).not.toMatch(/throw new Error\(['"]Not implemented/i);
    });
  });

  it('validates relative import references resolve to existing files', () => {
    const files = walk(SRC_DIR);
    const unresolved = [];

    files.forEach((filePath) => {
      const content = read(filePath);
      const imports = getRelativeImports(content);

      imports.forEach((specifier) => {
        const resolved = resolveImport(filePath, specifier.replace(/\?.*$/, ''));
        if (!resolved) {
          unresolved.push({ filePath, specifier });
        }
      });
    });

    expect(unresolved).toEqual([]);
  });

  it('validates unified engine integration hooks for primary tab components', () => {
    const requiredFiles = [
      path.join(SRC_DIR, 'components', 'profile', 'ProfilePage.jsx'),
      path.join(SRC_DIR, 'tabs', 'military-service', 'MilitaryServiceTab.jsx'),
      path.join(SRC_DIR, 'tabs', 'strs', 'StrsTab.jsx'),
      path.join(SRC_DIR, 'tabs', 'current-treatment', 'CurrentTreatmentTab.jsx'),
      path.join(SRC_DIR, 'tabs', 'rating-decision', 'RatingDecisionTab.jsx'),
      path.join(SRC_DIR, 'tabs', 'claim-generator-summary', 'ClaimGeneratorSummaryTab.jsx'),
      path.join(SRC_DIR, 'pages', 'ToolsPage.jsx'),
    ];

    requiredFiles.forEach((filePath) => {
      const content = read(filePath);
      expect(content).toMatch(/useClaimWorkspace/);
    });

    const updateDispatchFiles = requiredFiles.filter((filePath) => !filePath.endsWith(`${path.sep}ToolsPage.jsx`));
    updateDispatchFiles.forEach((filePath) => {
      const content = read(filePath);
      expect(content).toMatch(/updateWorkspace\(/);
    });
  });

  it('validates schema and engine files are wired in unified builder', () => {
    const unifiedBuilder = read(path.join(SRC_DIR, 'state', 'claimDataUnified', 'index.js'));
    expect(unifiedBuilder).toMatch(/runDerivedSignalsEngine/);
    expect(unifiedBuilder).toMatch(/runConditionGeneratorEngine/);
    expect(unifiedBuilder).toMatch(/runLayStatementEngine/);
    expect(unifiedBuilder).toMatch(/runEvidenceIndexEngine/);
    expect(unifiedBuilder).toMatch(/buildUnifiedTimeline/);
  });
});
