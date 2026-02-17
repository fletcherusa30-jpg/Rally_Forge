/**
 * test-denial-reason-extractor.js
 * 
 * Test suite for DenialReasonRegexExtractor module
 * Tests extraction of complete denial reasons from VA decision letters
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractDeniedReasons,
  extractDeniedReasonsWithMetadata,
  validateDenialReason
} from '../../backend/engine/DenialReasonRegexExtractor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test configuration
const testDir = __dirname;  // Use current directory directly
const testFiles = [
  'test_mixed_denials.txt',
  'test_truncated_denials.txt',
  'test_multi_paragraph_denials.txt'
];

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

/**
 * Test that a condition was found
 */
function testConditionFound(testName, conditions, expectedCondition) {
  totalTests++;
  const found = conditions.some(c => 
    c.condition.toLowerCase().includes(expectedCondition.toLowerCase())
  );
  
  if (found) {
    passedTests++;
    testResults.push({
      status: 'PASS',
      test: testName,
      message: `Found condition: ${expectedCondition}`
    });
    return true;
  } else {
    failedTests++;
    testResults.push({
      status: 'FAIL',
      test: testName,
      message: `Did not find condition: ${expectedCondition}. Found: ${conditions.map(c => c.condition).join(', ')}`
    });
    return false;
  }
}

/**
 * Test that a reason is not empty
 */
function testReasonNotEmpty(testName, condition) {
  totalTests++;
  
  if (condition.reason_for_denial && condition.reason_for_denial.length > 0) {
    passedTests++;
    testResults.push({
      status: 'PASS',
      test: testName,
      message: `Reason is not empty (${condition.reason_for_denial.length} chars)`
    });
    return true;
  } else {
    failedTests++;
    testResults.push({
      status: 'FAIL',
      test: testName,
      message: `Reason is empty for condition: ${condition.condition}`
    });
    return false;
  }
}

/**
 * Test that a reason is not truncated
 */
function testReasonNotTruncated(testName, condition) {
  totalTests++;
  
  const reason = condition.reason_for_denial;
  const truncationPatterns = [
    /\sis\s+denied\s+because\s+the$/i,    // ends with "the"
    /\s+is$/i,                             // ends with "is"
    /\s+because$/i,                        // ends with "because"
    /^(and|or|but|that|which|if|when)\s/i // starts with incomplete clause
  ];
  
  let isTruncated = false;
  let reason_for_truncation = '';
  
  for (const pattern of truncationPatterns) {
    if (pattern.test(reason)) {
      isTruncated = true;
      reason_for_truncation = `Matches truncation pattern: ${pattern.source}`;
      break;
    }
  }
  
  if (!isTruncated && reason.match(/[.!?]$/)) {
    passedTests++;
    testResults.push({
      status: 'PASS',
      test: testName,
      message: `Reason is not truncated and ends properly (${reason.length} chars)`
    });
    return true;
  } else {
    failedTests++;
    testResults.push({
      status: 'FAIL',
      test: testName,
      message: `${reason_for_truncation || 'Reason may be truncated'}: "${reason.substring(0, 50)}..."`
    });
    return false;
  }
}

/**
 * Test that reason meets minimum length
 */
function testReasonLength(testName, condition, minLength = 20) {
  totalTests++;
  
  const length = condition.reason_for_denial.length;
  
  if (length >= minLength) {
    passedTests++;
    testResults.push({
      status: 'PASS',
      test: testName,
      message: `Reason length is adequate (${length} chars >= ${minLength})`
    });
    return true;
  } else {
    failedTests++;
    testResults.push({
      status: 'FAIL',
      test: testName,
      message: `Reason is too short (${length} chars < ${minLength})`
    });
    return false;
  }
}

/**
 * Test that no reasons are duplicated
 */
