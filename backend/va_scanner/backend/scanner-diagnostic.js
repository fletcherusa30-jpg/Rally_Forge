/**
 * Rally Forge VA Scanner Self-Diagnostic Module
 * ===============================================
 * 
 * Comprehensive health check and diagnostic system for the VA Scanner
 * 
 * Features:
 * - PDF.js worker validation
 * - Scanner endpoint testing
 * - Parser accuracy verification
 * - Performance benchmarking
 * - Error detection
 * 
 * Usage:
 * 1. Frontend: import { runDiagnostics } from './scanner-diagnostic';
 * 2. Backend: import diagnostics from './scanner-diagnostic.js';
 * 3. CLI: node scanner-diagnostic.js --full
 * 
 * @version 1.0.0
 * @date 2026-02-21
 */

import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure PDF.js worker for Node.js environment
const workerPath = path.resolve(__dirname, '../../../node_modules/pdfjs-dist/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

// ============================================================================
// TEST DATA
// ============================================================================

const TEST_CASES = {
  validText: {
    input: `DEPARTMENT OF VETERANS AFFAIRS
    
Rating Decision
File Number: 123-45-6789
Veteran: John Doe

The service-connected evaluation for Post Traumatic Stress Disorder (PTSD) is granted and evaluated as 70 percent disabling.

The service-connected evaluation for Tinnitus is granted and evaluated as 10 percent disabling.

Service connection for left knee strain is denied.

Your combined evaluation is 70 percent.

Effective date: January 1, 2024`,
    expectedItems: 2,
    expectedDenied: 1,
    expectedCombined: 70,
  },
  
  complexText: {
    input: `Service connection for right shoulder, evaluated as 20 percent, is granted.
Service connection for left shoulder, evaluated as 20 percent, is granted.
Service connection for bilateral hearing loss is granted and evaluated as 0 percent.
Service connection for migraine headaches is denied.`,
    expectedItems: 3,
    expectedDenied: 1,
  },
  
  edgeCases: {
    empty: '',
    tooShort: 'Test',
    binary: String.fromCharCode(0, 1, 2, 3, 4) + 'binary data',
    unicode: '服务连接 тест ทดสอบ',
    special: '<script>alert("xss")</script>',
  }
};

// ============================================================================
// DIAGNOSTIC RESULTS
// ============================================================================

class DiagnosticResult {
  constructor() {
    this.timestamp = new Date().toISOString();
    this.tests = [];
    this.warnings = [];
    this.errors = [];
    this.metrics = {};
  }
  
  addTest(name, passed, details = {}) {
    this.tests.push({
      name,
      passed,
      timestamp: Date.now(),
      ...details
    });
  }
  
  addWarning(message) {
    this.warnings.push({
      message,
      timestamp: Date.now()
    });
  }
  
  addError(message, error) {
    this.errors.push({
      message,
      error: error?.message || String(error),
      stack: error?.stack,
      timestamp: Date.now()
    });
  }
  
  addMetric(name, value, unit = '') {
    this.metrics[name] = { value, unit, timestamp: Date.now() };
  }
  
  getSummary() {
    const passed = this.tests.filter(t => t.passed).length;
    const failed = this.tests.filter(t => !t.passed).length;
    const total = this.tests.length;
    
    return {
      total,
      passed,
      failed,
      passRate: total > 0 ? (passed / total * 100).toFixed(2) + '%' : 'N/A',
      warnings: this.warnings.length,
      errors: this.errors.length,
      health: this.getHealthStatus(),
      timestamp: this.timestamp,
      metrics: this.metrics,
    };
  }
  
  getHealthStatus() {
    const passed = this.tests.filter(t => t.passed).length;
    const total = this.tests.length;
    
    if (total === 0) return 'UNKNOWN';
    if (this.errors.length > 0) return 'CRITICAL';
    if (this.warnings.length > 3) return 'WARNING';
    
    const passRate = passed / total;
    if (passRate >= 0.95) return 'HEALTHY';
    if (passRate >= 0.80) return 'DEGRADED';
    return 'CRITICAL';
  }
  
  toJSON() {
    return {
      summary: this.getSummary(),
      tests: this.tests,
      warnings: this.warnings,
      errors: this.errors,
      metrics: this.metrics,
    };
  }
}

// ============================================================================
// PDF.js WORKER DIAGNOSTICS
// ============================================================================

async function testPdfjsWorker(result) {
  console.log('🔍 Testing PDF.js worker...');
  
  try {
    // Check if pdfjs-dist is installed
    const pdfjsVersion = pdfjsLib.version || 'unknown';
    result.addMetric('pdfjsVersion', pdfjsVersion);
    
    // Test worker path configuration
    const workerExists = fs.existsSync(workerPath);
    
    if (!workerExists) {
      result.addError('PDF.js worker file not found', new Error('Worker path: ' + workerPath));
      result.addTest('pdfjsWorkerExists', false, { path: workerPath });
      return;
    }
    
    result.addTest('pdfjsWorkerExists', true, { path: workerPath });
    
    // Configure worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
    result.addTest('pdfjsWorkerConfigured', true);
    
    // Test minimal PDF parsing
    const minimalPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF', 'utf8');
    
    const startTime = Date.now();
    try {
      const loadingTask = pdfjsLib.getDocument({ data: minimalPdf });
      const pdf = await loadingTask.promise;
      const loadTime = Date.now() - startTime;
      
      result.addMetric('pdfLoadTime', loadTime, 'ms');
      result.addTest('pdfjsCanLoadPdf', true, { pages: pdf.numPages, loadTime });
      
      // Cleanup
      await pdf.destroy();
      
    } catch (pdfError) {
      result.addError('PDF.js cannot load test PDF', pdfError);
      result.addTest('pdfjsCanLoadPdf', false, { error: pdfError.message });
    }
    
  } catch (error) {
    result.addError('PDF.js worker test failed', error);
    result.addTest('pdfjsWorkerTest', false, { error: error.message });
  }
}

// ============================================================================
// SCANNER ENDPOINT DIAGNOSTICS
// ============================================================================

async function testScannerEndpoints(result, baseUrl = 'http://localhost:4000') {
  console.log('🔍 Testing scanner endpoints...');
  
  const endpoints = [
    { path: '/api/health', method: 'GET', name: 'healthCheck' },
    { path: '/api/scanner/test', method: 'GET', name: 'scannerTest' },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const startTime = Date.now();
      const response = await fetch(baseUrl + endpoint.path, {
        method: endpoint.method,
      });
      const responseTime = Date.now() - startTime;
      
      result.addMetric(`${endpoint.name}ResponseTime`, responseTime, 'ms');
      
      const isSuccess = response.status >= 200 && response.status < 300;
      result.addTest(endpoint.name, isSuccess, {
        status: response.status,
        responseTime,
        url: endpoint.path
      });
      
      if (responseTime > 1000) {
        result.addWarning(`Slow endpoint: ${endpoint.path} took ${responseTime}ms`);
      }
      
    } catch (error) {
      result.addError(`Endpoint test failed: ${endpoint.path}`, error);
      result.addTest(endpoint.name, false, { error: error.message });
    }
  }
}

