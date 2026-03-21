import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const databaseDir = path.resolve(__dirname, '..');
const workspaceDir = path.resolve(databaseDir, '../../..');

const manifestPath = path.join(__dirname, 'rate-database-manifest.json');
const yearsDir = path.join(databaseDir, 'YEARS');
const engineRatesDir = path.join(workspaceDir, 'compensation-engine', 'rates');

const REQUIRED_RATINGS = ['10', '20', '30', '40', '50', '60', '70', '80', '90', '100'];

// Strict mode: treat warnings as errors (for CI/release branches)
const STRICT_MODE = process.argv.includes('--strict') || process.env.STRICT_MODE === '1';

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function listJsonYears(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter((name) => name.endsWith('.json'))
    .map((name) => Number.parseInt(name.replace('.json', ''), 10))
    .filter((value) => Number.isFinite(value));
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function compareMoney(a, b) {
  return Math.abs(a - b) < 0.005;
}

function run() {
  const errors = [];
  const warnings = [];
  let expectedUnpopulatedPlaceholders = 0;

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest file not found: ${manifestPath}`);
  }

  const manifest = loadJson(manifestPath);
  const manifestYears = Array.isArray(manifest.years) ? manifest.years : [];
  const dataStatus = String(manifest.data_status || '').toUpperCase();

  const yearFiles = listJsonYears(yearsDir).sort((a, b) => a - b);
  const engineYears = listJsonYears(engineRatesDir)
    .filter((year) => year >= 1950 && year <= 2100)
    .sort((a, b) => a - b);

  if (manifestYears.length === 0) {
    errors.push('Manifest years list is empty.');
  }

  const missingYearFiles = manifestYears.filter((year) => !yearFiles.includes(year));
  if (missingYearFiles.length > 0) {
    errors.push(`Missing YEAR files for manifest years: ${missingYearFiles.join(', ')}`);
  }

  const extraYearFiles = yearFiles.filter((year) => !manifestYears.includes(year));
  if (extraYearFiles.length > 0) {
    warnings.push(`YEAR files not listed in manifest: ${extraYearFiles.join(', ')}`);
  }

  if (engineYears.length === 0) {
    warnings.push('No compensation-engine rate tables found to compare against.');
  }

  const overlapYears = manifestYears.filter((year) => engineYears.includes(year));

  for (const year of overlapYears) {
    const yearFilePath = path.join(yearsDir, `${year}.json`);
    if (!fs.existsSync(yearFilePath)) continue;

    const yearData = loadJson(yearFilePath);
    const ratings = yearData.ratings || {};

    for (const rating of REQUIRED_RATINGS) {
      if (!ratings[rating]) {
        errors.push(`YEAR ${year}: missing rating block ${rating}`);
      }
    }

    const engineRatePath = path.join(engineRatesDir, `${year}.json`);
    const engineData = loadJson(engineRatePath);
    const engineBase = engineData.baseCompensation || {};

    for (const rating of REQUIRED_RATINGS) {
      const yearVeteran = ratings?.[rating]?.veteran;
      const engineVeteran = engineBase?.[rating];

      if (!isNumber(engineVeteran)) {
        errors.push(`Engine year ${year}: missing baseCompensation.${rating}`);
        continue;
      }

      if (dataStatus === 'POPULATED') {
        if (!isNumber(yearVeteran)) {
          errors.push(`YEAR ${year}: rating ${rating} veteran is not populated`);
          continue;
        }
        if (!compareMoney(yearVeteran, engineVeteran)) {
          errors.push(
            `YEAR ${year}: rating ${rating} veteran mismatch (YEAR=${yearVeteran}, ENGINE=${engineVeteran})`
          );
        }
      } else {
        if (yearVeteran === null || yearVeteran === undefined) {
          expectedUnpopulatedPlaceholders += 1;
        }
      }
    }
  }

  console.log('RATE DATABASE Validation');
  console.log(`- data_status: ${dataStatus || 'UNKNOWN'}`);
  console.log(`- manifest years: ${manifestYears.length}`);
  console.log(`- YEAR json files: ${yearFiles.length}`);
  console.log(`- engine overlap years: ${overlapYears.length}`);
  console.log(`- strict mode: ${STRICT_MODE ? 'ENABLED' : 'DISABLED'}`);
  if (dataStatus !== 'POPULATED' && expectedUnpopulatedPlaceholders > 0) {
    console.log(`- expected UNPOPULATED placeholders: ${expectedUnpopulatedPlaceholders}`);
  }

  if (warnings.length > 0) {
    const warningLabel = STRICT_MODE ? 'Errors (strict mode)' : 'Warnings';
    console.log(`\n${warningLabel}:`);
    warnings.slice(0, 25).forEach((warning) => console.log(`  - ${warning}`));
    if (warnings.length > 25) {
      console.log(`  ... ${warnings.length - 25} more warning(s)`);
    }
  }

  if (errors.length > 0) {
    console.error('\nErrors:');
    errors.forEach((error) => console.error(`  - ${error}`));
    process.exitCode = 1;
    return;
  }

  if (STRICT_MODE && warnings.length > 0) {
    console.error(`\nValidation failed in strict mode: ${warnings.length} warning(s) treated as error(s).`);
    process.exitCode = 1;
    return;
  }

  console.log('\nValidation passed.');
}

run();
