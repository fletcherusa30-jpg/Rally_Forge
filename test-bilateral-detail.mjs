import fs from 'node:fs';
import { parseVADecisionScanner } from './backend/engine/scanner/vaDecisionScanner.js';
import { scanVaDecisionLetter } from './frontend/js/vaRatingEngine.js';

const text = fs.readFileSync('_tmp_claimletter_text.txt', 'utf8');
const result = scanVaDecisionLetter(text, { 
  parseVADecisionScanner, 
  useBilateralFactor: true 
});

const sc = result.scConditions || [];

console.log('\n=== ALL SERVICE-CONNECTED CONDITIONS ===');
sc.forEach((c, i) => {
  const bilateral = c.isBilateralCandidate ? `[${c.side} ${c.bodyGroup}]` : '[not bilateral]';
  console.log(`${i+1}. ${c.name} - ${c.percent}% ${bilateral}`);
});

console.log('\n=== FULL DEBUG TRACE ===');
(result.debugTrace || []).forEach(line => console.log(line));

console.log('\n=== FINAL RESULT ===');
console.log('Raw combined:', typeof result.rawCombined === 'number' ? result.rawCombined.toFixed(2) + '%' : result.rawCombined);
console.log('Rounded combined:', result.roundedCombined + '%');
console.log('Stated in letter:', result.statedCombinedFromLetter + '%');
