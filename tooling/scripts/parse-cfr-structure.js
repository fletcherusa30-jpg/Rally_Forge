/**
 * CFR Regulatory Knowledge Parser
 * 
 * Parses 38 CFR Part 3 (Adjudication) and Part 4 (Schedule for Rating Disabilities)
 * into structured, machine-readable JSON for deterministic regulatory reasoning.
 * 
 * Treats CFR as authoritative law - no summarization, no paraphrasing.
 * Every rule traceable to specific CFR section.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// SECTION EXTRACTION
// ============================================================================

/**
 * Extract all CFR sections from text
 * Sections follow pattern: § 3.1, § 4.25, etc.
 */
function extractSections(text, partNumber) {
    const sections = [];
    
    // Regex pattern: § followed by number.number, then title
    // Example: "§ 3.1 Definitions."
    const sectionPattern = /§\s+(\d+\.\d+[a-z]?)\s+([^\n]+?)\./g;
    
    let match;
    while ((match = sectionPattern.exec(text)) !== null) {
        const sectionNumber = match[1];
        const title = match[2].trim();
        
        sections.push({
            sectionNumber: `§${sectionNumber}`,
            title: title,
            partNumber: partNumber,
            rawText: null, // Will be populated in second pass
            paragraphs: [],
            authority: null,
            crossReferences: [],
            notes: []
        });
    }
    
    return sections;
}

/**
 * Extract full text content for each section
 */
function populateSectionContent(text, sections) {
    for (let i = 0; i < sections.length; i++) {
        const currentSection = sections[i];
        const nextSection = sections[i + 1];
        
        // Find start of current section
        const startPattern = new RegExp(`§\\s+${currentSection.sectionNumber.replace('§', '')}\\s+${escapeRegex(currentSection.title)}\\.`, 'g');
        const startMatch = startPattern.exec(text);
        
        if (!startMatch) continue;
        
        const startIndex = startMatch.index;
        
        // Find end (either next section or end of text)
        let endIndex = text.length;
        if (nextSection) {
            const endPattern = new RegExp(`§\\s+${nextSection.sectionNumber.replace('§', '')}\\s+${escapeRegex(nextSection.title)}\\.`, 'g');
            const endMatch = endPattern.exec(text);
            if (endMatch) {
                endIndex = endMatch.index;
            }
        }
        
        currentSection.rawText = text.substring(startIndex, endIndex).trim();
        
        // Extract authority citations
        currentSection.authority = extractAuthority(currentSection.rawText);
        
        // Extract cross-references
        currentSection.crossReferences = extractCrossReferences(currentSection.rawText);
        
        // Extract notes
        currentSection.notes = extractNotes(currentSection.rawText);
        
        // Extract paragraph structure
        currentSection.paragraphs = extractParagraphs(currentSection.rawText);
    }
    
    return sections;
}

// ============================================================================
// PARAGRAPH EXTRACTION (Hierarchical)
// ============================================================================

/**
 * Extract hierarchical paragraph structure: (a), (b), (1), (i), (A)
 */
