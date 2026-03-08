import fs from "fs";
import { scanVaDecision } from "../../VA SCANNER/engine/vaSuperScanner.js";

const text = fs.readFileSync("extracted-claimsletter-full.txt", "utf8");
const data = scanVaDecision(text);

fs.writeFileSync("claimsletter-scan.json", JSON.stringify(data, null, 2));

const sc = Array.isArray(data.serviceConnected) ? data.serviceConnected : [];
const denied = Array.isArray(data.denied) ? data.denied : [];

const lines = ["Category,Condition,Value,Details,Effective Date"];
sc.forEach((item) => {
  const name = String(item.condition || "").replace(/"/g, '""');
  const date = String(item.effectiveDate || "").replace(/"/g, '""');
  lines.push(`Service-Connected,"${name}",${item.percentage}%,,"${date}"`);
});

denied.forEach((item) => {
  const name = String(item.condition || "").replace(/"/g, '""');
  const reason = String(item.reason || "").replace(/"/g, '""');
  lines.push(`Denied,"${name}",,"${reason}",`);
});

fs.writeFileSync("claimsletter-scan.csv", lines.join("\n"));

const report = [];
report.push("VA DECISION LETTER - SCAN RESULTS");
report.push("");
if (data.metadata) {
  report.push(`Veteran: ${data.metadata.veteranName || "Unknown"}`);
  report.push(`File Number: ${data.metadata.fileNumber || "Unknown"}`);
  report.push(`Decision Date: ${data.metadata.decisionDate || "Unknown"}`);
  report.push(`Combined Rating: ${data.metadata.combinedRating || "Unknown"}`);
  report.push("");
}

if (sc.length) {
  report.push(`SERVICE-CONNECTED (${sc.length}):`);
  sc.forEach((item, i) => {
    report.push(`  ${i + 1}. ${item.condition} - ${item.percentage}%`);
  });
  report.push("");
}

if (denied.length) {
  report.push(`DENIED (${denied.length}):`);
  denied.forEach((item, i) => {
    report.push(`  ${i + 1}. ${item.condition} - ${item.reason || "Reason not listed"}`);
  });
  report.push("");
}

fs.writeFileSync("claimsletter-scan.txt", report.join("\n"));

console.log("Wrote claimsletter-scan.json/csv/txt");
