/**
 * Scan History Service
 * Tracks all scanner operations for audit trail and analytics
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HISTORY_DIR = path.join(__dirname, '../data/scan-history');
const HISTORY_FILE = path.join(HISTORY_DIR, 'scan_history.json');
const MAX_HISTORY_ENTRIES = 1000; // Keep last 1000 scans

/**
 * Initialize history directory and file
 */
async function initializeHistory() {
  try {
    await fs.mkdir(HISTORY_DIR, { recursive: true });
    
    // Check if history file exists
    try {
      await fs.access(HISTORY_FILE);
    } catch {
      // Create empty history file
      await fs.writeFile(HISTORY_FILE, JSON.stringify({ scans: [] }, null, 2));
    }
  } catch (error) {
    console.error('[History] Failed to initialize:', error.message);
  }
}

/**
 * Load scan history
 */
async function loadHistory() {
  try {
    const content = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('[History] Failed to load:', error.message);
    return { scans: [] };
  }
}

/**
 * Save scan history
 */
async function saveHistory(history) {
  try {
    // Keep only last MAX_HISTORY_ENTRIES
    if (history.scans.length > MAX_HISTORY_ENTRIES) {
      history.scans = history.scans.slice(-MAX_HISTORY_ENTRIES);
    }
    
    await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
    return true;
  } catch (error) {
    console.error('[History] Failed to save:', error.message);
    return false;
  }
}

/**
 * Record a scan operation
 */
export async function recordScan(scanData, results) {
  await initializeHistory();
  
  const history = await loadHistory();
  
  const scanRecord = {
    id: generateScanId(),
    timestamp: new Date().toISOString(),
    veteranName: results.metadata?.veteranName || 'Unknown',
    fileNumber: results.metadata?.fileNumber || 'Unknown',
    decisionDate: results.metadata?.decisionDate || null,
    
    // Summary stats
    stats: {
      serviceConnected: results.serviceConnected?.length || results.serviceConnected?.conditions?.length || 0,
      denied: results.denied?.length || results.denied?.conditions?.length || 0,
      ancillaryBenefits: results.ancillaryBenefits?.length || 0,
      smc: results.smc?.explicit?.length || 0,
      dependents: (results.dependents?.added?.length || 0) + (results.dependents?.removed?.length || 0),
      payments: results.payments?.length || results.payments?.allPayments?.length || 0,
      evidence: results.evidence?.length || results.evidence?.items?.length || 0,
      totalItems: 0
    },
    
    // AI validation info
    aiValidation: results.aiValidation ? {
      enhanced: results.aiValidation.enhanced,
      confidence: results.aiValidation.confidence,
      suggestionsCount: results.aiValidation.suggestions?.length || 0,
      model: results.aiValidation.model || null
    } : null,
    
    // Execution metrics
    metrics: {
      textLength: scanData?.length || 0,
      executionTime: results.extractionSummary?.executionTime || null,
      source: results.source || 'unknown'
    }
  };
  
  // Calculate total items
  scanRecord.stats.totalItems = Object.values(scanRecord.stats).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
  
  history.scans.push(scanRecord);
  
  await saveHistory(history);
  
  console.log(`[History] Recorded scan ${scanRecord.id} - ${scanRecord.stats.totalItems} items`);
  
  return scanRecord;
}

/**
 * Get scan history
 */
export async function getScanHistory(options = {}) {
  await initializeHistory();
  
  const history = await loadHistory();
  let scans = history.scans || [];
  
  // Filter by veteran name
  if (options.veteranName) {
    const searchTerm = options.veteranName.toLowerCase();
    scans = scans.filter(scan => 
      scan.veteranName?.toLowerCase().includes(searchTerm)
    );
  }
  
  // Filter by file number
  if (options.fileNumber) {
    scans = scans.filter(scan => 
      scan.fileNumber === options.fileNumber
    );
  }
  
  // Filter by date range
  if (options.startDate) {
    const start = new Date(options.startDate);
    scans = scans.filter(scan => new Date(scan.timestamp) >= start);
  }
  
  if (options.endDate) {
    const end = new Date(options.endDate);
    scans = scans.filter(scan => new Date(scan.timestamp) <= end);
  }
  
  // Sort by timestamp (newest first)
  scans.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Limit results
  const limit = options.limit || 100;
  scans = scans.slice(0, limit);
  
  return {
    scans,
    total: history.scans.length,
    filtered: scans.length
  };
}

