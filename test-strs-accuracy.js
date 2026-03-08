/**
 * STRS Scanner Accuracy Test
 * Tests the enhanced scanner on Fletcher 0772 MEB AHLTA.pdf
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the enhanced STRS engine
import * as strsEngine from './backend/engine/strs/strs-engine.js';

async function testSTRSAccuracy() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('STRS SCANNER ACCURACY TEST - Enhanced v2.0');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const pdfPath = path.join(__dirname, 'Fletcher 0772 20 MEB AHLTA.pdf');
  
  // Check if file exists
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDF file not found:', pdfPath);
    return;
  }
  
  console.log('📄 Scanning: Fletcher 0772 20 MEB AHLTA.pdf');
  console.log('⏳ Extracting text from PDF...\n');
  
  try {
    // Read PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    // Extract text from PDF
    const extractedText = await strsEngine.extractTextFromPdf(pdfBuffer);
    
    console.log(`✓ Text extracted: ${extractedText.length} characters\n`);
    console.log('⏳ Running enhanced STRS scan with accuracy improvements...\n');
    
    // Scan the text
    const scanResult = strsEngine.scanSTRText(extractedText);
    
    // Display results
    console.log('═══════════════════════════════════════════════════════════');
    console.log('SCAN RESULTS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log(`✓ Scan completed: ${scanResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`⏱  Timestamp: ${scanResult.Timestamp}\n`);
    
    // Diagnoses with accuracy enhancements
    console.log('─────────────────────────────────────────────────────────');
    console.log('DIAGNOSES (Medical Conditions & Diseases)');
    console.log('─────────────────────────────────────────────────────────\n');
    
    if (scanResult.Extracted.Diagnoses.length === 0) {
      console.log('  No diagnoses found.\n');
    } else {
      scanResult.Extracted.Diagnoses.forEach((dx, idx) => {
        console.log(`${idx + 1}. ${dx.displayName || dx.label}`);
        if (dx.category) console.log(`   Category: ${dx.category}`);
        if (dx.originalLabel && dx.label !== dx.originalLabel) {
          console.log(`   Original label: ${dx.originalLabel}`);
        }
        if (dx.normalizedKey !== dx.label) {
          console.log(`   Normalized to: ${dx.normalizedKey}`);
        }
        if (dx.icd10) {
          console.log(`   ICD-10: ${dx.icd10}`);
        }
        console.log(`   Occurrences: ${dx.totalOccurrences} total (${dx.followUps} follow-ups)`);
        
        // NEW: Confidence score
        if (dx.confidence) {
          console.log(`   📊 Confidence: ${dx.confidence.score}/100 (${dx.confidence.level.toUpperCase()})`);
          if (dx.confidence.reasons && dx.confidence.reasons.length > 0) {
            console.log(`      Reasons: ${dx.confidence.reasons.join(', ')}`);
          }
        }
        
        // NEW: Laterality
        if (dx.firstOccurrence.laterality && dx.firstOccurrence.laterality.side) {
          console.log(`   🔍 Laterality: ${dx.firstOccurrence.laterality.side.toUpperCase()}`);
          console.log(`      Evidence: "${dx.firstOccurrence.laterality.evidence}"`);
        }
        
        // NEW: Severity
        if (dx.firstOccurrence.severity && dx.firstOccurrence.severity.value) {
          console.log(`   ⚡ Severity: ${dx.firstOccurrence.severity.interpretation || dx.firstOccurrence.severity.value}`);
          console.log(`      Evidence: "${dx.firstOccurrence.severity.evidence}"`);
        }
        
        console.log(`   First mention: "${dx.firstOccurrence.matchedText}"`);
        console.log(`   Context: "${dx.firstOccurrence.context.substring(0, 150)}..."`);
        if (dx.firstOccurrence.page) {
          console.log(`   Page: ${dx.firstOccurrence.page}`);
        }
        console.log('');
      });
    }
    
    // Injuries
    console.log('─────────────────────────────────────────────────────────');
    console.log('INJURIES (Physical Trauma & Acute Injuries)');
    console.log('─────────────────────────────────────────────────────────\n');
    
    if (scanResult.Extracted.Injuries.length === 0) {
      console.log('  No injuries found.\n');
    } else {
      scanResult.Extracted.Injuries.forEach((inj, idx) => {
        console.log(`${idx + 1}. ${inj.displayName || inj.label}`);
        if (inj.category) console.log(`   Category: ${inj.category}`);
        console.log(`   Occurrences: ${inj.totalOccurrences} total (${inj.followUps} follow-ups)`);
        
        if (inj.confidence) {
          console.log(`   📊 Confidence: ${inj.confidence.score}/100 (${inj.confidence.level.toUpperCase()})`);
        }
        
        if (inj.firstOccurrence.laterality && inj.firstOccurrence.laterality.side) {
          console.log(`   🔍 Laterality: ${inj.firstOccurrence.laterality.side.toUpperCase()}`);
        }
        
        if (inj.firstOccurrence.severity && inj.firstOccurrence.severity.value) {
          console.log(`   ⚡ Severity: ${inj.firstOccurrence.severity.interpretation || inj.firstOccurrence.severity.value}`);
        }
        
        console.log(`   First mention: "${inj.firstOccurrence.matchedText}"`);
        console.log(`   Context: "${inj.firstOccurrence.context.substring(0, 150)}..."`);
        if (inj.firstOccurrence.page) {
          console.log(`   Page: ${inj.firstOccurrence.page}`);
        }
        console.log('');
      });
    }
    
    // Events
    console.log('─────────────────────────────────────────────────────────');
    console.log('EVENTS (LOD Events, Incidents & Accidents)');
    console.log('─────────────────────────────────────────────────────────\n');
    
    if (scanResult.Extracted.Events.length === 0) {
      console.log('  No events found.\n');
    } else {
      scanResult.Extracted.Events.forEach((evt, idx) => {
        console.log(`${idx + 1}. ${evt.displayName || evt.label}`);
        if (evt.category) console.log(`   Category: ${evt.category}`);
        console.log(`   Occurrences: ${evt.totalOccurrences} total (${evt.followUps} follow-ups)`);
        
        if (evt.confidence) {
          console.log(`   📊 Confidence: ${evt.confidence.score}/100 (${evt.confidence.level.toUpperCase()})`);
        }
        
        console.log(`   First mention: "${evt.firstOccurrence.matchedText}"`);
        console.log(`   Context: "${evt.firstOccurrence.context.substring(0, 150)}..."`);
        if (evt.firstOccurrence.page) {
          console.log(`   Page: ${evt.firstOccurrence.page}`);
        }
        if (evt.firstOccurrence.dates && evt.firstOccurrence.dates.length > 0) {
          console.log(`   Dates: ${evt.firstOccurrence.dates.join(', ')}`);
        }
        console.log('');
      });
    }
    
    // Medications with cross-reference validation
    console.log('─────────────────────────────────────────────────────────');
    console.log('MEDICATIONS (with cross-reference validation)');
    console.log('─────────────────────────────────────────────────────────\n');
    
    if (scanResult.Extracted.Medications.length === 0) {
      console.log('  No medications found.\n');
    } else {
      scanResult.Extracted.Medications.forEach((med, idx) => {
        console.log(`${idx + 1}. ${med.label}`);
        console.log(`   Matched text: "${med.matchedText}"`);
        
        // NEW: Cross-reference validation
        if (med.validationStatus) {
          console.log(`   ✓ Validation: ${med.validationStatus.toUpperCase()}`);
        }
        if (med.treatsConditions && med.treatsConditions.length > 0) {
          console.log(`   🔗 Treats: ${med.treatsConditions.join(', ')}`);
        }
        if (med.warnings && med.warnings.length > 0) {
          console.log(`   ⚠️  Warnings: ${med.warnings.join('; ')}`);
        }
        console.log('');
      });
    }
    
    // Chronicity analysis
    console.log('─────────────────────────────────────────────────────────');
    console.log('CHRONICITY ANALYSIS');
    console.log('─────────────────────────────────────────────────────────\n');
    
    console.log(`  Has chronic indicators: ${scanResult.Extracted.Chronicity.hasChronicIndicators ? 'YES' : 'NO'}`);
    console.log(`  Chronic conditions detected: ${scanResult.Extracted.Chronicity.chronicConditionsCount}`);
    console.log(`  Total chronicity score: ${scanResult.Extracted.Chronicity.totalChronicityScore}\n`);
    
    if (scanResult.Extracted.Chronicity.chronicConditions && scanResult.Extracted.Chronicity.chronicConditions.length > 0) {
      console.log('  Chronic conditions:');
      scanResult.Extracted.Chronicity.chronicConditions.forEach(cc => {
        console.log(`    • ${cc}`);
      });
      console.log('');
    }
    
    // Continuity analysis
    console.log('─────────────────────────────────────────────────────────');
    console.log('CONTINUITY ANALYSIS');
    console.log('─────────────────────────────────────────────────────────\n');
    
    console.log(`  Has continuity indicators: ${scanResult.Extracted.Continuity.hasContinuityIndicators ? 'YES' : 'NO'}`);
    console.log(`  Continuity score: ${scanResult.Extracted.Continuity.continuityScore}\n`);
    
    // Service connection opportunities
    console.log('─────────────────────────────────────────────────────────');
    console.log('SERVICE CONNECTION OPPORTUNITIES');
    console.log('─────────────────────────────────────────────────────────\n');
    
    if (scanResult.Analysis.ServiceConnectionOpportunities.length === 0) {
      console.log('  No service connection opportunities identified.\n');
    } else {
      scanResult.Analysis.ServiceConnectionOpportunities.forEach((opp, idx) => {
        console.log(`${idx + 1}. ${opp.condition}`);
        console.log(`   Type: ${opp.type}`);
        console.log(`   Basis: ${opp.basis}`);
        console.log(`   Evidence: "${opp.evidence.substring(0, 100)}..."`);
        console.log('');
      });
    }
    
    // Analysis flags
    console.log('─────────────────────────────────────────────────────────');
    console.log('ANALYSIS FLAGS');
    console.log('─────────────────────────────────────────────────────────\n');
    
    if (scanResult.Analysis.Flags.length === 0) {
      console.log('  No analysis flags.\n');
    } else {
      scanResult.Analysis.Flags.forEach(flag => {
        console.log(`  • ${flag}`);
      });
      console.log('');
    }
    
    // Warnings
    if (scanResult.parse_warnings && scanResult.parse_warnings.length > 0) {
      console.log('─────────────────────────────────────────────────────────');
      console.log('WARNINGS');
      console.log('─────────────────────────────────────────────────────────\n');
      
      scanResult.parse_warnings.forEach(warning => {
        console.log(`  ⚠️  ${warning}`);
      });
      console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('ACCURACY IMPROVEMENTS SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const allDiagnoses = scanResult.Extracted.Diagnoses || [];
    const allInjuries = scanResult.Extracted.Injuries || [];
    const allEvents = scanResult.Extracted.Events || [];
    const allItems = [...allDiagnoses, ...allInjuries, ...allEvents];
    
    const lateralityCount = allItems.filter(d => 
      d.firstOccurrence.laterality && d.firstOccurrence.laterality.side
    ).length;
    
    const severityCount = allItems.filter(d => 
      d.firstOccurrence.severity && d.firstOccurrence.severity.value
    ).length;
    
    const highConfCount = allItems.filter(d => 
      d.confidence && d.confidence.level === 'high'
    ).length;
    
    console.log(`📊 EXTRACTION SUMMARY:`);
    console.log(`   Diagnoses: ${allDiagnoses.length}`);
    console.log(`   Injuries: ${allInjuries.length}`);
    console.log(`   Events: ${allEvents.length}`);
    console.log(`   Total: ${allItems.length}`);
    console.log('');
    
    console.log(`✓ Negation detection: Active (${allItems.length} items passed negation filter)`);
    console.log(`✓ Laterality extraction: ${lateralityCount}/${allItems.length} items have laterality data`);
    console.log(`✓ Severity extraction: ${severityCount}/${allItems.length} items have severity data`);
    console.log(`✓ Confidence scoring: ${highConfCount}/${allItems.length} items have HIGH confidence`);
    console.log(`✓ Medical normalization: ${allItems.filter(d => d.icd10).length}/${allItems.length} items have ICD-10 codes`);
    console.log(`✓ Medication validation: ${scanResult.Extracted.Medications.filter(m => m.validationStatus === 'confirmed').length}/${scanResult.Extracted.Medications.length} medications validated\n`);
    
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Save full results to JSON
    const outputPath = path.join(__dirname, 'fletcher0772-scan-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(scanResult, null, 2));
    console.log(`📁 Full results saved to: fletcher0772-scan-results.json\n`);
    
  } catch (error) {
    console.error('❌ Error during scan:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testSTRSAccuracy();
