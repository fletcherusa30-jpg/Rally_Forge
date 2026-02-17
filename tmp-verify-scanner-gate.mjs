import { scanTextWithScanner } from "./backend/services/scannerService.js";

const decision =
  "Service connection for tinnitus is granted with an evaluation of 10 percent effective November 27, 2017. Service connection for migraines is denied because no nexus to military service.";
const cfr =
  "Title 38 of the Code of Federal Regulations Part 4 Schedule for Rating Disabilities authority: 38 U.S.C. 1155.";

const run = async () => {
  const ok = await scanTextWithScanner(decision);
  console.log("DECISION_OK", ok.serviceConnected.length >= 0);

  try {
    await scanTextWithScanner(cfr);
    console.log("CFR_UNEXPECTED_OK");
  } catch (error) {
    console.log("CFR_BLOCKED", error?.code || error?.message);
  }
};

await run();
