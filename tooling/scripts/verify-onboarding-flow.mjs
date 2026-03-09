import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "app", "frontend-modern", "src", "App.jsx");
const onboardingSchemaPath = path.join(root, "packages", "shared-data", "src", "constants", "onboardingSchema.js");
const logoPath = path.join(root, "public", "LOGO.png");

const errors = [];
const assert = (condition, message) => {
  if (!condition) {
    errors.push(message);
  }
};

const readText = (filePath) => fs.readFileSync(filePath, "utf8");
const appJsx = readText(appPath);
const schemaJs = readText(onboardingSchemaPath);

assert(fs.existsSync(appPath), "Missing app/frontend-modern/src/App.jsx");
assert(fs.existsSync(onboardingSchemaPath), "Missing shared onboarding schema constants");
assert(fs.existsSync(logoPath), "Missing public/LOGO.png asset");

// App routes should expose the military-service onboarding entry point.
assert(appJsx.includes("path='/military-service'"), "Missing /military-service route in App.jsx");
assert(appJsx.includes("MilitaryServicePage"), "Missing MilitaryServicePage route target");

// Shared onboarding schema should keep core validators present.
assert(schemaJs.includes("export const validateOnboarding"), "Missing validateOnboarding export");
assert(schemaJs.includes("servicePeriods must be a non-empty array"), "Missing servicePeriods validation");
assert(schemaJs.includes("branch must be a valid branch"), "Missing branch validation");
assert(schemaJs.includes("stateOfResidence must be a valid state"), "Missing stateOfResidence validation");

if (errors.length) {
  console.error("Onboarding flow verification failed:");
  errors.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log("Onboarding flow verification passed.");
