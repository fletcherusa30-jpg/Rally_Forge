import { BRANCHES, COMPONENTS, THEATERS } from "../constants/branches.js";
import { STATES } from "../constants/states.js";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const isIsoDate = (value) => {
  if (typeof value !== "string" || !ISO_DATE_REGEX.test(value)) {
    return false;
  }

  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
};

const validateServicePeriod = (period, index) => {
  const errors = [];

  if (!period || typeof period !== "object") {
    errors.push(`servicePeriods[${index}] must be an object`);
    return errors;
  }

  if (!isIsoDate(period.startDate)) {
    errors.push(`servicePeriods[${index}].startDate must be YYYY-MM-DD`);
  }

  if (period.endDate !== null && period.endDate !== undefined && !isIsoDate(period.endDate)) {
    errors.push(`servicePeriods[${index}].endDate must be YYYY-MM-DD or null`);
  }

  if (period.theater && !THEATERS.includes(period.theater)) {
    errors.push(`servicePeriods[${index}].theater must be a valid theater`);
  }

  return errors;
};

export const validateOnboarding = (payload) => {
  const errors = [];

  if (!payload || typeof payload !== "object") {
    return { valid: false, errors: ["onboarding payload must be an object"] };
  }

  if (!BRANCHES.includes(payload.branch)) {
    errors.push("branch must be a valid branch");
  }

  if (!COMPONENTS.includes(payload.component)) {
    errors.push("component must be a valid component");
  }

  if (!Array.isArray(payload.servicePeriods) || payload.servicePeriods.length === 0) {
    errors.push("servicePeriods must be a non-empty array");
  } else {
    payload.servicePeriods.forEach((period, index) => {
      errors.push(...validateServicePeriod(period, index));
    });
  }

  if (!["yes", "no", "not_sure"].includes(payload.combatSelfReported)) {
    errors.push("combatSelfReported must be yes, no, or not_sure");
  }

  if (typeof payload.disabilityRatingKnown !== "boolean") {
    errors.push("disabilityRatingKnown must be a boolean");
  }

  if (
    payload.disabilityRatingPercent !== null &&
    payload.disabilityRatingPercent !== undefined &&
    typeof payload.disabilityRatingPercent !== "number"
  ) {
    errors.push("disabilityRatingPercent must be a number or null");
  }

  if (!STATES.includes(payload.stateOfResidence)) {
    errors.push("stateOfResidence must be a valid state or territory");
  }

  return { valid: errors.length === 0, errors };
};