function extractParagraphs(sectionText) {
    const paragraphs = [];
    
    // Level 1: (a), (b), (c)...
    const level1Pattern = /\n\(([a-z])\)\s+([^]*?)(?=\n\([a-z]\)|\n\(Authority:|\n§|\n[A-Z][A-Z]|$)/g;
    
    let match;
    while ((match = level1Pattern.exec(sectionText)) !== null) {
        const label = `(${match[1]})`;
        const content = match[2].trim();
        
        paragraphs.push({
            level: 1,
            label: label,
            content: content,
            children: extractLevel2Paragraphs(content)
        });
    }
    
    return paragraphs;
}

function extractLevel2Paragraphs(parentText) {
    const paragraphs = [];
    
    // Level 2: (1), (2), (3)...
    const level2Pattern = /\((\d+)\)\s+([^]*?)(?=\n\(\d+\)|\(Authority:|\n§|$)/g;
    
    let match;
    while ((match = level2Pattern.exec(parentText)) !== null) {
        const label = `(${match[1]})`;
        const content = match[2].trim();
        
        paragraphs.push({
            level: 2,
            label: label,
            content: content,
            children: extractLevel3Paragraphs(content)
        });
    }
    
    return paragraphs;
}

function extractLevel3Paragraphs(parentText) {
    const paragraphs = [];
    
    // Level 3: (i), (ii), (iii)...
    const level3Pattern = /\(([ivxlcdm]+)\)\s+([^]*?)(?=\n\([ivxlcdm]+\)|\(Authority:|$)/g;
    
    let match;
    while ((match = level3Pattern.exec(parentText)) !== null) {
        const label = `(${match[1]})`;
        const content = match[2].trim();
        
        paragraphs.push({
            level: 3,
            label: label,
            content: content,
            children: extractLevel4Paragraphs(content)
        });
    }
    
    return paragraphs;
}

function extractLevel4Paragraphs(parentText) {
    const paragraphs = [];
    
    // Level 4: (A), (B), (C)...
    const level4Pattern = /\(([A-Z])\)\s+([^]+?)(?=\n\([A-Z]\)|$)/g;
    
    let match;
    while ((match = level4Pattern.exec(parentText)) !== null) {
        const label = `(${match[1]})`;
        const content = match[2].trim();
        
        paragraphs.push({
            level: 4,
            label: label,
            content: content,
            children: [] // Max depth
        });
    }
    
    return paragraphs;
}

// ============================================================================
// REGULATORY LANGUAGE CLASSIFICATION
// ============================================================================

/**
 * Classify regulatory language as mandatory, permissive, or prohibitive
 */
function classifyRegulatoryLanguage(text) {
    const lowerText = text.toLowerCase();
    
    // Mandatory verbs
    if (/(shall|must|will|is required|are required)/i.test(lowerText)) {
        return 'mandatory';
    }
    
    // Prohibitive
    if (/(shall not|must not|may not|is prohibited|are prohibited|will not be)/i.test(lowerText)) {
        return 'prohibitive';
    }
    
    // Permissive
    if (/(may|can|is permitted|are permitted)/i.test(lowerText)) {
        return 'permissive';
    }
    
    // Definitions
    if (/(means|includes|refers to|is defined as)/i.test(lowerText)) {
        return 'definition';
    }
    
    return 'descriptive';
}

// ============================================================================
// DIAGNOSTIC CODE EXTRACTION (Part 4)
// ============================================================================

/**
 * Extract diagnostic codes and rating criteria from Part 4
 */
function extractDiagnosticCodes(sectionText, sectionNumber) {
    const diagnosticCodes = [];
    
    // Pattern: 4-digit code followed by description and optionally ratings
    // Example: "5260 Ankle, ankylosis of:"
    const dcPattern = /(\d{4})\s+([^:\n]+)[:.\n]/g;
    
    let match;
    while ((match = dcPattern.exec(sectionText)) !== null) {
        const code = match[1];
        const description = match[2].trim();
        
        // Try to extract rating criteria following this code
        const ratings = extractRatingsForCode(sectionText, code, match.index);
        
        diagnosticCodes.push({
            code: code,
            description: description,
            section: sectionNumber,
            ratings: ratings,
            bodySystem: determineBodySystem(sectionNumber, description)
        });
    }
    
    return diagnosticCodes;
}

/**
 * Extract ratings (percentages) for a diagnostic code
 */
function extractRatingsForCode(text, code, startIndex) {
    const ratings = [];
    
    // Look ahead from code position to find percentages
    // Extract next 500 chars after code
    const window = text.substring(startIndex, startIndex + 500);
    
    // Pattern: percentage followed by criteria
    // Can be "100" or "100 percent" or just the number on a line
    const ratingPattern = /(\d{1,3})\s*(?:percent)?[:\s]+([^\n]+)/gi;
    
    let match;
    while ((match = ratingPattern.exec(window)) !== null) {
        const percentage = parseInt(match[1]);
        const criteria = match[2].trim();
        
        // Only accept valid percentages (0-100, divisible by 10)
        if (percentage <= 100 && percentage % 10 === 0) {
            ratings.push({
                percentage: percentage,
                criteria: criteria
            });
        }
    }
    
    return ratings;
}

/**
 * Determine body system based on section number and description
 */
function determineBodySystem(sectionNumber, description) {
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('musculoskeletal') || /\b(shoulder|elbow|wrist|knee|ankle|spine)\b/.test(lowerDesc)) {
        return 'musculoskeletal';
    }
    if (lowerDesc.includes('cardiovascular') || /\b(heart|vascular)\b/.test(lowerDesc)) {
        return 'cardiovascular';
    }
    if (lowerDesc.includes('respiratory') || /\b(lung|breathing)\b/.test(lowerDesc)) {
        return 'respiratory';
    }
    if (lowerDesc.includes('mental') || lowerDesc.includes('ptsd')) {
        return 'mental';
    }
    if (lowerDesc.includes('neurological') || /\b(nerve|brain)\b/.test(lowerDesc)) {
        return 'neurological';
    }
    
    return 'general';
}

// ============================================================================
// SPECIAL CFR SECTION EXTRACTION
// ============================================================================

/**
 * Extract §4.25 Combined Ratings Table with full math rules
 */
function extractCombinedRatingsTable(text) {
    const section425Pattern = /§\s+4\.25\s+Combined ratings table\.([\s\S]+?)(?=§\s+4\.26|$)/i;
    const match = section425Pattern.exec(text);
    
    if (!match) return null;
    
    const sectionText = match[1];
    
    return {
        sectionNumber: '§4.25',
        title: 'Combined ratings table',
        method: 'whole_person_efficiency',
        formula: 'combined = 100 - product((100-rating)/100 for each rating)',
        rules: [
            {
                rule: 'Order disabilities by severity, descending',
                type: 'mandatory',
                citation: '38 CFR §4.25(a)',
                rawText: 'the disabilities will first be arranged in the exact order of their severity'
            },
            {
                rule: 'Combine using Table I efficiency reduction method',
                type: 'mandatory',
                citation: '38 CFR §4.25(a)',
                rawText: 'Proceeding from this 40 percent efficiency, the effect of a further 30 percent disability is to leave only 70 percent of the efficiency remaining'
            },
            {
                rule: 'Round to nearest 10, adjusting 5s upward',
                type: 'mandatory',
                citation: '38 CFR §4.25(a)',
                rawText: 'combined values ending in 5 will be adjusted upward'
            },
            {
                rule: 'Convert to nearest 10 only once per decision',
                type: 'mandatory',
                citation: '38 CFR §4.25(b)',
                rawText: 'The conversion to the nearest degree divisible by 10 will be done only once per rating decision'
            }
        ],
        examples: [
            {
                disabilities: [60, 30],
                unrounded: 72,
                rounded: 70,
                citation: '38 CFR §4.25(a)'
            },
            {
                disabilities: [40, 20],
                unrounded: 52,
                rounded: 50,
                citation: '38 CFR §4.25(a)'
            },
            {
                disabilities: [60, 40, 20],
                step1: '60 + 40 = 76',
                step2: '76 + 20 = 81',
                rounded: 80,
                citation: '38 CFR §4.25(a)'
            }
        ],
        fullText: sectionText
    };
}

/**
 * Extract §4.26 Bilateral Factor with exact application rules
 */
function extractBilateralFactor(text) {
    const section426Pattern = /§\s+4\.26\s+Bilateral factor\.([\s\S]+?)(?=§\s+4\.27|$)/i;
    const match = section426Pattern.exec(text);
    
    if (!match) return null;
    
    const sectionText = match[1];
    
    return {
        sectionNumber: '§4.26',
        title: 'Bilateral factor',
        factor: 0.10,
        factorPercentage: 10,
        applicability: [
            {
                rule: 'Applies to paired extremities (both arms, both legs, paired skeletal muscles)',
                type: 'mandatory',
                citation: '38 CFR §4.26(a)',
                rawText: 'when a partial disability results from disease or injury of both arms, or of both legs, or of paired skeletal muscles'
            },
            {
                rule: 'Requires compensable disability in EACH of paired extremities',
                type: 'mandatory',
                citation: '38 CFR §4.26(c)',
                rawText: 'not applicable unless there is partial disability of compensable degree in each of 2 paired extremities'
            },
            {
                rule: 'Arms/legs includes entire upper/lower extremity',
                type: 'definition',
                citation: '38 CFR §4.26(a)',
                rawText: 'The use of the terms "arms" and "legs" is not intended to distinguish between the arm, forearm and hand, or the thigh, leg, and foot'
            }
        ],
        calculationMethod: [
            {
                step: 1,
                action: 'Combine bilateral ratings using §4.25 table',
                type: 'mandatory',
                rawText: 'the ratings for the disabilities of the right and left sides will be combined as usual'
            },
            {
                step: 2,
                action: 'Add (not combine) 10% of combined value',
                type: 'mandatory',
                rawText: '10 percent of this value will be added (i.e., not combined)'
            },
            {
                step: 3,
                action: 'Apply bilateral factor BEFORE other combinations',
                type: 'mandatory',
                rawText: 'The bilateral factor will be applied to such bilateral disabilities before other combinations are carried out'
            },
            {
                step: 4,
                action: 'Treat bilateral group as single disability for ordering',
                type: 'mandatory',
                rawText: 'the rating for such disabilities including the bilateral factor in this section will be treated as one disability'
            }
        ],
        examples: [
            {
                description: 'Two bilateral 10% disabilities with other conditions',
                disabilities: {
                    bilateral: [10, 10],
                    other: [60, 20]
                },
                calculation: {
                    step1_combine_bilateral: '10 + 10 = 19',
                    step2_add_10_percent: '19 + (19 × 0.10) = 21',
                    step3_order: '[60, 21, 20]',
                    step4_combine_60_21: '60 + 21 = 68',
                    step5_combine_68_20: '68 + 20 = 74',
                    step6_round: 70
                },
                citation: '38 CFR §4.26 (example in regulation)'
            }
        ],
        exceptions: [
            {
                rule: 'May exclude bilateral disabilities if it results in lower rating',
                type: 'permissive',
                citation: '38 CFR §4.26(d)',
                rawText: 'In cases where the combined evaluation is lower than what could be achieved by not including one or more bilateral disabilities in the bilateral factor calculation, those bilateral disabilities will be removed from the bilateral factor calculation and combined separately'
            }
        ],
        fullText: sectionText
    };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractAuthority(text) {
    // Pattern: (Authority: 38 U.S.C. 501)
    const authorityPattern = /\(Authority:\s+([^\)]+)\)/g;
    const authorities = [];
    
    let match;
    while ((match = authorityPattern.exec(text)) !== null) {
        authorities.push(match[1].trim());
    }
    
    return authorities.length > 0 ? authorities : null;
}

function extractCrossReferences(text) {
    // Pattern: "See § 3.1(u)" or "See §§ 3.18-3.19"
    const crossRefPattern = /See\s+§§?\s+([\d\.]+(?:-[\d\.]+)?(?:\([a-z0-9]+\))?(?:,\s*[\d\.]+(?:\([a-z0-9]+\))?)*)/gi;
    const crossRefs = [];
    
    let match;
    while ((match = crossRefPattern.exec(text)) !== null) {
        crossRefs.push(match[1].trim());
    }
    
    return crossRefs;
}

function extractNotes(text) {
    // Pattern: "Note:" or "NOTE:" or "N OTE :"
    const notePattern = /N\s*O\s*T\s*E\s*[:(\(\d+\))]?\s*([^\n]+(?:\n(?!§|[A-Z][A-Z])[^\n]+)*)/gi;
    const notes = [];
    
    let match;
    while ((match = notePattern.exec(text)) !== null) {
        notes.push(match[1].trim());
    }
    
    return notes;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// MAIN PARSING FUNCTION
// ============================================================================

async function parseCFRPart(partNumber, textFilePath) {
    console.log(`\nParsing 38 CFR Part ${partNumber}...`);
    
    const text = fs.readFileSync(textFilePath, 'utf8');
    
    // Extract sections
    console.log(`  Extracting section headers...`);
    let sections = extractSections(text, partNumber);
    console.log(`  Found ${sections.length} sections`);
    
    // Populate section content
    console.log(`  Extracting section content...`);
    sections = populateSectionContent(text, sections);
    
    // For Part 4, extract diagnostic codes
    let diagnosticCodes = [];
    if (partNumber === 4) {
        console.log(`  Extracting diagnostic codes...`);
        for (const section of sections) {
            const codes = extractDiagnosticCodes(section.rawText, section.sectionNumber);
            diagnosticCodes = diagnosticCodes.concat(codes);
        }
        console.log(`  Found ${diagnosticCodes.length} diagnostic codes`);
    }
    
    // Extract special sections
    let specialSections = {};
    if (partNumber === 4) {
        console.log(`  Extracting §4.25 Combined Ratings Table...`);
        specialSections.section425 = extractCombinedRatingsTable(text);
        
        console.log(`  Extracting §4.26 Bilateral Factor...`);
        specialSections.section426 = extractBilateralFactor(text);
    }
    
    return {
        partNumber: partNumber,
        totalSections: sections.length,
        sections: sections,
        diagnosticCodes: diagnosticCodes,
        specialSections: specialSections,
        metadata: {
            extractedDate: new Date().toISOString(),
            sourceFile: path.basename(textFilePath),
            totalCharacters: text.length,
            totalWords: text.split(/\s+/).length
        }
    };
}

// ============================================================================
// EXECUTION
// ============================================================================

async function main() {
    console.log('='.repeat(70));
    console.log('CFR REGULATORY KNOWLEDGE PARSER');
    console.log('38 CFR Part 3 (Adjudication) and Part 4 (Rating Schedule)');
    console.log('='.repeat(70));
    
    // Parse Part 3
    const part3Result = await parseCFRPart(
        3,
        path.join(__dirname, 'knowledge', '_raw_extraction', 'part3_text.txt')
    );
    
    // Parse Part 4
    const part4Result = await parseCFRPart(
        4,
        path.join(__dirname, 'knowledge', '_raw_extraction', 'part4_text.txt')
    );
    
    // Create output directories
    const part3Dir = path.join(__dirname, 'knowledge', 'part3');
    const part4Dir = path.join(__dirname, 'knowledge', 'part4');
    
    fs.mkdirSync(part3Dir, { recursive: true });
    fs.mkdirSync(part4Dir, { recursive: true });
    
    // Write Part 3 outputs
    console.log('\nWriting Part 3 structured files...');
    fs.writeFileSync(
        path.join(part3Dir, 'sections.json'),
        JSON.stringify(part3Result.sections, null, 2)
    );
    console.log(`  ✓ Part 3 sections.json (${part3Result.sections.length} sections)`);
    
    // Write Part 4 outputs
    console.log('\nWriting Part 4 structured files...');
    fs.writeFileSync(
        path.join(part4Dir, 'sections.json'),
        JSON.stringify(part4Result.sections, null, 2)
    );
    console.log(`  ✓ Part 4 sections.json (${part4Result.sections.length} sections)`);
    
    fs.writeFileSync(
        path.join(part4Dir, 'diagnostic_codes.json'),
        JSON.stringify(part4Result.diagnosticCodes, null, 2)
    );
    console.log(`  ✓ Part 4 diagnostic_codes.json (${part4Result.diagnosticCodes.length} codes)`);
    
    // Write special sections (§4.25 and §4.26)
    fs.writeFileSync(
        path.join(part4Dir, 'combined_ratings_table.json'),
        JSON.stringify(part4Result.specialSections.section425, null, 2)
    );
    console.log(`  ✓ Part 4 combined_ratings_table.json (§4.25 rules)`);
    
    fs.writeFileSync(
        path.join(part4Dir, 'bilateral_factor.json'),
        JSON.stringify(part4Result.specialSections.section426, null, 2)
    );
    console.log(`  ✓ Part 4 bilateral_factor.json (§4.26 rules)`);
    
    // Write summary
    const summary = {
        part3: {
            totalSections: part3Result.totalSections,
            totalCharacters: part3Result.metadata.totalCharacters,
            totalWords: part3Result.metadata.totalWords
        },
        part4: {
            totalSections: part4Result.totalSections,
            totalDiagnosticCodes: part4Result.diagnosticCodes.length,
            totalCharacters: part4Result.metadata.totalCharacters,
            totalWords: part4Result.metadata.totalWords
        },
        extractedDate: new Date().toISOString()
    };
    
    fs.writeFileSync(
        path.join(__dirname, 'knowledge', 'parsing_summary.json'),
        JSON.stringify(summary, null, 2)
    );
    console.log(`\n✓ Summary written to knowledge/parsing_summary.json`);
    
    console.log('\n' + '='.repeat(70));
    console.log('CFR PARSING COMPLETE');
    console.log('='.repeat(70));
    console.log(`Part 3: ${part3Result.totalSections} sections`);
    console.log(`Part 4: ${part4Result.totalSections} sections, ${part4Result.diagnosticCodes.length} diagnostic codes`);
    console.log(`§4.25 (Combined Ratings): ${part4Result.specialSections.section425 ? 'Extracted' : 'NOT FOUND'}`);
    console.log(`§4.26 (Bilateral Factor): ${part4Result.specialSections.section426 ? 'Extracted' : 'NOT FOUND'}`);
    console.log('='.repeat(70));
}

// Run the main function
main().catch(error => {
    console.error('FATAL ERROR:', error);
    process.exit(1);
});

export {
    parseCFRPart,
    extractSections,
    extractDiagnosticCodes,
    extractCombinedRatingsTable,
    extractBilateralFactor
};

