/**
 * Knowledge API Test Suite
 * 
 * Validates all endpoints of the knowledge integration service
 * Run with: node tooling/scripts/knowledge-api-test.mjs
 */

import { createApp } from '../../backend/app.js';

const PORT = 0; // Use ephemeral port

async function requestJson(url, options = {}) {
  const timeout = options.timeout ?? 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    const data = await response.json();
    return { status: response.status, data };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Knowledge API Test Suite');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Start ephemeral backend
  const app = createApp();
  const server = app.listen(PORT, async () => {
    const addr = server.address();
    const baseUrl = `http://127.0.0.1:${addr.port}/api/knowledge`;
    
    const tests = [
      // Health & Status
      { name: 'GET /status', url: `${baseUrl}/status`, method: 'GET' },
      { name: 'POST /init', url: `${baseUrl}/init`, method: 'POST' },
      { name: 'POST /validate', url: `${baseUrl}/validate`, method: 'POST' },
      
      // Unified Search
      { name: 'GET /search?q=PTSD', url: `${baseUrl}/search?q=PTSD`, method: 'GET' },
      { name: 'GET /condition/arthritis', url: `${baseUrl}/condition/arthritis`, method: 'GET' },
      
      // Part 3
      { name: 'GET /part3/3.502', url: `${baseUrl}/part3/3.502`, method: 'GET' },
      { name: 'GET /part3/search?q=dependent', url: `${baseUrl}/part3/search?q=dependent`, method: 'GET' },
      { name: 'GET /part3/topic/dependents', url: `${baseUrl}/part3/topic/dependents`, method: 'GET' },
      
      // Part 4
      { name: 'GET /diagnostic-code/9100', url: `${baseUrl}/diagnostic-code/9100`, method: 'GET' },
      { name: 'GET /part4/body-system/mental', url: `${baseUrl}/part4/body-system/mental`, method: 'GET' },
      
      // Cases
      { name: 'GET /cases', url: `${baseUrl}/cases`, method: 'GET' },
      { name: 'GET /cases/timeline', url: `${baseUrl}/cases/timeline`, method: 'GET' },
      { name: 'GET /cases/year/2017', url: `${baseUrl}/cases/year/2017`, method: 'GET' },
      
      // Knowledge Nodes
      { name: 'GET /library/status', url: `${baseUrl}/library/status`, method: 'GET' },
      { name: 'GET /library/integrity', url: `${baseUrl}/library/integrity`, method: 'GET' },
      { name: 'GET /nodes?domain=service_connection', url: `${baseUrl}/nodes?domain=service_connection`, method: 'GET' },
    ];
    
    let passed = 0;
    let failed = 0;
    const results = [];
    
    console.log('Running tests...\n');
    
    for (const test of tests) {
      try {
        const options = { method: test.method };
        if (test.body) {
          options.body = JSON.stringify(test.body);
        }
        
        const { status, data } = await requestJson(test.url, options);
        
        // Contract tests: all listed routes should succeed with 2xx.
        const isValid = status >= 200 && status < 300;
        
        if (isValid) {
          passed++;
          results.push(`✓ ${test.name} [${status}]`);
        } else {
          failed++;
          results.push(`✗ ${test.name} [${status}]`);
        }
      } catch (error) {
        failed++;
        results.push(`✗ ${test.name} [ERROR: ${error.message}]`);
      }
    }
    
    results.forEach(r => console.log(`  ${r}`));
    
    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`  Test Results`);
    console.log(`═══════════════════════════════════════════════════════════════`);
    console.log(`  Passed: ${passed}/${tests.length}`);
    console.log(`  Failed: ${failed}/${tests.length}`);
    console.log(`  Status: ${failed === 0 ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
    console.log(`═══════════════════════════════════════════════════════════════\n`);
    
    server.close(() => {
      process.exit(failed === 0 ? 0 : 1);
    });
  });
  
  server.on('error', (error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}

runTests();