// ============================================================================
// TEXT SCANNING DIAGNOSTICS
// ============================================================================

async function testTextScanning(result, baseUrl = 'http://localhost:4000') {
  console.log('🔍 Testing text scanning...');
  
  try {
    // Test valid text
    const validTest = TEST_CASES.validText;
    const startTime = Date.now();
    
    const response = await fetch(baseUrl + '/api/scanner/scan-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: validTest.input }),
    });
    
    const scanTime = Date.now() - startTime;
    result.addMetric('textScanTime', scanTime, 'ms');
    
    const data = await response.json();
    
    if (!response.ok) {
      result.addTest('textScanValid', false, { 
        status: response.status,
        error: data.error 
      });
      return;
    }
    
    // Verify parsing accuracy
    const serviceConnected = data.data?.serviceConnected || [];
    const denied = data.data?.denied || [];
    const combinedRating = data.data?.ratingCalculation?.calculatedCombinedRating;
    
    const itemsMatch = serviceConnected.length === validTest.expectedItems;
    const deniedMatch = denied.length === validTest.expectedDenied;
    const ratingMatch = combinedRating === validTest.expectedCombined;
    
    result.addTest('textScanValid', response.ok && itemsMatch, {
      expectedItems: validTest.expectedItems,
      actualItems: serviceConnected.length,
      expectedDenied: validTest.expectedDenied,
      actualDenied: denied.length,
    });
    
    result.addTest('parsingAccuracy', itemsMatch && deniedMatch, {
      itemsMatch,
      deniedMatch,
      ratingMatch,
    });
    
    if (scanTime > 5000) {
      result.addWarning(`Slow text scan: ${scanTime}ms`);
    }
    
    // Test edge cases
    await testEdgeCases(result, baseUrl);
    
  } catch (error) {
    result.addError('Text scanning test failed', error);
    result.addTest('textScanValid', false, { error: error.message });
  }
}

