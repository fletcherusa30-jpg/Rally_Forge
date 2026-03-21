import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function walkFiles(rootDir) {
  const output = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      output.push(...walkFiles(fullPath));
      continue;
    }

    if (/\.(js|jsx|ts|tsx|css)$/.test(entry.name)) {
      output.push(fullPath);
    }
  }

  return output;
}

function fromChars(chars) {
  return String.fromCharCode(...chars);
}

describe('profile legacy reference regression', () => {
  it('contains no removed profile timeline artifacts in frontend source', () => {
    const sourceRoot = path.resolve(process.cwd(), 'src');
    const files = walkFiles(sourceRoot);

    const tokenA = fromChars([67, 97, 115, 101, 78, 111, 116, 101, 115, 84, 105, 109, 101, 108, 105, 110, 101]);
    const tokenB = fromChars([110, 111, 116, 101, 69, 110, 116, 114, 105, 101, 115]);
    const tokenC = fromChars([112, 114, 111, 102, 105, 108, 101, 46, 110, 111, 116, 101, 115]);

    const forbidden = [new RegExp(tokenA), new RegExp(tokenB), new RegExp(tokenC)];
    const offenders = [];

    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      if (forbidden.some((rule) => rule.test(text))) {
        offenders.push(path.relative(sourceRoot, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
