/**
 * Rally Forge Manifest Analyzer
 * Performs cross-reference analysis and creates annotated manifest
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find the most recent manifest
function findLatestManifest() {
  const auditDir = path.join(process.cwd(), 'audit');
  if (!fs.existsSync(auditDir)) return null;
  
  const files = fs.readdirSync(auditDir)
    .filter(f => f.startsWith('repository-manifest-') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  return files.length > 0 ? path.join(auditDir, files[0]) : null;
}

function loadManifest(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

function scanImportsInFile(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    
    // Only scan source files
    if (!['.js', '.jsx', '.ts', '.tsx', '.json'].includes(ext)) {
      return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const imports = [];
    
    // Match: import X from 'path' or require('path')
    const importRegex = /(?:import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]|require\s*\(\s*['"`]([^'"`]+)['"`]\s*\))/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1] || match[2];
      // Only track local imports (ignore node_modules, built-ins)
      if (!importPath.startsWith('.') && !importPath.includes('node_modules')) {
        imports.push(importPath);
      }
    }
    
    return imports;
  } catch (e) {
    return [];
  }
}

console.log('🔍 Analyzing repository manifest...');

const manifestPath = findLatestManifest();
if (!manifestPath) {
  console.error('❌ No manifest found');
  process.exit(1);
}

console.log(`📂 Loading manifest: ${path.basename(manifestPath)}`);
const manifest = loadManifest(manifestPath);

// Analyze file references
const baseDir = process.cwd();
const importMap = {}; // Maps imported paths to files that import them
const fileReferences = {}; // For each file, what other files reference it

console.log('🔗 Scanning file imports (this may take a moment)...');

// Build import map - sample key source files
const sourceFiles = manifest.files.filter(f => 
  ['.js', '.jsx', '.ts', '.tsx'].includes(f.ext) && 
  (f.category === 'frontend' || f.category === 'backend' || f.category === 'scanner' || f.category === 'tests')
).slice(0, 500); // Limit to key source files for performance

let importCount = 0;
sourceFiles.forEach(file => {
  const fullPath = path.join(baseDir, file.path);
  if (fs.existsSync(fullPath)) {
    const imports = scanImportsInFile(fullPath);
    imports.forEach(imp => {
      if (!importMap[imp]) importMap[imp] = [];
      importMap[imp].push(file.path);
    });
    importCount += imports.length;
  }
});

console.log(`✅ Found ${importCount} imports across ${sourceFiles.length} source files`);

// Analyze which files are referenced
const referencedPaths = new Set();
Object.values(importMap).forEach(paths => {
  paths.forEach(p => referencedPaths.add(p));
});

// Create enhanced manifest with reference data
const enhancedManifest = {
  ...manifest,
  analysisTimestamp: new Date().toISOString(),
  analysisStats: {
    sourceFilesAnalyzed: sourceFiles.length,
    totalImportsFound: importCount,
    uniqueImportPaths: Object.keys(importMap).length,
    referencedFiles: referencedPaths.size,
    unreferencedFiles: manifest.files.filter(f => 
      !referencedPaths.has(f.path) && 
      ['.js', '.jsx', '.ts', '.tsx'].includes(f.ext) &&
      f.category !== 'tests' // Tests don't need to be imported
    ).length
  },
  files: manifest.files.map(file => {
    let enhancedStatus = file.status;
    let enhancedNotes = file.notes;
    
    // Check if file is referenced by other files
    const isReferenced = referencedPaths.has(file.path);
    const referencingFiles = Object.entries(importMap)
      .filter(([imp, files]) => imp === file.path || imp === `./${file.path}`)
      .flatMap(([_, files]) => files);
    
    // Detect truly unused or broken files
    if (file.status === 'ACTIVE' && ['.js', '.jsx', '.ts', '.tsx'].includes(file.ext)) {
      if (!isReferenced && file.category !== 'tests' && !file.path.match(/server|app\.jsx?|main|index/i)) {
        enhancedStatus = 'POTENTIALLY_UNUSED';
        enhancedNotes = `Not referenced by other files (${referencingFiles.length} references found)`;
      }
    }
    
    // Check for empty or minimal JS files
    if (file.status === 'PLACEHOLDER' && ['.js', '.jsx', '.ts', '.tsx'].includes(file.ext)) {
      enhancedStatus = 'POTENTIALLY_BROKEN';
      enhancedNotes = `${enhancedNotes} (JS file < 200 bytes, may be invalid)`;
    }
    
    return {
      ...file,
      status: enhancedStatus,
      notes: enhancedNotes,
      references: referencingFiles
    };
  })
};

// Update summary with new statuses
enhancedManifest.summary.byStatus.POTENTIALLY_UNUSED = enhancedManifest.files.filter(f => f.status === 'POTENTIALLY_UNUSED').length;
enhancedManifest.summary.byStatus.POTENTIALLY_BROKEN = enhancedManifest.files.filter(f => f.status === 'POTENTIALLY_BROKEN').length;

// Save enhanced manifest
const timestamp = Math.floor(Date.now() / 1000);
const annotatedPath = path.join(process.cwd(), `audit/repository-manifest-annotated-${timestamp}.json`);
fs.writeFileSync(annotatedPath, JSON.stringify(enhancedManifest, null, 2));

// Create unused files report
const unusedFiles = enhancedManifest.files.filter(f => f.status === 'POTENTIALLY_UNUSED');
const unusedReport = {
  timestamp: new Date().toISOString(),
  totalUnused: unusedFiles.length,
  categories: {},
  files: unusedFiles
};

unusedFiles.forEach(f => {
  if (!unusedReport.categories[f.category]) {
    unusedReport.categories[f.category] = 0;
  }
  unusedReport.categories[f.category]++;
});

const unusedPath = path.join(process.cwd(), `audit/unused-files-${timestamp}.json`);
fs.writeFileSync(unusedPath, JSON.stringify(unusedReport, null, 2));

// Create broken files report
const brokenFiles = enhancedManifest.files.filter(f => f.status === 'POTENTIALLY_BROKEN' || f.status === 'BROKEN');
const brokenReport = {
  timestamp: new Date().toISOString(),
  totalBroken: brokenFiles.length,
  categories: {},
  files: brokenFiles
};

brokenFiles.forEach(f => {
  if (!brokenReport.categories[f.category]) {
    brokenReport.categories[f.category] = 0;
  }
  brokenReport.categories[f.category]++;
});

const brokenPath = path.join(process.cwd(), `audit/broken-files-${timestamp}.json`);
fs.writeFileSync(brokenPath, JSON.stringify(brokenReport, null, 2));

// Print summary
console.log('\n✅ Analysis complete!');
console.log('\n📊 Files by Enhanced Status:');
const statusCounts = {};
enhancedManifest.files.forEach(f => {
  if (!statusCounts[f.status]) statusCounts[f.status] = 0;
  statusCounts[f.status]++;
});
Object.entries(statusCounts).forEach(([status, count]) => {
  if (count > 0) console.log(`   ${status}: ${count}`);
});

console.log('\n📁 Generated Reports:');
console.log(`   Annotated Manifest: ${path.basename(annotatedPath)}`);
console.log(`   Unused Files: ${path.basename(unusedPath)} (${unusedFiles.length} files)`);
console.log(`   Broken Files: ${path.basename(brokenPath)} (${brokenFiles.length} files)`);

console.log('\n💡 Next Steps:');
console.log('   1. Review annotated manifest for detailed file information');
console.log('   2. Inspect unused files to confirm they can be archived');
console.log('   3. Check broken files for syntax errors or missing content');
console.log('   4. Run manifest again after cleanup to update baseline');
