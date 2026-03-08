const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/rally_forge';

const seeds = [
  '01_claim_programs.sql',
  '02_claim_types.sql',
  '03_contention_types.sql'
];

async function applySeeds() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    for (const seedFile of seeds) {
      const seedPath = path.join(__dirname, seedFile);
      if (!fs.existsSync(seedPath)) {
        console.log(`⚠ Seed file ${seedFile} not found, skipping.`);
        continue;
      }

      const sql = fs.readFileSync(seedPath, 'utf8');
      console.log(`→ Applying seed: ${seedFile}`);
      await client.query(sql);
      console.log(`✓ Seed ${seedFile} applied.`);
    }

    console.log('\n✓ All seeds applied.');
  } catch (error) {
    console.error('✗ Seed failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  applySeeds().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { applySeeds };

