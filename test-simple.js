import fs from 'fs';

const text = fs.readFileSync('_tmp_claimletter_text.txt', 'utf-8');
const normalized = text.replace(/\r/g, '\n').replace(/  +/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
const joined = normalized.replace(/\n/g, ' ').replace(/\s+/g, ' ');

// Just find and print the first occurrence of our target text
const idx = joined.indexOf('Service connection for fatigue is denied because');
if (idx !== -1) {
  console.log('Found fatigue denial at index', idx);
  console.log('Text around match:');
  console.log(JSON.stringify(joined.substring(idx, idx + 200)));
  console.log();
  
  // Test the pattern on just this substring
  const pattern = /service connection for\s+(.+?)\s+is\s+denied\s+because\s+(.+?)\./gi;
  const match = pattern.exec(joined.substring(idx));
  if (match) {
    console.log('Pattern matched!');
    console.log('Group 1 (condition):', match[1]);
    console.log('Group 2 (reason):', match[2]);
  } else {
    console.log('Pattern did NOT match');
    // Try to see what the followed text looks like
    const substr = joined.substring(idx, idx + 300);
    console.log('Substring to match:', JSON.stringify(substr));
  }
}
