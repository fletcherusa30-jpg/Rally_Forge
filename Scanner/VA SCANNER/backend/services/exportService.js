/**
 * Scan Results Export Service
 * Exports scanner results to various formats (JSON, CSV, PDF report, Text)
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Export scan results to JSON file
 */
export async function exportToJSON(scanResults, outputPath) {
  const jsonContent = JSON.stringify(scanResults, null, 2);
  await fs.writeFile(outputPath, jsonContent, 'utf-8');
  return {
    format: 'json',
    path: outputPath,
    size: jsonContent.length
  };
}

/**
 * Export scan results to CSV file
 */
export async function exportToCSV(scanResults, outputPath) {
  const lines = [];
  
  // Header
  lines.push('Category,Item,Value,Details,Effective Date');
  
  // Metadata
  if (scanResults.metadata) {
    const m = scanResults.metadata;
    lines.push(`Metadata,Veteran Name,${csvEscape(m.veteranName || '')},,,`);
    lines.push(`Metadata,File Number,${csvEscape(m.fileNumber || '')},,,`);
    lines.push(`Metadata,Decision Date,${csvEscape(m.decisionDate || '')},,,`);
    lines.push(`Metadata,Combined Rating,${m.combinedRating || ''}%,,,`);
  }
  
  // Service-Connected Conditions
  const scConditions = scanResults.serviceConnected?.conditions || scanResults.serviceConnected || [];
  scConditions.forEach(cond => {
    lines.push(`Service-Connected,${csvEscape(cond.condition)},${cond.percentage}%,,${csvEscape(cond.effectiveDate || 'N/A')}`);
  });
  
  // Denied Conditions
  const deniedConditions = scanResults.denied?.conditions || scanResults.denied || [];
  deniedConditions.forEach(cond => {
    lines.push(`Denied,${csvEscape(cond.condition)},,${csvEscape(cond.reason || '')},`);
  });
  
  // Ancillary Benefits
  const benefits = scanResults.ancillaryBenefits || [];
  benefits.forEach(benefit => {
    lines.push(`Ancillary Benefit,${csvEscape(benefit.benefit || benefit.shortName)},${benefit.status || ''},${csvEscape(benefit.category || '')},`);
  });
  
  // SMC
  const smcExplicit = scanResults.smc?.explicit || [];
  smcExplicit.forEach(smc => {
    lines.push(`SMC,${csvEscape(smc.type || smc.level)},,${csvEscape(smc.description || '')},`);
  });
  
  // Dependents Added
  const dependentsAdded = scanResults.dependents?.added || [];
  dependentsAdded.forEach(dep => {
    lines.push(`Dependent (Added),${csvEscape(dep.name)},${csvEscape(dep.relationship || dep.type || '')},,${csvEscape(dep.effectiveDate || dep.dateString || 'N/A')}`);
  });
  
  // Dependents Removed
  const dependentsRemoved = scanResults.dependents?.removed || [];
  dependentsRemoved.forEach(dep => {
    lines.push(`Dependent (Removed),${csvEscape(dep.name)},${csvEscape(dep.relationship || dep.type || '')},${csvEscape(dep.reason || '')},${csvEscape(dep.effectiveDate || dep.dateString || 'N/A')}`);
  });
  
  // Payments
  const payments = scanResults.payments || [];
  payments.forEach(payment => {
    const type = payment.type || 'Payment';
    const amount = payment.monthlyAmount || payment.totalAmount || 0;
    lines.push(`Payment,${type},$${amount.toFixed(2)},,${csvEscape(payment.effectiveDate || 'N/A')}`);
  });
  
  // Evidence
  const evidence = scanResults.evidence || [];
  evidence.forEach(item => {
    lines.push(`Evidence,${csvEscape(item.type || 'Other')},,${csvEscape((item.description || '').substring(0, 100))},${csvEscape(item.date || '')}`);
  });
  
  const csvContent = lines.join('\n');
  await fs.writeFile(outputPath, csvContent, 'utf-8');
  
  return {
    format: 'csv',
    path: outputPath,
    size: csvContent.length,
    rows: lines.length
  };
}

/**
 * Export scan results to formatted text report
 */
