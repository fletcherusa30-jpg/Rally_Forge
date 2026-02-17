import fs from 'node:fs';
import { parseVADecisionScanner } from './backend/engine/scanner/vaDecisionScanner.js';
import { scanVaDecisionLetter } from './frontend/js/vaRatingEngine.js';

const text = fs.readFileSync('_tmp_claimletter_text.txt', 'utf8');
const result = scanVaDecisionLetter(text, { 
  parseVADecisionScanner, 
  useBilateralFactor: true 
});

const sc = result.scConditions || [];

console.log('\n=== SERVICE-CONNECTED CONDITIONS ===');
sc.forEach((c, i) => {
  if (c.percent > 0) {
    console.log(`${i+1}. ${c.name} - ${c.percent}%`);
  }
});

console.log('\nTotal compensable:', sc.filter(c => c.percent > 0).length);
console.log('Total 0%:', sc.filter(c => c.percent === 0).length);

console.log('\n=== COMBINED RATING ===');
console.log('Raw combined:', typeof result.rawCombined === 'number' ? result.rawCombined.toFixed(2) + '%' : result.rawCombined);
console.log('Rounded combined:', result.roundedCombined + '%');
console.log('Stated in letter:', result.statedCombinedFromLetter + '%');

console.log('\n=== BILATERAL DEBUG ===');
(result.debugTrace || []).filter(line => /bilateral/i.test(line)).forEach(line => console.log(line));
