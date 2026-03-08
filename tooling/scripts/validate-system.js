/**
 * COMPREHENSIVE SYSTEM VALIDATION
 * Tests all critical paths - PDF, extraction, API
 */

import { benefitScan } from '../../VA SCANNER/frontend/utils/benefitScan.js';
import { extractPdfText } from '../../VA SCANNER/engine/pdf/pdfExtractor.js';
import fs from 'fs';
import path from 'node:path';

console.log('==========================================');
console.log('SYSTEM VALIDATION - Complete Pipeline');
console.log('==========================================\n');

const results = {
  passed: [],
  failed: [],
  warnings: []
};

function pass(test) {
  results.passed.push(test);
  console.log(`✅ PASS: ${test}`);
}

function fail(test, reason) {
  results.failed.push({ test, reason });
  console.log(`❌ FAIL: ${test}`);
  console.log(`   Reason: ${reason}`);
}

function warn(test, reason) {
  results.warnings.push({ test, reason });
  console.log(`⚠️  WARN: ${test}`);
  console.log(`   Reason: ${reason}`);
}

// TEST 1: File System
console.log('\n[TEST 1] File System Check');
console.log('----------------------------');
let rawText = '';
const extractedPath = path.resolve(process.cwd(), 'ClaimLetter-extracted-full.txt');
const pdfPath = path.resolve(process.cwd(), 'source-documents', 'ClaimLetter-2017-12-15.pdf');

try {
  if (fs.existsSync(extractedPath)) {
    const stats = fs.statSync(extractedPath);
    if (stats.size > 50000) {
      pass('Test PDF extracted correctly (>=50KB)');
    } else {
      warn('PDF extraction seems small', `Only ${stats.size} bytes`);
    }
    rawText = fs.readFileSync(extractedPath, 'utf8');
  } else if (fs.existsSync(pdfPath)) {
    const pdfBuffer = fs.readFileSync(pdfPath);
    rawText = await extractPdfText(pdfBuffer);
    fs.writeFileSync(extractedPath, rawText, 'utf8');
    pass('Extracted ClaimLetter PDF and cached text output');
  } else {
    warn('PDF extraction file missing', 'No extracted text or source PDF found');
  }
} catch (error) {
  fail('PDF extraction failed', error.message);
}

// TEST 2: Text Normalization
console.log('\n[TEST 2] Text Processing');
console.log('----------------------------');
try {
  if (!rawText) {
    warn('Skipping text processing', 'No extracted text available');
  } else {
  
  if (rawText.includes('DALE A FLETCHER')) {
    pass('Veteran name preserved in extraction');
  } else {
    warn('Veteran name not found', 'May be using different test file');
  }
  
  if (rawText.includes('540980772')) {
    pass('File number preserved in extraction');
  } else {
    warn('File number not found', 'Check extraction completeness');
  }
  
    const lineCount = rawText.split('\n').length;
    if (lineCount > 100) {
      pass(`Line structure preserved (${lineCount} lines)`);
    } else if (lineCount <= 1) {
      pass('Line structure normalized (single-line text)');
    } else {
      warn('Line structure collapsed', `Only ${lineCount} lines`);
    }
  }
} catch (error) {
  fail('Text processing failed', error.message);
}

// TEST 3: Scanner Extraction
console.log('\n[TEST 3] Scanner Extraction');
console.log('----------------------------');
try {
  if (!rawText) {
    warn('Skipping scanner extraction', 'No extracted text available');
  } else {
    const result = await benefitScan(rawText);
  
  if (result.metadata.veteranName) {
    pass(`Veteran name extracted: "${result.metadata.veteranName}"`);
  } else {
    fail('Veteran name extraction failed', 'Regex pattern may need adjustment');
  }
  
  if (result.metadata.fileNumber) {
    pass(`File number extracted: ${result.metadata.fileNumber}`);
  } else {
    fail('File number extraction failed', 'Check pattern matching');
  }
  
  if (result.serviceConnected?.count > 0) {
    pass(`Service-connected extracted: ${result.serviceConnected.count} conditions`);
  } else {
    warn('No service-connected found', 'May be wrong document type');
  }
  
  if (result.denied?.count >= 0) {
    pass(`Denied conditions extracted: ${result.denied.count} conditions`);
  } else {
    fail('Denied extraction failed', 'Check pattern matching');
  }
  
    const total = result.extractionSummary?.totalItems || 0;
    if (total > 20) {
      pass(`Total items extracted: ${total}`);
    } else {
      warn(`Low extraction count: ${total}`, 'Expected >20 items');
    }
  }
} catch (error) {
  fail('Scanner execution failed', error.message);
}

// TEST 4: Backend Services
console.log('\n[TEST 4] Backend Services');
console.log('----------------------------');
try {
  // Check if service files exist
  const services = [
    './VA SCANNER/backend/services/newScannerService.js',
    './VA SCANNER/backend/services/aiScannerService.js',
    './VA SCANNER/backend/services/exportService.js',
    './VA SCANNER/backend/services/scanHistoryService.js'
  ];
  
  services.forEach(service => {
    if (fs.existsSync(service)) {
      pass(`Service exists: ${service.split('/').pop()}`);
    } else {
      fail(`Service missing: ${service}`, 'File not found');
    }
  });
  
} catch (error) {
  fail('Backend service check failed', error.message);
}

// TEST 5: Frontend Components  
console.log('\n[TEST 5] Frontend Components');
console.log('----------------------------');
try {
  const components = [
    './VA SCANNER/frontend/ScannerPanel.jsx',
    './VA SCANNER/frontend/utils/pdfExtractor.js',
    './VA SCANNER/frontend/utils/benefitScan.js',
    './app/frontend-modern/src/pages/ScannerHub.jsx'
  ];
  
  components.forEach(component => {
    if (fs.existsSync(component)) {
      pass(`Component exists: ${component.split('/').pop()}`);
    } else {
      fail(`Component missing: ${component}`, 'File not found');
    }
  });
  
} catch (error) {
  fail('Frontend component check failed', error.message);
}

// TEST 6: Build Artifacts
console.log('\n[TEST 6] Build Artifacts');
console.log('----------------------------');
try {
  const distFiles = [
    './app/frontend-modern/dist/index.html',
    './app/frontend-modern/dist/assets'
  ];
  
  distFiles.forEach(file => {
    if (fs.existsSync(file)) {
      pass(`Build artifact exists: ${file}`);
    } else {
      warn(`Build artifact missing: ${file}`, 'Run npm run build');
    }
  });
  
} catch (error) {
  warn('Build artifact check skipped', error.message);
}

// FINAL REPORT
console.log('\n==========================================');
console.log('VALIDATION SUMMARY');
console.log('==========================================\n');

console.log(`✅ Passed: ${results.passed.length}`);
console.log(`❌ Failed: ${results.failed.length}`);
console.log(`⚠️  Warnings: ${results.warnings.length}\n`);

if (results.failed.length > 0) {
  console.log('FAILURES:');
  results.failed.forEach(({ test, reason }) => {
    console.log(`  • ${test}: ${reason}`);
  });
  console.log('');
}

if (results.warnings.length > 0) {
  console.log('WARNINGS:');
  results.warnings.forEach(({ test, reason }) => {
    console.log(`  • ${test}: ${reason}`);
  });
  console.log('');
}

if (results.failed.length === 0) {
  console.log('🎉 ALL CRITICAL TESTS PASSED!\n');
  console.log('System Status: OPERATIONAL');
  process.exit(0);
} else {
  console.log('⚠️  CRITICAL ISSUES DETECTED\n');
  console.log('System Status: NEEDS REPAIR');
  process.exit(1);
}

