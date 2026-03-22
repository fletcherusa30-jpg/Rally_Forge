import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadPresumptiveKnowledge,
  getFlattenedPresumptiveLocations,
  getPresumptiveExposureRules,
  matchDeploymentToPresumptive,
} from '../services/presumptiveLocationsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MOS_KNOWLEDGE_ROOT = path.join(__dirname, '..', '..', 'knowledge', 'mos');

const MOS_FILE_BY_BRANCH = {
  Army: 'army.json',
  Navy: 'navy.json',
  'Air Force': 'air-force.json',
  'Marine Corps': 'marine-corps.json',
  'Coast Guard': 'coast-guard.json',
  'Space Force': 'space-force.json',
  'Public Health Service Commissioned Corps (USPHS)': 'usphs.json',
  'NOAA Commissioned Officer Corps': 'noaa.json',
};

const router = express.Router();

// In-memory storage (would be replaced with database in production)
let militaryRecords = [];

function normalizeBranchName(value) {
  const branch = String(value || '').trim();
  return Object.prototype.hasOwnProperty.call(MOS_FILE_BY_BRANCH, branch) ? branch : '';
}

function normalizeMosEntry(entry = {}) {
  const code = String(entry.code || '').trim().toUpperCase();
  const title = String(entry.title || '').trim();
  const type = String(entry.type || '').trim().toLowerCase();
  const description = String(entry.description || '').trim();
  const branch = String(entry.branch || '').trim();
  const exposureCategory = String(entry.exposureCategory || '').trim();
  const notes = String(entry.notes || '').trim();
  const crossBranchEquivalents = Array.isArray(entry.crossBranchEquivalents)
    ? entry.crossBranchEquivalents
      .map((value) => String(value || '').trim().toUpperCase())
      .filter(Boolean)
    : [];

  return {
    code,
    title,
    type,
    description,
    branch,
    crossBranchEquivalents,
    exposureCategory,
    notes,
    label: title ? `${code} - ${title}` : code,
  };
}

/**
 * GET /api/military/records
 * Retrieve all military service records
 */
