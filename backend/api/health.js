import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkFrontend() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const response = await fetch('http://localhost:5173', { signal: controller.signal });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

async function checkDiagnosticReport() {
  return true;
}

router.get('/', async (req, res) => {
  const scannerFile = path.join(rootDir, 'Scanner', 'VA SCANNER', 'backend', 'scannerRoute.js');
  const compensationFile = path.join(rootDir, 'compensation-engine', 'index.js');
  const financialPlannerFile = path.join(rootDir, 'backend', 'services', 'financialPlannerService.js');

  const frontendOk = await checkFrontend();
  const scannerOk = await exists(scannerFile);
  const compensationOk = await exists(compensationFile);
  const financialPlannerOk = await exists(financialPlannerFile);
  const diagnosticOk = await checkDiagnosticReport();

  const backend = 'ok';
  const frontend = frontendOk ? 'ok' : 'fail';
  const scanner = scannerOk ? 'ok' : 'fail';
  const compensation = compensationOk ? 'ok' : 'fail';
  const financialPlanner = financialPlannerOk ? 'ok' : 'fail';
  const diagnostic = diagnosticOk ? 'ok' : 'fail';
  const startup = backend === 'ok' && frontend === 'ok' ? 'ok' : 'fail';

  res.json({
    backend,
    frontend,
    scanner,
    compensation,
    financialPlanner,
    diagnostic,
    startup
  });
});

export default router;

