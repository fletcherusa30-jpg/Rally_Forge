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

console.log('=== Testing Lookup Keys vs Paragraph Detection ===\n');

// 1. Build lookup like the real code does
const pattern = /service connection for\s+([^.]+?)\s+is\s+denied\s+because\s+([^.]+\.\s+)/gi;
const lookupKeys = new Set();

let match;
while ((match = pattern.exec(joined)) !== null) {
  let rawCondition = match[1].trim();
  rawCondition = rawCondition.replace(/\bservice connection.*$/i, '').trim();
  const condition = normalizeCondition(rawCondition);
  const key = normalizeConditionComparison(condition);
  lookupKeys.add(key);
}

console.log('Lookup keys created:');
lookupKeys.forEach(key => console.log(`  - "${key}"`));

// 2. Test what the paragraph denyPatterns would detect
console.log('\n=== Testing Paragraph Detection ===\n');

const denyPatterns = [
  /(entitlement to\s+)?service connection for\s+(.+?)\s+(?:is|was|remains)?\s*denied\b/i,
  /denial of\s+(?:entitlement to\s+)?service connection for\s+(.+?)(?:\.|$)/i,
  /entitlement to\s+(?:an\s+)?(?:increased|higher)?\s*evaluation\s+for\s+(.+?)\s+(?:is|was|remains)?\s*denied\b/i,
  /for\s+(.+?)\s+(?:is|was|remains)?\s*denied\b/i,
  /^(.+?)\s+(?:is|was|remains)?\s*denied\b/i
];

// Find paragraphs (split by double newlines)
const paragraphs = normalized.split(/\n\n+/).map(p => p.replace(/\s+/g, " ").trim()).filter(Boolean);

console.log(`Total paragraphs: ${paragraphs.length}`);

let denialCount = 0;
const detectedConditions = new Set();

paragraphs.forEach((paragraph, idx) => {
  const context = paragraph.replace(/\s+/g, " ").trim();
  if (!/denied/i.test(context)) {
    return;
  }
  
  for (const pattern of denyPatterns) {
    const m = context.match(pattern);
    if (m) {
      denialCount++;
      const rawCondition = m[2] || m[1];
      const condition = normalizeCondition(rawCondition);
      const key = normalizeConditionComparison(condition);
      detectedConditions.add(key);
      
      console.log(`Paragraph ${idx}: Detected "${rawCondition}" → "${condition}" → "${key}"`);
      break;
    }
  }
});

console.log(`\n=== Key Matching ===\n`);
console.log(`Lookup keys: ${Array.from(lookupKeys).sort().join(', ')}`);
console.log(`Detected keys: ${Array.from(detectedConditions).sort().join(', ')}`);

const matched = Array.from(detectedConditions).filter(k => lookupKeys.has(k));
console.log(`\nMatched keys: ${matched.join(', ') || '(none)'}`);

const unmatched = Array.from(detectedConditions).filter(k => !lookupKeys.has(k));
if (unmatched.length > 0) {
  console.log(`Unmatched detected keys: ${unmatched.join(', ')}`);
  
  // Try to find close matches
  console.log(`\nCloseness analysis:`);
  unmatched.forEach(uk => {
    const lookupArray = Array.from(lookupKeys);
    const similarities = lookupArray.map(lk => {
      const matches = Array.from(uk).filter(c => lk.includes(c)).length;
      return { key: lk, similarity: matches };
    }).sort((a, b) => b.similarity - a.similarity);
    
    if (similarities[0] && similarities[0].similarity > 0) {
      console.log(`  "${uk}" closest to "${similarities[0].key}" (${similarities[0].similarity} char matches)`);
    }
  });
}