/**
 * Get scan by ID
 */
export async function getScanById(scanId) {
  await initializeHistory();
  
  const history = await loadHistory();
  return history.scans.find(scan => scan.id === scanId) || null;
}

/**
 * Get scan statistics
 */
export async function getScanStatistics() {
  await initializeHistory();
  
  const history = await loadHistory();
  const scans = history.scans || [];
  
  if (scans.length === 0) {
    return {
      totalScans: 0,
      dateRange: null,
      averageItems: 0,
      aiUsageRate: 0,
      byMonth: {},
      topConditions: []
    };
  }
  
  // Calculate statistics
  const stats = {
    totalScans: scans.length,
    dateRange: {
      earliest: scans[0]?.timestamp,
      latest: scans[scans.length - 1]?.timestamp
    },
    averageItems: 0,
    aiUsageRate: 0,
    totalItems: 0,
    aiEnhancedCount: 0,
    byMonth: {},
    categoryAverages: {
      serviceConnected: 0,
      denied: 0,
      ancillaryBenefits: 0,
      smc: 0,
      dependents: 0,
      payments: 0,
      evidence: 0
    }
  };
  
  // Process each scan
  scans.forEach(scan => {
    stats.totalItems += scan.stats.totalItems || 0;
    
    if (scan.aiValidation?.enhanced) {
      stats.aiEnhancedCount++;
    }
    
    // Count by month
    const month = scan.timestamp.substring(0, 7); // YYYY-MM
    stats.byMonth[month] = (stats.byMonth[month] || 0) + 1;
    
    // Sum category stats
    Object.keys(stats.categoryAverages).forEach(key => {
      stats.categoryAverages[key] += scan.stats[key] || 0;
    });
  });
  
  // Calculate averages
  stats.averageItems = Math.round(stats.totalItems / scans.length);
  stats.aiUsageRate = Math.round((stats.aiEnhancedCount / scans.length) * 100);
  
  Object.keys(stats.categoryAverages).forEach(key => {
    stats.categoryAverages[key] = Math.round(stats.categoryAverages[key] / scans.length);
  });
  
  return stats;
}

/**
 * Clear scan history (admin function)
 */
export async function clearHistory() {
  await initializeHistory();
  
  const emptyHistory = { scans: [] };
  await saveHistory(emptyHistory);
  
  console.log('[History] Cleared all scan history');
  
  return { success: true, message: 'History cleared' };
}

/**
 * Export scan history to file
 */
export async function exportHistory(format = 'json') {
  await initializeHistory();
  
  const history = await loadHistory();
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const fileName = `scan_history_export_${timestamp}.${format}`;
  const outputPath = path.join(HISTORY_DIR, fileName);
  
  if (format === 'json') {
    await fs.writeFile(outputPath, JSON.stringify(history, null, 2));
  } else if (format === 'csv') {
    const lines = ['ID,Timestamp,Veteran,File Number,Total Items,AI Enhanced,Service-Connected,Denied,Evidence'];
    
    history.scans.forEach(scan => {
      lines.push([
        scan.id,
        scan.timestamp,
        scan.veteranName || '',
        scan.fileNumber || '',
        scan.stats.totalItems || 0,
        scan.aiValidation?.enhanced ? 'Yes' : 'No',
        scan.stats.serviceConnected || 0,
        scan.stats.denied || 0,
        scan.stats.evidence || 0
      ].join(','));
    });
    
    await fs.writeFile(outputPath, lines.join('\n'));
  }
  
  return {
    path: outputPath,
    format,
    recordCount: history.scans.length
  };
}

/**
 * Generate unique scan ID
 */
function generateScanId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `scan_${timestamp}_${random}`;
}

// Initialize on module load
initializeHistory().catch(err => {
  console.error('[History] Initialization failed:', err);
});

