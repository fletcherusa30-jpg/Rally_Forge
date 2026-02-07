import test from "node:test";
import assert from "node:assert/strict";
import { connectToMongo, getDb } from "../database/mongo.js";
import { createOrUpdateOnboarding } from "../services/onboardingService.js";
import { getOrComputeBenefits } from "../services/benefitsService.js";

const mongoUrl = process.env.MONGO_URL;

if (!mongoUrl) {
  test.skip("Integration tests require MONGO_URL", () => {});
} else {
  test.before(async () => {
    await connectToMongo(mongoUrl, "rallyforge_test");
    const db = getDb();
    await db.collection("veterans").deleteMany({});
    await db.collection("onboarding_results").deleteMany({});
    await db.collection("benefits_cache").deleteMany({});
  });

  test("onboarding creates records and computes benefits", async () => {
    const payload = {
      branch: "Army",
      component: "Active Duty",
      servicePeriods: [
        { startDate: "2010-01-01", endDate: "2014-01-01", theater: "Pacific" },
        { startDate: "2016-01-01", endDate: null, theater: "Middle East" }
      ],
      combatSelfReported: "yes",
      disabilityRatingKnown: true,
      disabilityRatingPercent: 60,
      stateOfResidence: "Texas"
    };

    const onboardingResult = await createOrUpdateOnboarding(payload);
    assert.ok(onboardingResult.veteranId);

    const benefitsResult = await getOrComputeBenefits(onboardingResult.veteranId);
    assert.ok(benefitsResult.metadata);
    assert.ok(Array.isArray(benefitsResult.federal.items));
    assert.ok(Array.isArray(benefitsResult.exposure.items));
  });
}