async function testEdgeCases(result, baseUrl) {
  console.log('🔍 Testing edge cases...');
  
  const edgeCases = TEST_CASES.edgeCases;
  
  // Empty text
  try {
    const response = await fetch(baseUrl + '/api/scanner/scan-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: edgeCases.empty }),
    });
    
    const expects400 = response.status === 400;
    result.addTest('emptyTextRejected', expects400, {
      status: response.status,
      expected: 400
    });
    
  } catch (error) {
    result.addError('Empty text test failed', error);
    result.addTest('emptyTextRejected', false);
  }
  
  // Too short text
  try {
    const response = await fetch(baseUrl + '/api/scanner/scan-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: edgeCases.tooShort }),
    });
    
    const expects400 = response.status === 400;
    result.addTest('shortTextRejected', expects400, {
      status: response.status,
      expected: 400
    });
    
  } catch (error) {
    result.addError('Short text test failed', error);
    result.addTest('shortTextRejected', false);
  }
}

// ============================================================================
// PERFORMANCE BENCHMARKING
// ============================================================================

async function runPerformanceBenchmark(result, baseUrl = 'http://localhost:4000') {
  console.log('🔍 Running performance benchmark...');
  
  const iterations = 5;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    
    try {
      const response = await fetch(baseUrl + '/api/scanner/scan-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: TEST_CASES.validText.input }),
      });
      
      await response.json();
      times.push(Date.now() - start);
      
    } catch (error) {
      result.addWarning(`Benchmark iteration ${i + 1} failed: ${error.message}`);
    }
  }
  
  if (times.length > 0) {
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    result.addMetric('avgScanTime', avgTime.toFixed(2), 'ms');
    result.addMetric('minScanTime', minTime, 'ms');
    result.addMetric('maxScanTime', maxTime, 'ms');
    
    const performanceGood = avgTime < 1000;
    result.addTest('performanceBenchmark', performanceGood, {
      avgTime: avgTime.toFixed(2),
      minTime,
      maxTime,
      iterations: times.length
    });
    
    if (avgTime > 2000) {
      result.addWarning(`High average scan time: ${avgTime.toFixed(2)}ms`);
    }
  }
}

// ============================================================================
// MAIN DIAGNOSTIC RUNNER
// ============================================================================

/**
 * Run full diagnostic suite
 */
