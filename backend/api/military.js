import express from 'express';

const router = express.Router();

// In-memory storage (would be replaced with database in production)
let militaryRecords = [];

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

