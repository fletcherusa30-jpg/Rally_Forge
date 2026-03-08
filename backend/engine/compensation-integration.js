/**
 * STR Scanner ↔ Compensation Engine Integration
 * 
 * This module integrates the STR (Supplemental Text Response) Scanner output
 * with the VA Compensation Engine to provide complete compensation calculation
 * based on validated disability data extracted from VA decision letters.
 * 
 * Data Flow:
 * 1. Upload VA decision letter → STR Scanner extracts data
 * 2. STR output: combinedRating, decisionDate, dependents[], smc[]
 * 3. Compensation Engine: receives STR output
 * 4. Period-based calculation: respects COLA, dependent changes, SMC changes
 * 5. Frontend displays: monthly/annual compensation and detailed periods
 */

import { calculateCompensation, formatCompensationResponse } from './compensationEngine.js';

/**
 * Process STR scanner output through compensation engine
 * 
 * @param {object} strScannerResult - Output from STR scanner containing:
 *   {
 *     combinedRating: {finalPercent, percentageString, effectiveDate},
 *     decisionDate: "2017-11-27",
 *     dependents: [{type, name, effectiveDate, removalDate}, ...],
 *     smc: {
 *       explicit: [{code, description, effectiveDate, removalDate}, ...],
 *       inferred: [{code, description, confidence}, ...]
 *     },
 *     medicalConditions: [...],
 *     dateProcessed: ...
 *   }
 * 
 * @returns {object} Structured compensation calculation result ready for API/frontend
 */
export function processSTRToCompensation(strScannerResult) {
  // Validate STR result is properly formatted
  if (!strScannerResult || typeof strScannerResult !== 'object') {
    return {
      success: false,
      error: 'Invalid STR scanner result',
      data: null
    };
  }

  // Transform STR output to compensation engine format
  // (already compatible, but let's be explicit about the mapping)
  const compensationInput = {
    combinedRating: strScannerResult.combinedRating,
    decisionDate: strScannerResult.decisionDate,
    dependents: strScannerResult.dependents || [],
    smc: strScannerResult.smc || { explicit: [], inferred: [] }
  };

  // Calculate compensation
  const rawResult = calculateCompensation(compensationInput);

  // Format for API response
  const formattedResult = formatCompensationResponse(rawResult);

  // Enrich with STR metadata
  return {
    ...formattedResult,
    metadata: {
      strProcessedDate: strScannerResult.dateProcessed,
      medicalConditionsExtracted: strScannerResult.medicalConditions?.length || 0,
      smcExtracted: strScannerResult.smc?.explicit?.length || 0
    }
  };
}

/**
 * Create a compensation calculation from STR data for API response
 * Suitable for sending to frontend or storing in database
 * 
 * @param {object} strData - STR scanner output
 * @returns {object} API response envelope
 */
export function createCompensationAPIResponse(strData) {
  const result = processSTRToCompensation(strData);
  
  if (!result.success) {
    return {
      success: false,
      statusCode: 400,
      message: result.error || 'Failed to calculate compensation',
      data: null,
      timestamp: new Date().toISOString()
    };
  }

  return {
    success: true,
    statusCode: 200,
    message: 'Compensation calculation completed',
    data: {
      veteran: result.data?.veteran,
      compensation: {
        current: {
          monthly: result.data?.monthlyCompensation,
          annual: result.data?.annualCompensation
        },
        periods: result.data?.periods,
        periodCount: result.data?.periods?.length || 0
      },
      metadata: result.metadata,
      validatedAt: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Backend API endpoint handler for compensation calculation
 * Express-compatible middleware for POST /api/compensation
 * 
 * @param {object} req - Express request object (req.body contains STR result)
 * @param {object} res - Express response object
 */
export async function handleCompensationCalculation(req, res) {
  try {
    const strData = req.body;

    // Validate input
    if (!strData || !strData.combinedRating || !strData.decisionDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: combinedRating, decisionDate',
        statusCode: 400
      });
    }

    // Calculate compensation
    const response = createCompensationAPIResponse(strData);

    // Return response
    return res.status(response.statusCode).json(response);
  } catch (error) {
    console.error('Compensation calculation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error calculating compensation',
      error: error.message,
      statusCode: 500,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Example integration for backend/api/compensation.js
 * Shows how to structure the API endpoint
 */
export const exampleAPIStructure = `
// File: backend/api/compensation.js
import { handleCompensationCalculation } from '../engine/compensation-integration.js';

export async function calculateCompensation(req, res) {
  return handleCompensationCalculation(req, res);
}

// Usage in backend/server.js:
// app.post('/api/compensation', calculateCompensation);
`;

export default {
  processSTRToCompensation,
  createCompensationAPIResponse,
  handleCompensationCalculation
};

