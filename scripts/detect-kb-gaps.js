/**
 * Rally Forge - Knowledge Base Gap Detection
 * Identifies missing regulatory content across CFR Parts 3, 4, and M21-1
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const baseDir = process.cwd();
const knowledgeDir = path.join(baseDir, 'knowledge');

// CFR Part 3 sections (major topics)
const PART3_SECTIONS = [
  { section: '3.1', topic: 'Definitions' },
  { section: '3.102', topic: 'Service Connection - General' },
  { section: '3.103', topic: 'Chronological Age' },
  { section: '3.304', topic: 'Direct Service Connection' },
  { section: '3.307', topic: 'Presumptive Service Connection' },
  { section: '3.309', topic: 'Disease Subject to Presumptive Service Connection' },
  { section: '3.310', topic: 'Disabilities That May Be Presumed To Have Been Incurred' },
  { section: '3.311', topic: 'Claims Based on Exposure to Fine Particulate Matter' },
  { section: '3.317', topic: 'Compensation for Certain Disabilities Occurring in Former POWs' },
  { section: '3.340', topic: 'Total Disability Ratings' },
  { section: '3.350', topic: 'Special Monthly Compensation' },
  { section: '3.400', topic: 'Ratings and Evaluations General Policy' },
  { section: '3.500', topic: 'Ratings - Multiple Disabilities' },
  { section: '3.800', topic: 'Linked and Merged Accounts' },
  { section: '3.1', topic: 'General Definitions' },
  { section: '3.6', topic: 'Active Service' },
  { section: '3.7', topic: 'Wartime Periods' },
  { section: '3.155', topic: 'Effective Dates for Increased Ratings' },
  { section: '3.156', topic: 'Effective Dates for Disability Ratings' },
  { section: '3.157', topic: 'Effective Dates for Dependency Status Changes' },
  { section: '3.400', topic: 'General Rating Considerations' },
  { section: '3.102', topic: 'Compensation for Service-Connected Disabilities' }
];

// CFR Part 4 common diagnostic codes (sample of major categories)
const PART4_CATEGORIES = [
  { code: '5000-5003', system: 'Musculoskeletal - General' },
  { code: '5200-5293', system: 'Musculoskeletal - Arthritis' },
  { code: '5300-5323', system: 'Musculoskeletal - Muscles' },
  { code: '6000-6099', system: 'Digestive System' },
  { code: '6200-6299', system: 'Genitourinary System' },
  { code: '6300-6399', system: 'Gynecological Conditions' },
  { code: '6500-6599', system: 'Respiratory System' },
  { code: '6600-6899', system: 'Cardiovascular System' },
  { code: '7000-7099', system: 'Dental and Oral Conditions' },
  { code: '7200-7299', system: 'Eye Conditions' },
  { code: '7300-7399', system: 'Ear Conditions' },
  { code: '7500-7599', system: 'Skin Conditions' },
  { code: '7600-7699', system: 'Endocrine System' },
  { code: '7700-7799', system: 'Neurological Conditions' },
  { code: '7800-7899', system: 'Hemic and Lymphatic Conditions' },
  { code: '8000-8099', system: 'Mental Disorders - General' },
  { code: '8100-8199', system: 'Mental Disorders - Psychotic' },
  { code: '8200-8299', system: 'Mental Disorders - Neurotic' },
  { code: '8300-8399', system: 'Mental Disorders - Organic' },
  { code: '9000-9099', system: 'Infectious Diseases' }
];

// M21-1 Adjudication Procedures (major topics)
const M21_1_TOPICS = [
  'Service Connection Determination',
  'Effective Date Assignments',
  'Rating Claims',
  'Dependency Claims',
  'Special Monthly Compensation (SMC)',
  'Presumptive Conditions',
  'Agent Orange Exposure',
  'Gulf War Illness',
  'PACT Act Claims',
  'Camp Lejeune Water Contamination',
  'Burn Pit Exposure',
  'Radiation Exposure',
  'Total Disability Individual Unemployability (TDIU)',
  'Permanent and Total (P&T) Ratings',
  'Secondary Service Connection',
  'Aggravation of Preexisting Conditions',
  'Combined Ratings Calculation'
];

console.log('🔍 Scanning Knowledge Base for Gaps...\n');

// Scan existing knowledge base files
function scanKnowledgeBase() {
  const files = [];
  
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.md')) {
        const relPath = path.relative(knowledgeDir, fullPath).replace(/\\/g, '/');
        const content = fs.readFileSync(fullPath, 'utf-8').toLowerCase();
        files.push({ path: relPath, content, fullPath });
      }
    }
  }
  
  walk(knowledgeDir);
  return files;
}

const kbFiles = scanKnowledgeBase();
console.log(`📚 Found ${kbFiles.length} existing knowledge base files\n`);

// Check Part 3 coverage
const part3Missing = [];
for (const section of PART3_SECTIONS) {
  const sectionRef = section.section.replace('.', '\\.');
  const regex = new RegExp(`(38 cfr|§|part 3).*${sectionRef}|${sectionRef}.*${section.topic.toLowerCase()}`, 'i');
  
  const found = kbFiles.some(f => regex.test(f.content) || f.path.includes(section.section));
  
  if (!found) {
    part3Missing.push(section);
  }
}

// Check Part 4 coverage
const part4Missing = [];
for (const category of PART4_CATEGORIES) {
  const codePattern = category.code.split('-')[0]; // e.g., "5000" from "5000-5003"
  const regex = new RegExp(`(diagnostic code|dc).*${codePattern}|${codePattern}.*${category.system.toLowerCase()}`, 'i');
  
  const found = kbFiles.some(f => regex.test(f.content) || f.path.includes(codePattern));
  
  if (!found) {
    part4Missing.push(category);
  }
}

// Check M21-1 coverage
const m21Missing = [];
for (const topic of M21_1_TOPICS) {
  const topicWords = topic.toLowerCase().split(' ').slice(0, 3).join('.*'); // First 3 words
  const regex = new RegExp(topicWords, 'i');
  
  const found = kbFiles.some(f => regex.test(f.content));
  
  if (!found) {
    m21Missing.push(topic);
  }
}

// Generate report
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    existingKBFiles: kbFiles.length,
    part3Checked: PART3_SECTIONS.length,
    part3Missing: part3Missing.length,
    part3Coverage: `${((1 - part3Missing.length / PART3_SECTIONS.length) * 100).toFixed(1)}%`,
    part4Checked: PART4_CATEGORIES.length,
    part4Missing: part4Missing.length,
    part4Coverage: `${((1 - part4Missing.length / PART4_CATEGORIES.length) * 100).toFixed(1)}%`,
    m21Checked: M21_1_TOPICS.length,
    m21Missing: m21Missing.length,
    m21Coverage: `${((1 - m21Missing.length / M21_1_TOPICS.length) * 100).toFixed(1)}%`
  },
  missingContent: {
    part3Sections: part3Missing,
    part4Categories: part4Missing,
    m21Topics: m21Missing
  }
};

const timestamp = Math.floor(Date.now() / 1000);
const reportPath = path.join(baseDir, `audit/knowledge-base-gaps-${timestamp}.json`);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log('📊 Knowledge Base Coverage:');
console.log(`   38 CFR Part 3: ${report.summary.part3Coverage} (${part3Missing.length} missing)`);
console.log(`   38 CFR Part 4: ${report.summary.part4Coverage} (${part4Missing.length} missing)`);
console.log(`   M21-1 Topics: ${report.summary.m21Coverage} (${m21Missing.length} missing)`);

if (part3Missing.length > 0) {
  console.log('\n⚠️  Missing CFR Part 3 Sections (top 5):');
  part3Missing.slice(0, 5).forEach(s => {
    console.log(`   - §${s.section}: ${s.topic}`);
  });
}

if (part4Missing.length > 0) {
  console.log('\n⚠️  Missing CFR Part 4 Categories (top 5):');
  part4Missing.slice(0, 5).forEach(c => {
    console.log(`   - DC ${c.code}: ${c.system}`);
  });
}

if (m21Missing.length > 0) {
  console.log('\n⚠️  Missing M21-1 Topics (top 5):');
  m21Missing.slice(0, 5).forEach(t => {
    console.log(`   - ${t}`);
  });
}

// Create placeholder files for critical missing content
const placeholdersDir = path.join(knowledgeDir, '_PLACEHOLDERS');
if (!fs.existsSync(placeholdersDir)) {
  fs.mkdirSync(placeholdersDir, { recursive: true });
}

let placeholdersCreated = 0;

// Create Part 3 placeholders (top 5 critical)
const criticalPart3 = part3Missing.filter(s => 
  s.section.match(/3\.(102|304|307|309|350|400)/)
).slice(0, 5);

for (const section of criticalPart3) {
  const filename = `38CFR-${section.section.replace('.', '-')}-${section.topic.replace(/\s+/g, '-')}.md`;
  const filepath = path.join(placeholdersDir, filename);
  
  if (!fs.existsSync(filepath)) {
    const content = `# 38 CFR §${section.section} - ${section.topic}

**STATUS:** 🚧 PLACEHOLDER - NEEDS CONTENT

## Overview

This section covers: **${section.topic}**

## Key Points

*(Content needed)*

## Veteran Impact

*(Content needed)*

## Common Scenarios

*(Content needed)*

## Related Sections

*(Cross-references needed)*

## References

- 38 CFR §${section.section}
- M21-1 Adjudication Procedures

---

*This is a placeholder file generated by knowledge-base-gap-detection. Please add detailed content.*
`;
    
    fs.writeFileSync(filepath, content);
    placeholdersCreated++;
  }
}

// Create Part 4 placeholders (top 3 critical)
const criticalPart4 = part4Missing.filter(c => 
  c.code.match(/^(8000|7700|6600)/)
).slice(0, 3);

for (const category of criticalPart4) {
  const filename = `38CFR-Part4-DC-${category.code.split('-')[0]}-${category.system.replace(/\s+/g, '-')}.md`;
  const filepath = path.join(placeholdersDir, filename);
  
  if (!fs.existsSync(filepath)) {
    const content = `# 38 CFR Part 4 - Diagnostic Codes ${category.code}

**System:** ${category.system}  
**STATUS:** 🚧 PLACEHOLDER - NEEDS CONTENT

## Overview

Diagnostic codes for: **${category.system}**

## Rating Criteria

*(Content needed)*

## Common Conditions

*(Content needed)*

## Evidence Requirements

*(Content needed)*

## Veteran Guidance

*(Content needed)*

## References

- 38 CFR Part 4, Schedule for Rating Disabilities
- Diagnostic Codes ${category.code}

---

*This is a placeholder file generated by knowledge-base-gap-detection. Please add detailed content.*
`;
    
    fs.writeFileSync(filepath, content);
    placeholdersCreated++;
  }
}

console.log(`\n✅ Report saved: ${path.basename(reportPath)}`);
console.log(`✅ Created ${placeholdersCreated} placeholder files in knowledge/_PLACEHOLDERS/`);
console.log('\n💡 Next Steps:');
console.log('   1. Review audit/knowledge-base-gaps-*.json for full missing content list');
console.log('   2. Prioritize missing sections based on veteran impact');
console.log('   3. Populate placeholder files with detailed regulatory content');
console.log('   4. Move completed files from _PLACEHOLDERS to appropriate directories');
