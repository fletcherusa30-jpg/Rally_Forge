import * as fs from 'fs';

const normalizeWhitespace = (text) => {
  return String(text || "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const pdfText = fs.readFileSync('_tmp_claimletter_text.txt', 'utf-8');
const normalized = normalizeWhitespace(pdfText);
const joined = normalized.replace(/\n/g, ' ').replace(/\s+/g, ' ');

console.log("=== TESTING DENIAL REASON REGEX ===\n");

// Test the actual pattern from buildDeniedReasonLookup
const pattern = /service connection for\s+([^.]+?)\s+is\s+denied\s+because\s+([^.]+\.\s+)/gi;

let match;
let matchCount = 0;

while ((match = pattern.exec(joined)) !== null) {
  matchCount++;
  console.log(`Match ${matchCount}:`);
  console.log(`  Condition: "${match[1].trim()}"`);
  console.log(`  Reason: "${match[2].trim()}"`);
  console.log(`  Reason length: ${match[2].length} chars`);
  console.log();
}

if (matchCount === 0) {
  console.log("⚠️ NO MATCHES FOUND!");
  console.log("\nLooking for 'migraines' in text...");
  const migrainesIndex = joined.indexOf('migraines');
  if (migrainesIndex >= 0) {
    console.log(`Found 'migraines' at position ${migrainesIndex}`);
    console.log(`Context: "${joined.substring(Math.max(0, migrainesIndex - 100), migrainesIndex + 200)}"`);
  }
} else {
  console.log(`✓ Found ${matchCount} matches`);
}
