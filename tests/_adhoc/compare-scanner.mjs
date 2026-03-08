import fs from 'node:fs';

const text = fs.readFileSync('./ClaimLetter-extracted-full.txt', 'utf8');
const res = await fetch('http://localhost:4000/api/scanner/scan-text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text })
});

const j = await res.json();
const d = j.data || {};
const sc = (d.serviceConnected || []).map(x => x.condition);
const den = (d.denied || []).map(x => x.condition);

console.log('\n=== SCANNER OUTPUT ===');
console.log('Combined Rating:', d.ratingCalculation?.calculatedCombinedRating);
console.log('Service Connected Count:', sc.length);
console.log('Denied Count:', den.length);

console.log('\nService Connected Conditions:');
sc.forEach((c, i) => console.log(`${i + 1}. ${c}`));

console.log('\nDenied Conditions:');
den.forEach((c, i) => console.log(`${i + 1}. ${c}`));
