import fs from 'node:fs';
import path from 'node:path';
import { validatePortableDd214Output } from '../../backend/shared/dd214PortableSchemaValidator.js';

const cwd = process.cwd();

function main() {
  const targetArg = process.argv[2];
  if (!targetArg) {
    console.error('Usage: node tooling/scripts/validate-dd214-output.mjs <path-to-json-output>');
    process.exit(1);
  }

  const targetPath = path.resolve(cwd, targetArg);
  if (!fs.existsSync(targetPath)) {
    console.error(`Target JSON file not found: ${targetPath}`);
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  const { valid, errors } = validatePortableDd214Output(payload);

  if (!valid) {
    console.error('DD-214 output validation failed.');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('dd214-output-valid');
}

main();