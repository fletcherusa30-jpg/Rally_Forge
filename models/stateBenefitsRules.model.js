export const COLLECTION_NAME = 'state_benefits_rules';

export function getCollection(db) {
	return db.collection(COLLECTION_NAME);
}

