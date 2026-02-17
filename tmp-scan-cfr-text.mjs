import fs from "node:fs";
import { parseVADecisionScanner } from "./backend/engine/scanner/vaDecisionScanner.js";
import { validateScannerOutput } from "./backend/engine/scanner/scannerMiddleware.js";

const files = ["_tmp_38cfr_part3.txt", "_tmp_38cfr_part4.txt"];

for (const sourceFile of files) {
  const text = fs.readFileSync(sourceFile, "utf8");
  const result = validateScannerOutput(parseVADecisionScanner(text));

  console.log(
    JSON.stringify({
      sourceFile,
      serviceConnected: result.serviceConnected.length,
      denied: result.denied.length,
      allConditions: result.allConditions.length,
      zeroPercent: result.serviceConnected.filter((x) => Number(x.percentage) === 0).length,
      sampleServiceConnected: result.serviceConnected.slice(0, 5).map((x) => ({
        condition: x.condition,
        percentage: x.percentage
      })),
      sampleDenied: result.denied.slice(0, 5).map((x) => ({
        condition: x.condition,
        reason: String(x.reason ?? x.reason_for_denial ?? "").slice(0, 120)
      }))
    })
  );
}
