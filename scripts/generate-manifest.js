/**
 * Rally Forge Repository Manifest Generator
 * Scans all source files and creates an authoritative inventory
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  '.rf_backups',
  'dist',
  'build',
  '.next',
  'archives',
  '.rf-diagnostics'
];

const ACTIVE_PATTERNS = {
  frontend: /app\/frontend-modern.*\.(jsx?|tsx?)$/i,
  backend: /backend\/[^/]*\.(js|json)$/i,
  scanner: /Scanner\/.*\.(js|json)$/i,
  knowledge: /knowledge\/.*\.md$/i,
  tests: /tests\/.*\.js$/i,
  config: /(vite|webpack|tsconfig|package|eslint|prettier|postcss)\..*$/i
};

function isActiveFile(relPath) {
  for (const [key, pattern] of Object.entries(ACTIVE_PATTERNS)) {
    if (pattern.test(relPath)) return key;
  }
  return null;
}

function scanDirectory(dirPath, baseDir = '.') {
  let files = [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (EXCLUDE_DIRS.includes(entry.name)) continue;
      
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      
      if (entry.isDirectory()) {
        files = files.concat(scanDirectory(fullPath, baseDir));
      } else {
        try {
          const stat = fs.statSync(fullPath);
          const category = isActiveFile(relPath) || 'other';
          const size = stat.size;
          
          // Basic classification
          let status = 'ACTIVE';
          let notes = '';
          
          if (size === 0) {
            status = 'PLACEHOLDER';
            notes = 'Empty file';
          } else if (size < 200) {
            status = 'PLACEHOLDER';
            notes = 'Very small file, likely template';
          } else if (relPath.includes('OLD') || relPath.includes('DEPRECATED')) {
            status = 'OUTDATED';
            notes = 'Path suggests deprecated content';
          } else if (relPath.match(/\.(bak|tmp|temp|old)$/i)) {
            status = 'UNUSED';
            notes = 'Backup/temp file';
          }
          
          files.push({
            path: relPath,
            name: entry.name,
            size: size,
            modified: stat.mtime.toISOString(),
            ext: path.extname(entry.name),
            category: category,
            status: status,
            notes: notes
          });
        } catch (e) {
          // Skip files that can't be read
        }
      }
    }
  } catch (e) {
    console.error('Error scanning ' + dirPath + ': ' + e.message);
  }
  
  return files;
}

console.log('🔍 Generating repository manifest...');
const baseDir = process.cwd();
const files = scanDirectory(baseDir, baseDir);

const manifest = {
  version: '1.0',
  generatedAt: new Date().toISOString(),
  rootPath: baseDir,
  totalFiles: files.length,
  summary: {
    byStatus: {
      ACTIVE: files.filter(f => f.status === 'ACTIVE').length,
      UNUSED: files.filter(f => f.status === 'UNUSED').length,
      OUTDATED: files.filter(f => f.status === 'OUTDATED').length,
      BROKEN: files.filter(f => f.status === 'BROKEN').length,
      PLACEHOLDER: files.filter(f => f.status === 'PLACEHOLDER').length,
      NEW: files.filter(f => f.status === 'NEW').length
    },
    byCategory: {}
  },
  files: files
};

// Calculate category summary
['frontend', 'backend', 'scanner', 'knowledge', 'tests', 'config', 'other'].forEach(cat => {
  manifest.summary.byCategory[cat] = files.filter(f => f.category === cat).length;
});

const timestamp = Math.floor(Date.now() / 1000);
const filename = `audit/repository-manifest-${timestamp}.json`;

try {
  fs.writeFileSync(filename, JSON.stringify(manifest, null, 2));
  console.log('\n✅ Manifest created successfully!');
  console.log('📁 File: ' + filename);
  console.log('📊 Total files: ' + manifest.totalFiles);
  console.log('\n📈 Status Summary:');
  Object.entries(manifest.summary.byStatus).forEach(([status, count]) => {
    if (count > 0) console.log(`   ${status}: ${count}`);
  });
  console.log('\n📂 Category Summary:');
  Object.entries(manifest.summary.byCategory).forEach(([cat, count]) => {
    if (count > 0) console.log(`   ${cat}: ${count}`);
  });
} catch (e) {
  console.error('❌ Failed to write manifest: ' + e.message);
  process.exit(1);
}
