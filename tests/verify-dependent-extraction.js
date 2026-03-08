#!/usr/bin/env node

/**
 * Quick test to verify dependent extraction is working
 * Run: node tests/verify-dependent-extraction.js
 */

import { extractDependents } from '../VA SCANNER/frontend/utils/extractDependents.js';

console.log('=== DEPENDENT EXTRACTION VERIFICATION ===\n');

// Test Case 1: VA Decision with spouse
const testCase1 = `
RATING DECISION

Combined Disability Rating: 70%
Effective Date: November 27, 2017

DEPENDENTS

Type of Dependent    Name                Effective Date
Spouse              Jennifer Williams    November 27, 2017

Your monthly benefit: $1,808.45
Spouse Addition: $428.00
Total Monthly: $2,236.45
`;

console.log('TEST 1: VA Decision with Spouse');
console.log('Input text length:', testCase1.length);
const result1 = extractDependents(testCase1);
console.log('Result:', JSON.stringify(result1, null, 2));
console.log('');

// Test Case 2: VA Decision with spouse and children
const testCase2 = `
RATING DECISION
Combined Disability Rating: 70%

DEPENDENTS

We added the following dependents:

Type of Dependent    Name                Effective Date
Spouse              Sarah Johnson       February 1, 2024
Child               Michael Johnson     February 1, 2024
Child               Emily Johnson       February 1, 2024

Monthly benefit adjustment for spouse: $428.00
Monthly benefit adjustment for each child: $95.00

Total Dependent Addition: $618.00/month
`;

console.log('TEST 2: VA Decision with Spouse and Children');
console.log('Input text length:', testCase2.length);
const result2 = extractDependents(testCase2);
console.log('Result:', JSON.stringify(result2, null, 2));
console.log('');

// Test Case 3: Empty document
const testCase3 = `
RATING DECISION
Combined Disability Rating: 50%
Effective Date: January 1, 2024
No dependents on file.
`;

console.log('TEST 3: VA Decision with No Dependents');
console.log('Input text length:', testCase3.length);
const result3 = extractDependents(testCase3);
console.log('Result:', JSON.stringify(result3, null, 2));
console.log('');

// Test Case 4: Narrative format
const testCase4 = `
We added your spouse Jennifer Lee effective June 1, 2024.
Your compensation breakdown:
Base rating (70%): $1,808.45
Spouse addition: $150.00
Total monthly: $1,958.45
`;

console.log('TEST 4: Narrative Format with Spouse');
console.log('Input text length:', testCase4.length);
const result4 = extractDependents(testCase4);
console.log('Result:', JSON.stringify(result4, null, 2));
console.log('');

console.log('=== VERIFICATION COMPLETE ===');
console.log('If any test shows dependents, extraction is working.');
console.log('If all show empty arrays, check the VA decision format.');
