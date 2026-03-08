/**
 * AI System Testing & Validation Router
 * Provides endpoints to test AI alternate theory identification
 */

import express from 'express';
import { 
  getTestConditions, 
  generateValidationReport, 
  getApplicableTheories,
  validateAnalysisCompleteness 
} from '../utils/aiValidation.js';
import aiAnalysisHandler from './aiAnalysisHandler.js';

const router = express.Router();

/**
 * GET /api/ai-test/conditions
 * Returns list of test conditions
 */
router.get('/conditions', (req, res) => {
  const testConditions = getTestConditions();
  res.json({
    totalConditions: testConditions.length,
    conditions: testConditions
  });
});

/**
 * POST /api/ai-test/validate
 * Validates an AI analysis response for theory completeness
 * Body: { analysis: {...}, condition: "..." }
 */
router.post('/validate', (req, res) => {
  try {
    const { analysis, condition } = req.body;

    if (!analysis) {
      return res.status(400).json({
        success: false,
        error: 'Missing analysis object'
      });
    }

    const applicableTheories = condition ? getApplicableTheories(condition) : null;
    const validation = validateAnalysisCompleteness(analysis, applicableTheories);
    const report = generateValidationReport(condition || 'Unknown', analysis, applicableTheories);

    return res.status(200).json({
      success: true,
      validation,
      report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai-test/run-suite
 * Analyzes all test conditions and validates results
 * Returns detailed test report
 */
router.post('/run-suite', async (req, res) => {
  try {
    const testConditions = getTestConditions();
    const results = [];

    for (const testCase of testConditions) {
      try {
        // Create mock request/response for the handler
        const mockReq = {
          body: {
            condition: testCase.condition,
            prompt: `Analyze: ${testCase.condition}`
          }
        };

        const mockRes = {
          status: function(code) {
            this.statusCode = code;
            return this;
          },
          json: function(data) {
            this.responseData = data;
            return this;
          }
        };

        // Call the analysis handler
        await aiAnalysisHandler.handleAnalyzeDeniedCondition(mockReq, mockRes);

        if (mockRes.responseData?.success) {
          const validation = validateAnalysisCompleteness(
            mockRes.responseData.analysis,
            testCase.expectedTheories
          );

          results.push({
            testCase: testCase.name,
            condition: testCase.condition,
            description: testCase.description,
            success: true,
            analysis: mockRes.responseData.analysis,
            validation: {
              completeness: `${validation.score}%`,
              isComplete: validation.isComplete,
              theoriesFound: validation.theoriesFound,
              theoriesMissing: validation.theoriesMissing,
              metrics: validation.metrics
            }
          });
        } else {
          results.push({
            testCase: testCase.name,
            condition: testCase.condition,
            success: false,
            error: mockRes.responseData?.error || 'Unknown error'
          });
        }
      } catch (testError) {
        console.error(`Test case ${testCase.name} failed:`, testError);
        results.push({
          testCase: testCase.name,
          condition: testCase.condition,
          success: false,
          error: testError.message
        });
      }
    }

    // Calculate summary statistics
    const successCount = results.filter(r => r.success).length;
    const avgCompleteness = results
      .filter(r => r.success)
      .reduce((sum, r) => {
        const score = parseInt(r.validation.completeness);
        return sum + (isNaN(score) ? 0 : score);
      }, 0) / Math.max(1, successCount);

    return res.status(200).json({
      success: true,
      summary: {
        totalTests: results.length,
        successful: successCount,
        failed: results.length - successCount,
        averageCompleteness: `${Math.round(avgCompleteness)}%`
      },
      results
    });
  } catch (error) {
    console.error('[Test Suite] Error running validation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ai-test/theory-guide
 * Returns reference guide for all 6 alternate theories
 */
router.get('/theory-guide', (req, res) => {
  const theoriesGuide = {
    theories: [
      {
        name: 'Presumptive Conditions',
        cfrSection: '38 CFR §3.309',
        description: 'Conditions with statutory presumption of service connection',
        examples: [
          'Agent Orange presumptions (Vietnam veterans)',
          'Radiation exposure presumptions',
          'Mustard gas exposure presumptions',
          'Environmental hazard presumptions'
        ],
        evidence: [
          'Service history showing potential exposure',
          'Current diagnosis matching presumptive condition',
          'Medical evidence connecting condition to exposure'
        ]
      },
      {
        name: 'Secondary Service Connection',
        cfrSection: '38 CFR §3.310',
        description: 'Conditions caused by a service-connected disability',
        examples: [
          'Knee arthritis from service-connected knee injury',
          'Depression from service-connected PTSD',
          'Carpal tunnel from service-connected shoulder disability'
        ],
        evidence: [
          'Established service-connected disability',
          'Medical nexus showing condition caused by service-connected disability',
          'Medical records documenting relationship'
        ]
      },
      {
        name: 'Aggravation of Pre-Existing Condition',
        cfrSection: '38 CFR §3.306',
        description: 'Pre-existing condition materially worsened by military service',
        examples: [
          'Pre-existing diabetes worsened during service',
          'Pre-existing knee condition aggravated by physical training',
          'Pre-existing mental health condition exacerbated by combat'
        ],
        evidence: [
          'Pre-service medical records showing baseline condition',
          'Post-service medical evidence showing worsening',
          'Medical nexus explaining how service aggravated condition'
        ]
      },
      {
        name: 'Direct Service Connection',
        cfrSection: '38 CFR §3.303',
        description: 'In-service event, current medical evidence, and medical nexus linking the two',
        examples: [
          'Knee injury from training incident documented in service records',
          'Hearing loss from combat noise exposure',
          'Back injury from vehicle accident during deployment'
        ],
        evidence: [
          'Documented in-service event or incident',
          'Current medical diagnosis',
          'Medical nexus opinion linking condition to service event'
        ]
      },
      {
        name: 'Presumption of Soundness',
        cfrSection: '38 CFR §3.103',
        description: 'Condition presumed to have existed at separation even if not documented at entrance',
        examples: [
          'Condition developed during service but not noted at entrance',
          'Pre-existing condition that manifested during service',
          'Condition linked to in-service event after discharge'
        ],
        evidence: [
          'Service medical records showing condition during service',
          'Timeline showing condition manifested during service period',
          'Medical evidence showing onset during service'
        ]
      },
      {
        name: 'Combat Veteran Consideration',
        cfrSection: '38 CFR §3.304',
        description: 'Combat veterans have special evidentiary considerations for lay testimony',
        examples: [
          'Combat veteran lay statement establishing in-service event',
          'Buddy statements from fellow service members',
          'Unofficial service records or documentation'
        ],
        evidence: [
          'Combat veteran status (Combat Zone Tax Exclusion)',
          'Lay statements from service members',
          'Unofficial documentation of incidents'
        ]
      }
    ]
  };

  res.json(theoriesGuide);
});

export default router;

