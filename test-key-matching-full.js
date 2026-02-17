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

console.log("=== SIMULATING KEY MATCHING IN buildDeniedReasonLookup ===\n");

const pdfText = fs.readFileSync('_tmp_claimletter_text.txt', 'utf-8');
const normalized = normalizeWhitespace(pdfText);
const joined = normalized.replace(/\n/g, ' ').replace(/\s+/g, ' ');

const lookupMap = new Map();
const pattern = /service connection for\s+([^.]+?)\s+is\s+denied\s+because\s+([^.]+\.\s+)/gi;

let match;
while ((match = pattern.exec(joined)) !== null) {
  let rawCondition = match[1].trim();
  let detail = match[2].trim();
  
  detail = detail.replace(/\s+$/, '').replace(/\.+$/, '.').trim();
  rawCondition = rawCondition.replace(/\bservice connection.*$/i, '').trim();
  
  const condition = normalizeCondition(rawCondition);
  const key = normalizeConditionComparison(condition);
  
  if (!key || !detail || detail.length < 20) {
    console.log(`Skipping: ${condition} (key: ${key}, detail length: ${detail.length})`);
    continue;
  }
  
  if (lookupMap.has(key)) {
    console.log(`Duplicate: ${condition} (key already exists)`);
    continue;
  }
  
  lookupMap.set(key, detail);
  console.log(`Added to lookup: "${key}"`);
}

console.log("\n=== SIMULATING KEY GENERATION IN pushDenied ===\n");

// Simulate extracting "migraines" and "fatigue" from the denial list
const testConditions = ["migraines", "fatigue"];

testConditions.forEach((rawCondition) => {
  const condition = normalizeCondition(rawCondition);
  const comparisonKey = normalizeConditionComparison(condition);
  
  console.log(`Condition: "${rawCondition}"`);
  console.log(`  After normalizeCondition: "${condition}"`);
  console.log(`  After normalizeConditionComparison: "${comparisonKey}"`);
  console.log(`  Found in lookup? ${lookupMap.has(comparisonKey)}`);
  if (lookupMap.has(comparisonKey)) {
    const reason = lookupMap.get(comparisonKey);
    console.log(`  ✓ Reason: "${reason.substring(0, 80)}..." (${reason.length} chars)`);
  } else {
    console.log(`  ✗ NOT FOUND - would use PRIORITY 2 fallback`);
  }
  console.log();
});
