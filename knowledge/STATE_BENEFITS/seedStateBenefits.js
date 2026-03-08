import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../mongo.js';
import { COLLECTION_NAME } from './stateBenefitsRules.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function seedStateBenefits() {
    const db = await getDb();
    const rulesPath = path.resolve(__dirname, '../../../rules/stateRules.json');
    const raw = await fs.readFile(rulesPath, 'utf-8');
    const rules = JSON.parse(raw);

    const operations = rules.map(rule => ({
        updateOne: {
            filter: { id: rule.id },
            update: { $set: { ...rule } },
            upsert: true
        }
    }));

    const result = await db.collection(COLLECTION_NAME).bulkWrite(operations);
    console.log(`[seedStateBenefits] inserted: ${result.upsertedCount}, updated: ${result.modifiedCount}`);
}

