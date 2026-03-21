import fs from 'node:fs';
import path from 'node:path';
import { validatePortableDd214Output } from '../../backend/shared/dd214PortableSchemaValidator.js';

const cwd = process.cwd();
const targetDir = path.resolve(cwd, process.argv[2] || 'tests/dd214/corpus');

function collectJsonFiles(dirPath) {
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  return items.flatMap((item) => {
    const fullPath = path.join(dirPath, item.name);
    if (item.isDirectory()) return collectJsonFiles(fullPath);
    if (item.isFile() && item.name.toLowerCase() === 'expected.json') return [fullPath];
    return [];
  });
}

if (!fs.existsSync(targetDir)) {
  console.error(`Target directory not found: ${targetDir}`);
  process.exit(1);
}

const files = collectJsonFiles(targetDir);
if (files.length === 0) {
  console.error(`No expected.json files found under ${targetDir}`);
  process.exit(1);
}

let failures = 0;

for (const filePath of files) {
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const result = validatePortableDd214Output(payload);
  if (!result.valid) {
    failures += 1;
    console.error(`FAIL ${path.relative(cwd, filePath)}`);
    for (const error of result.errors) console.error(`- ${error}`);
  } else {
    console.log(`PASS ${path.relative(cwd, filePath)}`);
  }
}

if (failures > 0) {
  console.error(`dd214-batch-validation-failed: ${failures} file(s)`);
  process.exit(1);
}

console.log(`dd214-batch-validation-valid: ${files.length} file(s)`);