export async function exportToTextReport(scanResults, outputPath) {
  const lines = [];
  const hr = '='.repeat(80);
  
  // Header
  lines.push(hr);
  lines.push('VA DECISION LETTER - SCAN RESULTS REPORT');
  lines.push(hr);
  lines.push('');
  
  // Metadata
  if (scanResults.metadata) {
    const m = scanResults.metadata;
    lines.push('VETERAN INFORMATION');
    lines.push('-'.repeat(80));
    lines.push(`Name:           ${m.veteranName || 'Not found'}`);
    lines.push(`File Number:    ${m.fileNumber || 'Not found'}`);
    lines.push(`Decision Date:  ${m.decisionDate || 'Not found'}`);
    lines.push(`Combined Rating: ${m.combinedRating || 'N/A'}%`);
    lines.push('');
  }
  
  // Service-Connected Conditions
  const scConditions = scanResults.serviceConnected?.conditions || scanResults.serviceConnected || [];
  if (scConditions.length > 0) {
    lines.push('SERVICE-CONNECTED CONDITIONS (' + scConditions.length + ')');
    lines.push('-'.repeat(80));
    scConditions.forEach((cond, i) => {
      lines.push(`${i + 1}. ${cond.condition}`);
      lines.push(`   Rating: ${cond.percentage || 0}%`);
      lines.push(`   Effective Date: ${cond.effectiveDate || 'N/A'}`);
      if (cond.laterality) lines.push(`   Laterality: ${cond.laterality}`);
      lines.push('');
    });
  }
  
  // Denied Conditions
  const deniedConditions = scanResults.denied?.conditions || scanResults.denied || [];
  if (deniedConditions.length > 0) {
    lines.push('DENIED CONDITIONS (' + deniedConditions.length + ')');
    lines.push('-'.repeat(80));
    deniedConditions.forEach((cond, i) => {
      lines.push(`${i + 1}. ${cond.condition}`);
      if (cond.reason) {
        lines.push(`   Reason: ${cond.reason}`);
      }
      lines.push('');
    });
  }
  
  // Ancillary Benefits
  const benefits = scanResults.ancillaryBenefits || [];
  if (benefits.length > 0) {
    lines.push('ANCILLARY BENEFITS (' + benefits.length + ')');
    lines.push('-'.repeat(80));
    benefits.forEach((benefit, i) => {
      lines.push(`${i + 1}. ${benefit.benefit || benefit.shortName}`);
      lines.push(`   Status: ${benefit.status || 'Unknown'}`);
      if (benefit.category) lines.push(`   Category: ${benefit.category}`);
      lines.push('');
    });
  }
  
  // SMC
  const smcExplicit = scanResults.smc?.explicit || [];
  if (smcExplicit.length > 0) {
    lines.push('SPECIAL MONTHLY COMPENSATION (' + smcExplicit.length + ')');
    lines.push('-'.repeat(80));
    smcExplicit.forEach((smc, i) => {
      lines.push(`${i + 1}. ${smc.type || smc.level}`);
      if (smc.description) lines.push(`   ${smc.description}`);
      lines.push('');
    });
  }
  
  // Dependents
  const dependentsAdded = scanResults.dependents?.added || [];
  const dependentsRemoved = scanResults.dependents?.removed || [];
  if (dependentsAdded.length > 0 || dependentsRemoved.length > 0) {
    lines.push('DEPENDENTS');
    lines.push('-'.repeat(80));
    
    if (dependentsAdded.length > 0) {
      lines.push(`Added (${dependentsAdded.length}):`);
      dependentsAdded.forEach((dep, i) => {
        lines.push(`  ${i + 1}. ${dep.name} (${dep.relationship || dep.type || 'Unknown'})`);
        lines.push(`     Effective: ${dep.effectiveDate || dep.dateString || 'N/A'}`);
      });
      lines.push('');
    }
    
    if (dependentsRemoved.length > 0) {
      lines.push(`Removed (${dependentsRemoved.length}):`);
      dependentsRemoved.forEach((dep, i) => {
        lines.push(`  ${i + 1}. ${dep.name} (${dep.relationship || dep.type || 'Unknown'})`);
        if (dep.reason) lines.push(`     Reason: ${dep.reason}`);
        lines.push(`     Effective: ${dep.effectiveDate || dep.dateString || 'N/A'}`);
      });
      lines.push('');
    }
  }
  
  // Payments
  const paymentSummary = scanResults.paymentSummary || scanResults.payments?.summary;
  if (paymentSummary) {
    lines.push('PAYMENT INFORMATION');
    lines.push('-'.repeat(80));
    if (paymentSummary.monthlyEntitlement) {
      lines.push(`Monthly Entitlement: $${paymentSummary.monthlyEntitlement.toFixed(2)}`);
    }
    if (paymentSummary.amountWithheld) {
      lines.push(`Amount Withheld:     $${paymentSummary.amountWithheld.toFixed(2)}`);
    }
    if (paymentSummary.netAmountPaid) {
      lines.push(`Net Amount Paid:     $${paymentSummary.netAmountPaid.toFixed(2)}`);
    }
    if (paymentSummary.backPayAmount) {
      lines.push(`Back Pay:            $${paymentSummary.backPayAmount.toFixed(2)}`);
    }
    lines.push('');
  }
  
  // Evidence Summary
  const evidence = scanResults.evidence || [];
  const evidenceByType = scanResults.evidenceByType || {};
  if (evidence.length > 0) {
    lines.push(`EVIDENCE (${evidence.length} items)`);
    lines.push('-'.repeat(80));
    
    if (Object.keys(evidenceByType).length > 0) {
      lines.push('By Type:');
      Object.entries(evidenceByType).forEach(([type, items]) => {
        lines.push(`  ${type}: ${Array.isArray(items) ? items.length : items} items`);
      });
    } else {
      lines.push(`Total: ${evidence.length} items`);
    }
    lines.push('');
  }
  
  // AI Validation (if present)
  if (scanResults.aiValidation) {
    lines.push('AI VALIDATION');
    lines.push('-'.repeat(80));
    lines.push(`Enhanced: ${scanResults.aiValidation.enhanced ? 'Yes' : 'No'}`);
    if (scanResults.aiValidation.confidence !== null) {
      lines.push(`Confidence: ${Math.round(scanResults.aiValidation.confidence * 100)}%`);
    }
    if (scanResults.aiValidation.suggestions && scanResults.aiValidation.suggestions.length > 0) {
      lines.push(`Suggestions: ${scanResults.aiValidation.suggestions.length}`);
      scanResults.aiValidation.suggestions.forEach((sug, i) => {
        lines.push(`  ${i + 1}. ${sug.suggestion || sug.issue}`);
      });
    }
    lines.push('');
  }
  
  // Footer
  lines.push(hr);
  lines.push(`Report Generated: ${new Date().toLocaleString()}`);
  lines.push(`Source: ${scanResults.source || 'BenefitScan Engine'}`);
  lines.push(hr);
  
  const textContent = lines.join('\n');
  await fs.writeFile(outputPath, textContent, 'utf-8');
  
  return {
    format: 'text',
    path: outputPath,
    size: textContent.length,
    lines: lines.length
  };
}

