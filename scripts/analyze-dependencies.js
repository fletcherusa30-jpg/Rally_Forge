/**
 * Rally Forge - Full Dependency Graph Generator
 * Creates comprehensive cross-reference map of entire codebase
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXCLUDE_DIRS = ['node_modules', '.git', '.rf_backups', 'dist', 'build', '.next', 'archives', '.rf-diagnostics', '.rf_manifests'];
const SOURCE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.json', '.md'];

// Load latest manifest
function loadLatestManifest() {
  const auditDir = path.join(process.cwd(), 'audit');
  const files = fs.readdirSync(auditDir)
    .filter(f => f.startsWith('repository-manifest-annotated-') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    console.error('❌ No annotated manifest found. Run analyze-manifest.js first.');
    process.exit(1);
  }
  
  return JSON.parse(fs.readFileSync(path.join(auditDir, files[0]), 'utf-8'));
}

// Extract all imports from a file
function extractImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const imports = new Set();
    
    // ES6 imports: import X from 'path'
    const es6ImportRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = es6ImportRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }
    
    // CommonJS requires: require('path')
    const cjsRequireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    while ((match = cjsRequireRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }
    
    // Dynamic imports: import('path')
    const dynamicImportRegex = /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }
    
    return Array.from(imports);
  } catch (e) {
    return [];
  }
}

// Resolve import path to actual file
function resolveImport(fromFile, importPath, baseDir) {
  // Skip node_modules
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;
  }
  
  const fromDir = path.dirname(path.join(baseDir, fromFile));
  let resolved = path.join(fromDir, importPath);
  
  // Try various extensions
  const extensions = ['.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx', '.json'];
  
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fs.existsSync(candidate)) {
      return path.relative(baseDir, candidate).replace(/\\/g, '/');
    }
  }
  
  // Already has extension
  if (fs.existsSync(resolved)) {
    return path.relative(baseDir, resolved).replace(/\\/g, '/');
  }
  
  return null;
}

console.log('🔍 Generating full dependency graph...');

const manifest = loadLatestManifest();
const baseDir = process.cwd();

// Build dependency graph
const dependencyGraph = {};
const reverseDependencies = {}; // Who imports this file
const unresolvedImports = [];

console.log(`📊 Analyzing ${manifest.files.length} files...`);

let processed = 0;
const sourceFiles = manifest.files.filter(f => SOURCE_EXTENSIONS.includes(f.ext));

for (const file of sourceFiles) {
  const filePath = path.join(baseDir, file.path);
  
  if (!fs.existsSync(filePath)) continue;
  
  const imports = extractImports(filePath);
  const resolvedImports = [];
  
  for (const imp of imports) {
    const resolved = resolveImport(file.path, imp, baseDir);
    if (resolved) {
      resolvedImports.push({ raw: imp, resolved });
      
      // Track reverse dependencies
      if (!reverseDependencies[resolved]) {
        reverseDependencies[resolved] = [];
      }
      reverseDependencies[resolved].push(file.path);
    } else if (imp.startsWith('.') || imp.startsWith('/')) {
      // Local import that couldn't be resolved
      unresolvedImports.push({ from: file.path, import: imp });
    }
  }
  
  dependencyGraph[file.path] = {
    imports: resolvedImports,
    importCount: resolvedImports.length,
    size: file.size,
    category: file.category,
    status: file.status
  };
  
  processed++;
  if (processed % 500 === 0) {
    console.log(`   Processed ${processed}/${sourceFiles.length}...`);
  }
}

console.log(`✅ Analyzed ${processed} source files`);

// Identify orphaned files (not imported by anything)
const orphanedFiles = sourceFiles
  .filter(f => !reverseDependencies[f.path])
  .filter(f => !f.path.match(/server|app|main|index|config|test|spec|README/i))
  .filter(f => f.category !== 'tests' && f.category !== 'config')
  .map(f => ({
    path: f.path,
    size: f.size,
    category: f.category,
    status: f.status
  }));

// Identify circular dependencies
const circularDeps = [];
for (const [file, data] of Object.entries(dependencyGraph)) {
  for (const imp of data.imports) {
    const targetImports = dependencyGraph[imp.resolved]?.imports || [];
    const hasCircular = targetImports.some(ti => ti.resolved === file);
    if (hasCircular) {
      circularDeps.push({ file1: file, file2: imp.resolved });
    }
  }
}

// Identify files with most dependencies (coupling)
const highCoupling = Object.entries(dependencyGraph)
  .filter(([_, data]) => data.importCount > 10)
  .sort((a, b) => b[1].importCount - a[1].importCount)
  .slice(0, 20)
  .map(([file, data]) => ({
    file,
    imports: data.importCount,
    category: data.category
  }));

// Identify files imported by many others (critical dependencies)
const criticalDeps = Object.entries(reverseDependencies)
  .filter(([_, importers]) => importers.length > 5)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 20)
  .map(([file, importers]) => ({
    file,
    importedBy: importers.length,
    category: manifest.files.find(f => f.path === file)?.category || 'unknown'
  }));

// Generate report
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    totalFiles: manifest.totalFiles,
    sourceFilesAnalyzed: processed,
    totalDependencies: Object.values(dependencyGraph).reduce((sum, d) => sum + d.importCount, 0),
    orphanedFiles: orphanedFiles.length,
    circularDependencies: circularDeps.length,
    unresolvedImports: unresolvedImports.length
  },
  orphanedFiles,
  circularDependencies: circularDeps.slice(0, 50), // Top 50
  unresolvedImports: unresolvedImports.slice(0, 100), // Top 100
  highCouplingFiles: highCoupling,
  criticalDependencies: criticalDeps,
  dependencyGraph: Object.fromEntries(
    Object.entries(dependencyGraph).slice(0, 1000) // Save top 1000 for size management
  ),
  reverseDependencies: Object.fromEntries(
    Object.entries(reverseDependencies).slice(0, 1000)
  )
};

const timestamp = Math.floor(Date.now() / 1000);
const outputPath = path.join(process.cwd(), `audit/dependency-graph-${timestamp}.json`);
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

console.log('\n📊 Dependency Analysis Summary:');
console.log(`   Total Dependencies: ${report.summary.totalDependencies}`);
console.log(`   Orphaned Files: ${report.summary.orphanedFiles}`);
console.log(`   Circular Dependencies: ${report.summary.circularDependencies}`);
console.log(`   Unresolved Imports: ${report.summary.unresolvedImports}`);
console.log(`   High Coupling Files (>10 imports): ${highCoupling.length}`);
console.log(`   Critical Dependencies (>5 importers): ${criticalDeps.length}`);

if (orphanedFiles.length > 0) {
  console.log('\n🚨 Top 10 Orphaned Files:');
  orphanedFiles.slice(0, 10).forEach(f => {
    console.log(`   - ${f.path} (${f.size} bytes, ${f.category})`);
  });
}

if (circularDeps.length > 0) {
  console.log('\n🔄 Circular Dependencies Found:');
  circularDeps.slice(0, 5).forEach(c => {
    console.log(`   - ${c.file1} ↔ ${c.file2}`);
  });
}

console.log(`\n✅ Report saved: ${path.basename(outputPath)}`);
