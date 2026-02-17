import * as fs from 'fs';

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

const normalizeWhitespace = (text) => {
  return String(text || "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
};

// Test PDF
const pdfText = fs.readFileSync('c:\\Dev\\Rally Forge\\_tmp_claimletter_text.txt', 'utf-8');

console.log("=== KEY MATCHING DEBUG ===\n");

// Test 1: Build lookup for MIGRAINES
const normalized = normalizeWhitespace(pdfText);
const joined = normalized.replace(/\n/g, ' ').replace(/\s+/g, ' ');

console.log("Looking for denial reason patterns...\n");

const pattern = /service connection for\s+([^.]+?)\s+is\s+denied\s+because\s+([^.]+\.\s+)/gi;
let match;
const lookupMap = new Map();

while ((match = pattern.exec(joined)) !== null) {
  const rawCondition = match[1].trim();
  const detail = match[2].trim();
  
  console.log(`Raw condition: "${rawCondition}"`);
  console.log(`Raw detail: "${detail}"`);
  
  const condition = normalizeCondition(rawCondition);
  const key = normalizeConditionComparison(condition);
  
  console.log(`Normalized condition: "${condition}"`);
  console.log(`Comparison key: "${key}"`);
  console.log(`Detail length: ${detail.length}`);
  console.log(`Entry stored in lookup: ${key} => (${detail.length} chars)\n`);
  
  lookupMap.set(key, detail);
}

console.log("\n=== LOOKUP MAP KEYS ===");
console.log("All keys in lookup:");
lookupMap.forEach((value, key) => {
  console.log(`  "${key}" (${value.length} chars)`);
});

// Test 2: Test condition discovery patterns 
console.log("\n=== TESTING CONDITION EXTRACTION FROM DENIAL LIST ===\n");

const denyPatterns = [
  /(entitlement to\s+)?service connection for\s+(.+?)\s+(?:is|was|remains)?\s*denied\b/i,
];

// Simulate text from the denial section
const denialSectionText = `Service connection for migraines is denied.
Service connection for fatigue is denied.`;

console.log("Testing denial extraction patterns on:");
console.log(denialSectionText);
console.log("\nMatches found:");

denyPatterns.forEach((pattern, idx) => {
  const testMatch = pattern.exec(denialSectionText);
  if (testMatch) {
    const rawCondition = testMatch[2] || testMatch[1];
    console.log(`\nPattern ${idx}:`);
    console.log(`  Raw condition from pattern: "${rawCondition}"`);
    
    const normalized = normalizeCondition(rawCondition);
    const key = normalizeConditionComparison(normalized);
    
    console.log(`  Normalized: "${normalized}"`);
    console.log(`  Comparison key: "${key}"`);
    console.log(`  Lookup has this key? ${lookupMap.has(key)}`);
    if (lookupMap.has(key)) {
      console.log(`  ✓ Found reason: "${lookupMap.get(key).substring(0, 80)}..."`);
    }
  }
});
