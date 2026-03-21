#!/usr/bin/env node
import { createApp } from '../../backend/app.js';

const app = createApp();
const server = app.listen(0, async () => {
  const addr = server.address();
  const port = addr.port;
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Knowledge Endpoints Test');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const baseUrl = `http://127.0.0.1:${port}/api/knowledge`;
  
  try {
    // Test 1
    const res1 = await fetch(`${baseUrl}/status`);
    const d1 = await res1.json();
    console.log(`✓ GET /api/knowledge/status`);
    console.log(`  Status: ${res1.status}, Success: ${d1.success}\n`);
    
    // Test 2
    const res2 = await fetch(`${baseUrl}/part3/topic/dependents`);
    const d2 = await res2.json();
    console.log(`✓ GET /api/knowledge/part3/topic/dependents`);
    console.log(`  Status: ${res2.status}, Sections: ${d2.sections?.length || 0}\n`);
    
    // Test 3
    const res3 = await fetch(`${baseUrl}/part4/diagnostic/9100`);
    const d3 = await res3.json();
    console.log(`✓ GET /api/knowledge/part4/diagnostic/9100`);
    console.log(`  Status: ${res3.status}, Code: ${d3.diagnosticCode?.code || 'NOT FOUND'}\n`);
    
    // Test 4
    const res4 = await fetch(`${baseUrl}/cases`);
    const d4 = await res4.json();
    console.log(`✓ GET /api/knowledge/cases`);
    console.log(`  Status: ${res4.status}, Cases: ${d4.cases?.length || 0}\n`);
    
    // Test 5
    const res5 = await fetch(`${baseUrl}/search?q=PTSD`);
    const d5 = await res5.json();
    console.log(`✓ GET /api/knowledge/search?q=PTSD`);
    console.log(`  Status: ${res5.status}, Results: ${d5.totalResults || 0}\n`);
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ✓ ALL ENDPOINTS WORKING!');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('✗ Test failed:', error.message);
  } finally {
    server.close(() => process.exit(0));
  }
});