function testNoDuplicateReasons(testName, conditions) {
  totalTests++;
  
  const seen = new Set();
  const duplicates = [];
  
  for (const condition of conditions) {
    if (seen.has(condition.reason_for_denial)) {
      duplicates.push(condition.condition);
    }
    seen.add(condition.reason_for_denial);
  }
  
  if (duplicates.length === 0) {
    passedTests++;
    testResults.push({
      status: 'PASS',
      test: testName,
      message: `No duplicate reasons found`
    });
    return true;
  } else {
    failedTests++;
    testResults.push({
      status: 'FAIL',
      test: testName,
      message: `Found duplicate reasons for: ${duplicates.join(', ')}`
    });
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('='.repeat(70));
  console.log('DENIAL REASON EXTRACTION TEST SUITE');
  console.log('='.repeat(70));
  console.log('');
  
  for (const testFile of testFiles) {
    const filePath = path.join(testDir, testFile);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  SKIP: ${testFile} not found`);
      continue;
    }
    
    console.log(`📄 Testing: ${testFile}`);
    console.log('-'.repeat(70));
    
    try {
      // Read file
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Extract denied reasons
      const conditions = extractDeniedReasons(content);
      
      console.log(`   Found ${conditions.length} denied condition(s)\n`);
      
      if (conditions.length === 0) {
        console.log(`   ⚠️  WARNING: No conditions extracted from ${testFile}`);
        console.log('');
        continue;
      }
      
      // Run tests based on test file
      if (testFile === 'test_mixed_denials.txt') {
        testConditionFound(`${testFile}: Find fatigue`, conditions, 'fatigue');
        testConditionFound(`${testFile}: Find migraines`, conditions, 'migraines');
        
        const fatigueCondition = conditions.find(c => c.condition.toLowerCase().includes('fatigue'));
        if (fatigueCondition) {
          testReasonNotEmpty(`${testFile}: Fatigue reason not empty`, fatigueCondition);
          testReasonNotTruncated(`${testFile}: Fatigue reason not truncated`, fatigueCondition);
          testReasonLength(`${testFile}: Fatigue reason length`, fatigueCondition);
        }
        
        const migrainesCondition = conditions.find(c => c.condition.toLowerCase().includes('migraines'));
        if (migrainesCondition) {
          testReasonNotEmpty(`${testFile}: Migraines reason not empty`, migrainesCondition);
          testReasonNotTruncated(`${testFile}: Migraines reason not truncated`, migrainesCondition);
          testReasonLength(`${testFile}: Migraines reason length`, migrainesCondition);
        }
      } 
      else if (testFile === 'test_truncated_denials.txt') {
        testConditionFound(`${testFile}: Find anxiety`, conditions, 'anxiety');
        testConditionFound(`${testFile}: Find PTSD`, conditions, 'PTSD');
        
        for (const condition of conditions) {
          testReasonNotEmpty(`${testFile}: ${condition.condition} reason not empty`, condition);
          testReasonNotTruncated(`${testFile}: ${condition.condition} reason not truncated`, condition);
          testReasonLength(`${testFile}: ${condition.condition} reason length`, condition);
        }
      } 
      else if (testFile === 'test_multi_paragraph_denials.txt') {
        testConditionFound(`${testFile}: Find erectile dysfunction`, conditions, 'erectile');
        testConditionFound(`${testFile}: Find sinusitis`, conditions, 'sinusitis');
        
        for (const condition of conditions) {
          testReasonNotEmpty(`${testFile}: ${condition.condition} reason not empty`, condition);
          testReasonNotTruncated(`${testFile}: ${condition.condition} reason not truncated`, condition);
          testReasonLength(`${testFile}: ${condition.condition} reason length`, condition);
        }
      }
      
      // General tests for all files
      testNoDuplicateReasons(`${testFile}: No duplicate reasons`, conditions);
      
      // Print extracted conditions
      console.log('   Extracted conditions:');
      for (const condition of conditions) {
        console.log(`   - ${condition.condition}`);
        console.log(`     Reason (${condition.reason_for_denial.length} chars): ${condition.reason_for_denial.substring(0, 60)}...`);
      }
      
    } catch (error) {
      failedTests++;
      totalTests++;
      testResults.push({
        status: 'ERROR',
        test: testFile,
        message: error.message
      });
      console.log(`   ❌ ERROR: ${error.message}`);
    }
    
    console.log('');
  }
  
  // Print summary
  printTestSummary();
}

/**
 * Print test summary
 */
function printTestSummary() {
  console.log('='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  console.log('');
  
  // Group results by status
  const passed = testResults.filter(r => r.status === 'PASS');
  const failed = testResults.filter(r => r.status === 'FAIL');
  const errors = testResults.filter(r => r.status === 'ERROR');
  
  // Print results by status
  console.log(`✅ PASSED: ${passed.length}`);
  for (const result of passed) {
    console.log(`   [${result.test}] ${result.message}`);
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ FAILED: ${failed.length}`);
    for (const result of failed) {
      console.log(`   [${result.test}] ${result.message}`);
    }
  }
  
  if (errors.length > 0) {
    console.log(`\n⚠️  ERRORS: ${errors.length}`);
    for (const result of errors) {
      console.log(`   [${result.test}] ${result.message}`);
    }
  }
  
  // Print overall summary
  console.log('');
  console.log('='.repeat(70));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} (${Math.round(passedTests / totalTests * 100)}%)`);
  console.log(`Failed: ${failedTests} (${Math.round(failedTests / totalTests * 100)}%)`);
  console.log('='.repeat(70));
  
  // Exit with appropriate code
  process.exit(failedTests === 0 && errors.length === 0 ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('Test execution error:', error);
  process.exit(1);
});