export async function runFullDiagnostics(options = {}) {
  const {
    baseUrl = 'http://localhost:4000',
    skipEndpoints = false,
    skipBenchmark = false,
  } = options;
  
  console.log('╔════════════════════════════════════════╗');
  console.log('║  VA Scanner Self-Diagnostic Module    ║');
  console.log('║  Version 1.0.0                         ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  const result = new DiagnosticResult();
  
  // Test 1: PDF.js Worker
  await testPdfjsWorker(result);
  
  // Test 2: Scanner Endpoints
  if (!skipEndpoints) {
    await testScannerEndpoints(result, baseUrl);
  }
  
  // Test 3: Text Scanning
  if (!skipEndpoints) {
    await testTextScanning(result, baseUrl);
  }
  
  // Test 4: Performance Benchmark
  if (!skipEndpoints && !skipBenchmark) {
    await runPerformanceBenchmark(result, baseUrl);
  }
  
  // Display results
  displayResults(result);
  
  return result;
}

/**
 * Run quick health check
 */
export async function quickHealthCheck(baseUrl = 'http://localhost:4000') {
  console.log('🏥 Quick Health Check...\n');
  
  const result = new DiagnosticResult();
  
  try {
    // Check health endpoint
    const healthResponse = await fetch(baseUrl + '/api/health');
    const healthOk = healthResponse.ok;
    result.addTest('healthEndpoint', healthOk, { status: healthResponse.status });
    
    // Check scanner test endpoint
    const scannerResponse = await fetch(baseUrl + '/api/scanner/test');
    const scannerOk = scannerResponse.ok;
    result.addTest('scannerEndpoint', scannerOk, { status: scannerResponse.status });
    
    const summary = result.getSummary();
    
    console.log(`✅ Health: ${summary.health}`);
    console.log(`📊 Tests: ${summary.passed}/${summary.total} passed`);
    
    return summary.health === 'HEALTHY';
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

// ============================================================================
// RESULT DISPLAY
// ============================================================================

function displayResults(result) {
  const summary = result.getSummary();
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║         DIAGNOSTIC SUMMARY             ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  // Health status
  const healthEmoji = {
    'HEALTHY': '✅',
    'DEGRADED': '⚠️',
    'WARNING': '⚠️',
    'CRITICAL': '❌',
    'UNKNOWN': '❓'
  }[summary.health] || '❓';
  
  console.log(`${healthEmoji} Overall Health: ${summary.health}`);
  console.log(`📊 Tests: ${summary.passed}/${summary.total} passed (${summary.passRate})`);
  console.log(`⚠️  Warnings: ${summary.warnings}`);
  console.log(`❌ Errors: ${summary.errors}`);
  console.log(`⏱️  Timestamp: ${summary.timestamp}\n`);
  
  // Metrics
  if (Object.keys(summary.metrics).length > 0) {
    console.log('📈 Metrics:');
    for (const [name, data] of Object.entries(summary.metrics)) {
      console.log(`   ${name}: ${data.value}${data.unit}`);
    }
    console.log('');
  }
  
  // Failed tests
  const failedTests = result.tests.filter(t => !t.passed);
  if (failedTests.length > 0) {
    console.log('❌ Failed Tests:');
    failedTests.forEach(test => {
      console.log(`   • ${test.name}`);
      if (test.error) console.log(`     Error: ${test.error}`);
    });
    console.log('');
  }
  
  // Warnings
  if (result.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    result.warnings.forEach(warning => {
      console.log(`   • ${warning.message}`);
    });
    console.log('');
  }
  
  // Errors
  if (result.errors.length > 0) {
    console.log('❌ Errors:');
    result.errors.forEach(error => {
      console.log(`   • ${error.message}`);
      console.log(`     ${error.error}`);
    });
    console.log('');
  }
  
  console.log('═══════════════════════════════════════════\n');
}

// ============================================================================
// CLI SUPPORT
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
VA Scanner Diagnostics CLI

Usage:
  node scanner-diagnostic.js [options]

Options:
  --quick              Run quick health check only
  --full               Run full diagnostic suite (default)
  --skip-endpoints     Skip endpoint testing (offline mode)
  --skip-benchmark     Skip performance benchmarking
  --url <url>          Set base URL (default: http://localhost:4000)
  --json               Output as JSON
  --help, -h           Show this help message

Examples:
  node scanner-diagnostic.js --quick
  node scanner-diagnostic.js --full --url http://localhost:4000
  node scanner-diagnostic.js --skip-benchmark --json
    `);
    process.exit(0);
  }
  
  const isQuick = args.includes('--quick');
  const baseUrl = args.includes('--url') 
    ? args[args.indexOf('--url') + 1] 
    : 'http://localhost:4000';
  const jsonOutput = args.includes('--json');
  
  if (isQuick) {
    quickHealthCheck(baseUrl).then(healthy => {
      process.exit(healthy ? 0 : 1);
    });
  } else {
    const options = {
      baseUrl,
      skipEndpoints: args.includes('--skip-endpoints'),
      skipBenchmark: args.includes('--skip-benchmark'),
    };
    
    runFullDiagnostics(options).then(result => {
      if (jsonOutput) {
        console.log(JSON.stringify(result.toJSON(), null, 2));
      }
      
      const summary = result.getSummary();
      process.exit(summary.health === 'HEALTHY' ? 0 : 1);
    });
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  runFullDiagnostics,
  quickHealthCheck,
  DiagnosticResult,
  TEST_CASES,
};

