#!/usr/bin/env node
/**
 * Rally Forge Development Server
 * Starts both backend (Node.js) and frontend (Vite) without requiring concurrently
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🚀 Starting Rally Forge Development Environment...\n');

// Start Backend Server
const apiProcess = spawn('node', ['backend/server.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

apiProcess.on('error', (err) => {
  console.error('❌ Backend Server Error:', err);
  process.exit(1);
});

// Give backend time to start
setTimeout(() => {
  // Start Frontend Vite Server
  const reactProcess = spawn('npx', ['vite', '--host'], {
    cwd: path.join(__dirname, 'app/frontend-modern'),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  reactProcess.on('error', (err) => {
    console.error('❌ Frontend Server Error:', err);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n⏹️  Shutting down...');
    apiProcess.kill();
    reactProcess.kill();
    process.exit(0);
  });
}, 3000);
