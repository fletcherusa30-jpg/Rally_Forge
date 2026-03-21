import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const combinedPath = path.join(repoRoot, 'resources', 'state-benefits.json');
const snapshotPath = path.join(repoRoot, 'resources', 'state-benefits.snapshot.json');
const auditPath = path.join(repoRoot, 'resources', 'state-benefits.audit.json');

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function computeSnapshot(combined) {
  const records = Array.isArray(combined?.records) ? combined.records : [];
  return {
    schemaVersion: String(combined?.schemaVersion || 'unknown'),
    generatedAt: String(combined?.generatedAt || new Date().toISOString()),
    combinedHash: stableHash(records),
    stateHashes: Object.fromEntries(records.map((record) => [record.stateCode, stableHash(record)])),
    coverage: combined?.coverage || null,
    federalProgramCount: records[0]?.federal?.programs?.length || 0,
  };
}

async function main() {
  const now = new Date().toISOString();
  const [combined, previousSnapshot] = await Promise.all([
    readJson(combinedPath),
    readJson(snapshotPath).catch(() => null),
  ]);

  const currentSnapshot = computeSnapshot(combined);
  const missingStates = currentSnapshot.coverage?.missingStates || [];
  const schemaChanged = previousSnapshot
    ? previousSnapshot.schemaVersion !== currentSnapshot.schemaVersion
    : false;
  const dataDrift = previousSnapshot
    ? previousSnapshot.combinedHash !== currentSnapshot.combinedHash
    : true;
  const federalProgramDrift = previousSnapshot
    ? Number(previousSnapshot.federalProgramCount || 0) !== Number(currentSnapshot.federalProgramCount || 0)
    : true;

  const report = {
    generatedAt: now,
    checks: {
      missingStates,
      schemaChanged,
      dataDrift,
      federalProgramDrift,
      isComplete50States: missingStates.length === 0,
    },
    previous: previousSnapshot,
    current: currentSnapshot,
  };

  await fs.writeFile(snapshotPath, `${JSON.stringify(currentSnapshot, null, 2)}\n`, 'utf8');

  const existingAudit = await readJson(auditPath).catch(() => ({}));
  const mergedAudit = {
    ...existingAudit,
    watchdog: report,
  };
  await fs.writeFile(auditPath, `${JSON.stringify(mergedAudit, null, 2)}\n`, 'utf8');

  const hasAlert = (
    missingStates.length > 0
    || schemaChanged
    || dataDrift
    || federalProgramDrift
  );

  console.log(JSON.stringify({ ok: !hasAlert, report }, null, 2));
  if (hasAlert) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
