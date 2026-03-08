import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexPath = path.join(root, "frontend", "modules", "onboarding", "index.html");
const modulePath = path.join(root, "frontend", "modules", "onboarding", "module.js");
const logoPath = path.join(root, "frontend", "LOGO.png");

const errors = [];
const assert = (condition, message) => {
  if (!condition) {
    errors.push(message);
  }
};

const readText = (filePath) => fs.readFileSync(filePath, "utf8");
const html = readText(indexPath);
const js = readText(modulePath);

const stepMatches = [...html.matchAll(/data-step="(\d+)"/g)].map((m) => Number(m[1]));
const steps = new Set(stepMatches);
const expectedSteps = [0, 1, 2, 3, 4];
expectedSteps.forEach((step) => {
  assert(steps.has(step), `Missing data-step=\"${step}\" section in index.html`);
});

assert(html.includes("data-onboarding"), "Missing data-onboarding root attribute");
assert(html.includes("data-prev"), "Missing [data-prev] button");
assert(html.includes("data-next"), "Missing [data-next] button");
assert(html.includes("data-submit"), "Missing [data-submit] button");
assert(html.includes("data-status"), "Missing [data-status] status container");
assert(html.includes("id=\"service-periods\""), "Missing #service-periods container");
assert(html.includes("id=\"awards-select\""), "Missing #awards-select element");
assert(html.includes("id=\"rating-upload-input\""), "Missing #rating-upload-input file input");

assert(fs.existsSync(logoPath), "Missing frontend/LOGO.png asset");
assert(js.includes("window.RFOnboardingNav"), "Missing RFOnboardingNav setup in module.js");
assert(js.includes("setWizardIndex"), "Missing setWizardIndex usage in module.js");

if (errors.length) {
  console.error("Onboarding flow verification failed:");
  errors.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log("Onboarding flow verification passed.");
