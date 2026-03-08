#!/usr/bin/env node

/**
 * Debug cache-based extraction
 */

function extractMonthlyByType(fullText, type) {
  // Build cache of all type:amount pairs from the full text
  if (!extractMonthlyByType.cache) {
    extractMonthlyByType.cache = new Map();
    
    console.log('=== BUILDING CACHE FOR:', fullText.substring(0, 100), '... ===');
    
    // Pattern to find "Type Description: $Amount" pairs
    const pairs = fullText.match(/(spouse|child|parent|dependent)\s+(?:addition|benefit|adjustment|payment|amount)?[\s:]*\$?([\d,\.]+)/gi) || [];
    
    console.log('Pairs found:', pairs);
    
    for (const pair of pairs) {
      const typeMatch = pair.match(/(spouse|child|parent)/i);
      const amountMatch = pair.match(/\$?([\d,\.]+)/);
      
      console.log(`  Pair: "${pair}" -> Type: ${typeMatch?.[1]}, Amount: ${amountMatch?.[1]}`);
      
      if (typeMatch && amountMatch) {
        const pairType = typeMatch[1].toLowerCase();
        const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
        
        // Store first occurrence of each type
        if (!extractMonthlyByType.cache.has(pairType)) {
          extractMonthlyByType.cache.set(pairType, amount);
          console.log(`    -> Cached ${pairType}: $${amount}`);
        } else {
          console.log(`    -> Skipped (already have ${pairType})`);
        }
      }
    }
    
    // Also check for specific patterns like "each child" or "per child"
    const eachChildMatch = fullText.match(/(?:each|per)\s+child[\s:]*\$?([\d,\.]+)/i);
    if (eachChildMatch) {
      console.log(`  Found "each child" pattern: $${eachChildMatch[1]}`);
      extractMonthlyByType.cache.set('child', parseFloat(eachChildMatch[1].replace(/,/g, '')));
    }
    
    console.log('Final cache:', extractMonthlyByType.cache);
  }

  return extractMonthlyByType.cache.get(type) || 0;
}

const testCase = `
We added the following dependents:

Type of Dependent    Name                Effective Date
Spouse              Sarah Johnson       February 1, 2024
Child               Michael Johnson     February 1, 2024
Child               Emily Johnson       February 1, 2024

Monthly benefit adjustment for spouse: $428.00
Monthly benefit adjustment for each child: $95.00

Total Dependent Addition: $618.00/month
`;

console.log('TEST: VA Decision with Spouse and Children\n');
const spouseAmount = extractMonthlyByType(testCase, 'spouse');
console.log(`\nSpouse amount: $${spouseAmount}`);

const childAmount = extractMonthlyByType(testCase, 'child');
console.log(`Child amount: $${childAmount}`);

console.log(`\nTotal (spouse + 2 children): $${spouseAmount + childAmount * 2}`);