router.get('/records', (req, res) => {
  try {
    res.json({
      success: true,
      data: militaryRecords,
      count: militaryRecords.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/military/presumptive-knowledge
 * Get flattened deployment locations and exposure matching rules from knowledge JSON
 */
router.get('/presumptive-knowledge', async (_req, res) => {
  try {
    const knowledge = await loadPresumptiveKnowledge();
    const locations = getFlattenedPresumptiveLocations(knowledge);
    const exposureRules = getPresumptiveExposureRules(knowledge);
    res.json({
      success: true,
      data: {
        version: knowledge.version,
        locations,
        exposureRules,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/military/mos-options?branch=<branch>
 * Return branch-specific MOS/AFSC/rating options from the root knowledge catalog.
 */
router.get('/mos-options', async (req, res) => {
  try {
    const branch = normalizeBranchName(req.query?.branch);

    if (!branch) {
      return res.status(400).json({
        success: false,
        error: 'A valid branch query parameter is required',
      });
    }

    const fileName = MOS_FILE_BY_BRANCH[branch];
    const filePath = path.join(MOS_KNOWLEDGE_ROOT, fileName);
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));

    const options = Array.isArray(parsed?.mos)
      ? parsed.mos
        .map((item) => normalizeMosEntry(item))
        .filter((item) => item.code)
        .sort((a, b) => a.code.localeCompare(b.code))
      : [];

    return res.json({
      success: true,
      data: {
        branch,
        options,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/military/radiation-operations
 * Get radiation-risk activities from 38 CFR §3.309(d) and §3.311,
 * optionally filtered by service era and/or date range.
 * Query params: era, startDate, endDate
 */
router.get('/radiation-operations', async (req, res) => {
  try {
    const catalogPath = path.join(
      __dirname, '..', '..', 'knowledge', 'MEDICAL_KNOWLEDGE', 'conditions', 'radiation-risk-activities.json'
    );
    const raw = await fs.readFile(catalogPath, 'utf-8');
    const catalog = JSON.parse(raw.replace(/^\uFEFF/, ''));
    const operations = Array.isArray(catalog.operations) ? catalog.operations : [];

    const { era, startDate, endDate } = req.query;

    const filtered = operations.filter((op) => {
      if (era && Array.isArray(op.eligibleEras) && !op.eligibleEras.includes(era)) {
        return false;
      }
      if (startDate || endDate) {
        const svcStart = startDate ? new Date(`${startDate}T00:00:00Z`) : new Date('1900-01-01T00:00:00Z');
        const svcEnd = endDate ? new Date(`${endDate}T00:00:00Z`) : new Date('9999-12-31T00:00:00Z');
        const opStart = new Date(`${op.dateRange.start}T00:00:00Z`);
        const opEnd = op.dateRange.end === 'present'
          ? new Date('9999-12-31T00:00:00Z')
          : new Date(`${op.dateRange.end}T00:00:00Z`);
        if (svcStart > opEnd || opStart > svcEnd) {
          return false;
        }
      }
      return true;
    });

    res.json({
      success: true,
      data: {
        version: catalog.version,
        authority: catalog.authority,
        operations: filtered,
        presumptiveConditions: catalog.presumptiveConditions_309d,
        radiogenicDiseases: catalog.radiogenicDiseases_311,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/military/match-deployment
 * Match a deployment object against presumptive knowledge rules
 */
router.post('/match-deployment', async (req, res) => {
  try {
    const deployment = req.body?.deployment;
    if (!deployment || !deployment.location) {
      return res.status(400).json({
        success: false,
        error: 'deployment.location is required',
      });
    }

    const knowledge = await loadPresumptiveKnowledge();
    const exposureRules = getPresumptiveExposureRules(knowledge);
    const evidence = matchDeploymentToPresumptive(deployment, exposureRules);

    return res.json({
      success: true,
      data: evidence,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/military/save-records
 * Save military service records
 */
router.post('/save-records', (req, res) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        error: 'Records must be an array'
      });
    }

    militaryRecords = records;

    res.json({
      success: true,
      message: 'Military service records saved successfully',
      count: records.length,
      data: militaryRecords
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/military/add-record
 * Add a single military service record
 */
router.post('/add-record', (req, res) => {
  try {
    const record = req.body;

    if (!record.branch || !record.startDate) {
      return res.status(400).json({
        success: false,
        error: 'Branch and start date are required'
      });
    }

    const newRecord = {
      ...record,
      id: Date.now()
    };

    militaryRecords.push(newRecord);

    res.json({
      success: true,
      message: 'Record added successfully',
      data: newRecord
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/military/records/:id
 * Delete a military service record by ID
 */
router.delete('/records/:id', (req, res) => {
  try {
    const { id } = req.params;
    const initialLength = militaryRecords.length;

    militaryRecords = militaryRecords.filter(record => record.id !== parseInt(id));

    if (militaryRecords.length === initialLength) {
      return res.status(404).json({
        success: false,
        error: 'Record not found'
      });
    }

    res.json({
      success: true,
      message: 'Record deleted successfully',
      count: militaryRecords.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/military/stats
 * Get statistics about military service
 */
router.get('/stats', (req, res) => {
  try {
    let totalMonths = 0;

    militaryRecords.forEach((record) => {
      if (!record.startDate) return;
      const start = new Date(record.startDate);
      const end = record.endDate ? new Date(record.endDate) : new Date();

      let years = end.getFullYear() - start.getFullYear();
      let months = end.getMonth() - start.getMonth();

      if (months < 0) {
        years--;
        months += 12;
      }

      totalMonths += years * 12 + months;
    });

    const totalYears = Math.floor(totalMonths / 12);
    const remainingMonths = totalMonths % 12;

    const branches = [...new Set(militaryRecords.map(r => r.branch))];
    const serviceTypes = [...new Set(militaryRecords.map(r => r.serviceType))];
    const ranks = militaryRecords.map(r => r.rank).filter(Boolean);
    const discharges = [...new Set(militaryRecords.map(r => r.dischargeType))];

    res.json({
      success: true,
      data: {
        totalRecords: militaryRecords.length,
        totalService: {
          years: totalYears,
          months: remainingMonths,
          totalMonths
        },
        branches,
        serviceTypes,
        ranks,
        discharges
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

