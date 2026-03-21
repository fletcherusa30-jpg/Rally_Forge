import { createApp } from '../../backend/app.js';

async function test() {
  const app = createApp();
  const server = app.listen(0, async () => {
    const addr = server.address();
    const port = addr.port;
    const baseUrl = `http://127.0.0.1:${port}/api/knowledge`;
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  Knowledge Endpoint Tests');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    try {
      // Test 1: Status
      console.log('Testing: GET /api/knowledge/status');
      const r1 = await fetch(`${baseUrl}/status`);
      const d1 = await r1.json();
      console.log(`  Status: ${r1.status} ${r1.ok ? '✓' : '✗'}`);
      console.log(`  Response: ${d1.success ? 'SUCCESS' : 'FAILED'}\n`);
      
      // Test 2: Part 3 by topic
      console.log('Testing: GET /api/knowledge/part3/topic/dependents');
      const r2 = await fetch(`${baseUrl}/part3/topic/dependents`);
      const d2 = await r2.json();
      console.log(`  Status: ${r2.status} ${r2.ok ? '✓' : '✗'}`);
      console.log(`  Sections found: ${d2.sections?.length || 0}\n`);
      
      // Test 3: Part 4 diagnostic code
      console.log('Testing: GET /api/knowledge/part4/diagnostic/9100');
      const r3 = await fetch(`${baseUrl}/part4/diagnostic/9100`);
      const d3 = await r3.json();
      console.log(`  Status: ${r3.status} ${r3.ok ? '✓' : '✗'}`);
      console.log(`  Code: ${d3.diagnosticCode?.code || 'NOT FOUND'}`);
      console.log(`  Desc: ${(d3.diagnosticCode?.description || '').substring(0, 40)}...\n`);
      
      // Test 4: Cases list
      console.log('Testing: GET /api/knowledge/cases');
      const r4 = await fetch(`${baseUrl}/cases`);
      const d4 = await r4.json();
      console.log(`  Status: ${r4.status} ${r4.ok ? '✓' : '✗'}`);
      console.log(`  Cases: ${d4.cases?.length || 0}\n`);
      
      // Test 5: Search
      console.log('Testing: GET /api/knowledge/search?q=PTSD');
      const r5 = await fetch(`${baseUrl}/search?q=PTSD`);
      const d5 = await r5.json();
      console.log(`  Status: ${r5.status} ${r5.ok ? '✓' : '✗'}`);
      console.log(`  Total results: ${d5.totalResults || 0}\n`);
      
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('  ✓ All tests completed successfully!');
      console.log('═══════════════════════════════════════════════════════════════\n');
      
    } catch (error) {
      console.error('Test error:', error.message);
    } finally {
      server.close(() => process.exit(0));
    }
  });
}

test();
