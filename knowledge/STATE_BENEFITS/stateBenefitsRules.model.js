export const COLLECTION_NAME = 'state_benefits_rules';

// Required fields:
// stateCode: String
// minRatingPercent: Number
// requiresCombatFlag: Boolean
// requiresWartimeService: Boolean
// benefitCategory: String
// benefitName: String
// benefitDescription: String
// linkOrReference: String
// active: Boolean
export function getCollection(db) {
    return db.collection(COLLECTION_NAME);
}

