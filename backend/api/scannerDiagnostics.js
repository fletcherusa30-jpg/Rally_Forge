import express from 'express';
import { quickHealthCheck } from '../va_scanner/backend/scanner-diagnostic.js';

const router = express.Router();

/**
 * GET /api/scanner/diagnostics
 * 
 * Run comprehensive health checks on the VA Scanner system
 * 
 * Query params:
 * - quick: Run quick health check only (default: true)
 * - full: Run full diagnostic suite (default: false)
 * 
 * Response: {
 *   success: boolean,
 *   status: 'healthy' | 'degraded' | 'unhealthy',
 *   checks: { ... },
 *   timestamp: string
 * }
 */
router.get('/scanner/diagnostics', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('[Scanner Diagnostics] Running health checks...');
    
    // Run quick health check
    const baseUrl = `http://localhost:${process.env.PORT || 4000}`;
    const healthResult = await quickHealthCheck(baseUrl);
    
    // Determine overall status
    const allPassed = healthResult.tests.every(t => t.passed);
    const status = allPassed ? 'healthy' : 'degraded';
    
    // Build response
    const response = {
      success: true,
      status,
      checks: {
        pdfWorker: healthResult.tests.find(t => t.name === 'pdfjsWorkerConfigured'),
        endpoints: healthResult.tests.filter(t => t.name.includes('Endpoint')),
        textProcessing: healthResult.tests.find(t => t.name.includes('TextScan')),
        performance: healthResult.tests.find(t => t.name.includes('Performance'))
      },
      summary: {
        totalTests: healthResult.tests.length,
        passed: healthResult.tests.filter(t => t.passed).length,
        failed: healthResult.tests.filter(t => !t.passed).length,
        executionTime: healthResult.executionTime
      },
      timestamp: new Date().toISOString(),
      processingMs: Date.now() - startTime
    };
    
    console.log('[Scanner Diagnostics] Health check complete:', status);
    return res.json(response);
  } catch (error) {
    console.error('[Scanner Diagnostics] Error:', error);
    return res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/scanner/export
 * 
 * Export scan results to various formats
 * 
 * Request: {
 *   format: 'json' | 'csv',
 *   data: { ... scan results ... }
 * }
 * 
 * Response: {
 *   success: boolean,
 *   content: string (formatted data),
 *   filename: string,
 *   mimeType: string
 * }
 */
router.post('/scanner/export', async (req, res) => {
  const startTime = Date.now();
  const { format = 'json', data } = req.body;
  
  try {
    console.log('[Scanner Export] Exporting to', format);
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'No data provided for export'
      });
    }
    
    let content = '';
    let mimeType = '';
    let extension = '';
    
    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    } else if (format === 'csv') {
      // Generate CSV from scan results
      const lines = [];
      lines.push('Category,Item,Value,Details,Effective Date');
      
      // Service-connected conditions
      if (data.conditions) {
        data.conditions.forEach(c => {
          lines.push(`Service-Connected,"${c.name}",${c.evaluationPercent}%,"${c.diagnosticCode || 'N/A'}","${c.effectiveDate || 'N/A'}"`);
        });
      }
      
      // Denied conditions
      if (data.deniedConditions) {
        data.deniedConditions.forEach(d => {
          const reasons = d.denialReasons?.join('; ') || 'N/A';
          lines.push(`Denied,"${d.name}",,"${reasons}",`);
        });
      }
      
      // Ancillary benefits
      if (data.ancillaryBenefits) {
        data.ancillaryBenefits.forEach(b => {
          lines.push(`Ancillary Benefit,"${b.name}",${b.status},"${b.basis || ''}","${b.effectiveDate || 'N/A'}"`);
        });
      }
      
      // SMC
      if (data.smcAwards) {
        data.smcAwards.forEach(s => {
          lines.push(`SMC,SMC(${s.level}),"${s.basis}",,"${s.effectiveDate || 'N/A'}"`);
        });
      }
      
      // Combined rating
      if (data.combinedRating) {
        lines.push(`Summary,Combined Rating,${data.combinedRating.percent}%,"${data.combinedRating.method || ''}",`);
      }
      
      content = lines.join('\n');
      mimeType = 'text/csv';
      extension = 'csv';
    } else {
      return res.status(400).json({
        success: false,
        error: `Unsupported format: ${format}`
      });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `va-scanner-results-${timestamp}.${extension}`;
    
    console.log('[Scanner Export] Export complete:', filename);
    
    return res.json({
      success: true,
      content,
      filename,
      mimeType,
      size: content.length,
      processingMs: Date.now() - startTime
    });
  } catch (error) {
    console.error('[Scanner Export] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

