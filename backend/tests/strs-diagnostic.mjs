/**
 * Quick diagnostic to see what's actually being extracted
 */

/* eslint-env node */

import {
  normalizeText,
  scanSTRText
} from '../engine/strs/strs-engine.js';

const sampleSTRDocument = `
VETERAN SERVICE TREATMENT RECORDS
Clinical Encounter 01/15/2011
- Chief Complaint: Ongoing back pain and stiffness
- Assessment: Lower back strain

Clinical Encounter 06/10/2012
- Assessment: PTSD with anxiety

Clinical Encounter 12/20/2013
- Exam: bilateral hearing loss, tinnitus

Clinical Encounter 03/15/2014
- Assessment: Major depression with sleep disturbance

Medications: sertraline 50mg daily for depression, gabapentin for pain
`;

const normalized = normalizeText(sampleSTRDocument);
const scanResult = scanSTRText(normalized);

globalThis.console.log('EXTRACTED DIAGNOSES:');
scanResult.Extracted.Diagnoses.forEach((d, i) => {
  globalThis.console.log(`  ${i + 1}. Label: "${d.label}", Match: "${d.matchedText}"`);
});

globalThis.console.log('\nEXTRACTED MEDICATIONS:');
scanResult.Extracted.Medications.forEach((m, i) => {
  globalThis.console.log(`  ${i + 1}. Label: "${m.label}", Match: "${m.matchedText}"`);
});

globalThis.console.log('\nANALYSIS:');
globalThis.console.log(`  - Diagnoses Found: ${scanResult.Analysis.DiagnosesFound}`);
globalThis.console.log(`  - Injuries Found: ${scanResult.Analysis.InjuriesFound}`);
globalThis.console.log(`  - Events Found: ${scanResult.Analysis.EventsFound}`);
globalThis.console.log(`  - Chronic Conditions: ${scanResult.Analysis.ChronicConditions}`);
globalThis.console.log(`  - Medications Found: ${scanResult.Analysis.MedicationsFound}`);
globalThis.console.log(`  - Service Connection Opportunities: ${scanResult.Analysis.ServiceConnectionOpportunities.length}`);


