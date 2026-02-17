import fs from 'fs';

// Minimal functions needed for testing
const normalizeWhitespace = (value) =>
  String(value || "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const normalizeCondition = (value) =>
  String(value || "")
    .replace(/^[\s\-–—:;,.]+/, "")
    .replace(/\s*\|\s*/g, " ")
    .replace(/\s*\bservice connection for\b\s*/i, "")
    .replace(/\s*\(claimed as[^\)]*\)/gi, "")
    .replace(/\s*\([^\)]*\)\s*$/g, "")
    .replace(/\.\s*service connection for\b[\s\S]*$/i, "")
    .replace(/\bservice connection has been[\s\S]*$/i, "")
    .replace(/\bthe effective date of this grant[\s\S]*$/i, "")
    .replace(/\bwe have no record[\s\S]*$/i, "")
    .replace(/\bis denied\b[\s\S]*$/i, "")
    .replace(/\brights to appeal\b[\s\S]*$/i, "")
    .replace(/\b(disability evaluation|evaluation)\b/gi, "")
    .replace(/^(for|to|of|your)\s+/i, "")
    .replace(/\b([A-Za-z][A-Za-z'\-]*)\s+\1\b/gi, "$1")
    .replace(/[\s\-–—:;,.]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const normalizeConditionComparison = (value) =>
  normalizeCondition(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b([a-z0-9]+)\s+\1\b/g, "$1")
    .trim();

// Test the lookup building
const text = fs.readFileSync('./_tmp_claimletter_text.txt', 'utf-8');

const normalized = normalizeWhitespace(text);
const joined = normalized.replace(/\n/g, ' ').replace(/\s+/g, ' ');

console.log('=== Testing Updated Lookup Building ===\n');

const pattern = /service connection for\s+([^.]+?)\s+is\s+denied\s+because\s+([^.]+\.\s+)/gi;

let match;
let count = 0;
const matches = [];

while ((match = pattern.exec(joined)) !== null) {
  count++;
  let rawCondition = match[1].trim();
  let detail = match[2].trim();
  
  // Remove trailing spaces and extra periods
  detail = detail.replace(/\s+$/, '').replace(/\.+$/, '.').trim();
  
  // Remove content after "Service connection" keywords
  rawCondition = rawCondition.replace(/\bservice connection.*$/i, '').trim();
  
  const condition = normalizeCondition(rawCondition);
  const key = normalizeConditionComparison(condition);
  
  const isValid = key && detail && detail.length >= 20;
  
  matches.push({
    num: count,
    rawCondition,
    normalizedCondition: condition,
    key,
    detailLength: detail.length,
    detailFirst100: detail.substring(0, 100),
    valid: isValid
  });
}

// Print results
console.log(`Total pattern matches found: ${count}\n`);

matches.forEach(m => {
  console.log(`Match ${m.num}:`);
  console.log(`  Raw condition: "${m.rawCondition}"`);
  console.log(`  Normalized: "${m.normalizedCondition}"`);
  console.log(`  Key: "${m.key}"`);
  console.log(`  Detail length: ${m.detailLength}`);
  console.log(`  Detail (first 100): "${m.detailFirst100}..."`);
  console.log(`  Valid: ${m.valid ? 'YES ✓' : 'NO ✗'}`);
  console.log('');
});

const validCount = matches.filter(m => m.valid).length;
console.log(`\nValid entries: ${validCount} / ${count}`);