/**
 * Export scan results in multiple formats
 */
export async function exportResults(scanResults, baseFileName, formats = ['json', 'csv', 'txt']) {
  const exportDir = path.join(process.cwd(), 'exports');
  
  // Create exports directory if doesn't exist
  try {
    await fs.mkdir(exportDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  const results = [];
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const safeName = baseFileName.replace(/[^a-zA-Z0-9-_]/g, '_');
  
  for (const format of formats) {
    const fileName = `${safeName}_${timestamp}.${format}`;
    const outputPath = path.join(exportDir, fileName);
    
    try {
      let result;
      
      switch (format.toLowerCase()) {
        case 'json':
          result = await exportToJSON(scanResults, outputPath);
          break;
          
        case 'csv':
          result = await exportToCSV(scanResults, outputPath);
          break;
          
        case 'txt':
        case 'text':
          result = await exportToTextReport(scanResults, outputPath);
          break;
          
        default:
          console.warn(`Unknown export format: ${format}`);
          continue;
      }
      
      results.push(result);
      console.log(`✓ Exported ${format.toUpperCase()}: ${outputPath}`);
      
    } catch (error) {
      console.error(`✗ Failed to export ${format.toUpperCase()}:`, error.message);
      results.push({
        format,
        error: error.message,
        path: outputPath
      });
    }
  }
  
  return {
    exportDir,
    files: results,
    timestamp
  };
}

/**
 * Helper: Escape CSV values
 */
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Get export formats display info
 */
export function getExportFormats() {
  return [
    {
      format: 'json',
      name: 'JSON',
      description: 'Complete data in JSON format',
      extension: '.json',
      mimeType: 'application/json'
    },
    {
      format: 'csv',
      name: 'CSV',
      description: 'Spreadsheet-compatible CSV file',
      extension: '.csv',
      mimeType: 'text/csv'
    },
    {
      format: 'txt',
      name: 'Text Report',
      description: 'Human-readable formatted report',
      extension: '.txt',
      mimeType: 'text/plain'
    }
  ];
}

