import { BRANCHES, COMPONENTS, THEATERS } from "../../../shared/constants/branches.js";
import { STATES } from "../../../shared/constants/states.js";
import { postOnboarding } from "../../js/api.js";
import { getOnboardingResult, setOnboardingResult } from "../../js/state.js";
import { createStepIndicator, updateStepIndicator } from "../common/module.js";

const STEPS = 6;
const VETERAN_KEY = "rallyforge:veteranId";

const createPeriodRow = (period = {}) => {
  const wrapper = document.createElement("div");
  wrapper.className = "service-period";

  wrapper.innerHTML = `
    <label>
      Start date
      <input type="date" name="startDate" required value="${period.startDate || ""}" />
    </label>
    <label>
      End date
      <input type="date" name="endDate" value="${period.endDate || ""}" />
    </label>
    <label>
      Theater
      <select name="theater"></select>
    </label>
    <button type="button" class="ghost" data-remove>Remove</button>
  `;

  const theaterSelect = wrapper.querySelector("select[name='theater']");
  theaterSelect.innerHTML = "<option value=\"\">Select</option>";
  THEATERS.forEach((theater) => {
    const option = document.createElement("option");
    option.value = theater;
    option.textContent = theater;
    theaterSelect.appendChild(option);
  });
  theaterSelect.value = period.theater || "";

  return wrapper;
};

const populateSelect = (select, options) => {
  select.innerHTML = "<option value=\"\">Select</option>";
  options.forEach((option) => {
    const el = document.createElement("option");
    el.value = option;
    el.textContent = option;
    select.appendChild(el);
  });
};

const getFormData = (form) => {
  const periods = Array.from(form.querySelectorAll(".service-period")).map((row) => ({
    startDate: row.querySelector("input[name='startDate']").value,
    endDate: row.querySelector("input[name='endDate']").value || null,
    theater: row.querySelector("select[name='theater']").value || null
  }));

  const ratingKnown = form.querySelector("input[name='disabilityRatingKnown']:checked")?.value;
  const ratingPercentRaw = form.disabilityRatingPercent.value;
  const ratingPercent = ratingPercentRaw ? Number(ratingPercentRaw) : null;

  return {
    branch: form.branch.value,
    component: form.component.value,
    servicePeriods: periods,
    combatSelfReported: form.querySelector("input[name='combatSelfReported']:checked")?.value || "",
    disabilityRatingKnown: ratingKnown === "yes",
    disabilityRatingPercent: ratingKnown === "yes" ? ratingPercent : null,
    stateOfResidence: form.stateOfResidence.value
  };
};

const setError = (form, field, message) => {
  const el = form.querySelector(`[data-error-for='${field}']`);
  if (el) {
    el.textContent = message || "";
  }
};

const validateStep = (form, stepIndex) => {
  let valid = true;

  if (stepIndex === 0) {
    if (!form.branch.value) {
      setError(form, "branch", "Select a branch.");
      valid = false;
    } else {
      setError(form, "branch", "");
    }

    if (!form.component.value) {
      setError(form, "component", "Select a component.");
      valid = false;
    } else {
      setError(form, "component", "");
    }
  }

  if (stepIndex === 1) {
    const periods = Array.from(form.querySelectorAll(".service-period"));
    const hasPeriod = periods.every((row) => row.querySelector("input[name='startDate']").value);
    if (!periods.length || !hasPeriod) {
      setError(form, "servicePeriods", "Add at least one service period with a start date.");
      valid = false;
    } else {
      setError(form, "servicePeriods", "");
    }
  }

  if (stepIndex === 2) {
    const selected = form.querySelector("input[name='combatSelfReported']:checked");
    if (!selected) {
      setError(form, "combatSelfReported", "Select an option.");
      valid = false;
    } else {
      setError(form, "combatSelfReported", "");
    }
  }

  if (stepIndex === 3) {
    const ratingKnown = form.querySelector("input[name='disabilityRatingKnown']:checked");
    if (!ratingKnown) {
      setError(form, "disabilityRatingKnown", "Select an option.");
      valid = false;
    } else {
      setError(form, "disabilityRatingKnown", "");
    }

    if (ratingKnown?.value === "yes") {
      const rating = Number(form.disabilityRatingPercent.value);
      if (Number.isNaN(rating) || rating < 0 || rating > 100) {
        setError(form, "disabilityRatingPercent", "Rating must be between 0 and 100.");
        valid = false;
      } else {
        setError(form, "disabilityRatingPercent", "");
      }
    } else {
      setError(form, "disabilityRatingPercent", "");
    }
  }

  if (stepIndex === 4) {
    if (!form.stateOfResidence.value) {
      setError(form, "stateOfResidence", "Select a state or territory.");
      valid = false;
    } else {
      setError(form, "stateOfResidence", "");
    }
  }

  return valid;
};

const updateButtons = (root, stepIndex, isValid) => {
  root.querySelector("[data-prev]").disabled = stepIndex === 0;
  root.querySelector("[data-next]").style.display = stepIndex === STEPS - 1 ? "none" : "inline-flex";
  root.querySelector("[data-submit]").style.display = stepIndex === STEPS - 1 ? "inline-flex" : "none";
  root.querySelector("[data-next]").disabled = !isValid;
};

const showStep = (root, stepIndex, form, indicator) => {
  root.querySelectorAll(".step").forEach((step, index) => {
    step.classList.toggle("active", index === stepIndex);
  });

  if (indicator) {
    updateStepIndicator(indicator, stepIndex);
  }

  const isValid = validateStep(form, stepIndex);
  updateButtons(root, stepIndex, isValid);
};

const buildSummary = (root, payload) => {
  const summary = root.querySelector("[data-summary]");
  const periods = payload.servicePeriods
    .map((period) => `${period.startDate} to ${period.endDate || "Present"}${period.theater ? ` (${period.theater})` : ""}`)
    .join("\n");

  summary.innerHTML = `
    <strong>Branch:</strong> ${payload.branch}<br />
    <strong>Component:</strong> ${payload.component}<br />
    <strong>Service periods:</strong><br />
    <pre>${periods}</pre>
    <strong>Combat self-report:</strong> ${payload.combatSelfReported}<br />
    <strong>Disability rating:</strong> ${payload.disabilityRatingKnown ? payload.disabilityRatingPercent + "%" : "Not sure"}<br />
    <strong>State of residence:</strong> ${payload.stateOfResidence}
  `;
};

const persistDraft = (form) => {
  setOnboardingResult(getFormData(form));
};

const hydrateDraft = (form, draft) => {
  if (!draft) {
    return;
  }

  form.branch.value = draft.branch || "";
  form.component.value = draft.component || "";
  form.stateOfResidence.value = draft.stateOfResidence || "";

  if (draft.combatSelfReported) {
    const combat = form.querySelector(`input[name='combatSelfReported'][value='${draft.combatSelfReported}']`);
    if (combat) {
      combat.checked = true;
    }
  }

  if (draft.disabilityRatingKnown === true) {
    const ratingKnown = form.querySelector("input[name='disabilityRatingKnown'][value='yes']");
    if (ratingKnown) {
      ratingKnown.checked = true;
    }
    form.disabilityRatingPercent.value = draft.disabilityRatingPercent ?? "";
  } else if (draft.disabilityRatingKnown === false) {
    const ratingUnknown = form.querySelector("input[name='disabilityRatingKnown'][value='no']");
    if (ratingUnknown) {
      ratingUnknown.checked = true;
    }
  }

  const container = form.querySelector("#service-periods");
  container.innerHTML = "";
  (draft.servicePeriods || []).forEach((period) => {
    container.appendChild(createPeriodRow(period));
  });
};

export const init = () => {
  const root = document.querySelector("[data-onboarding]");
  if (!root) {
    return;
  }

  const form = root.querySelector("#onboarding-form");
  const status = root.querySelector("[data-status]");
  const progressContainer = root.querySelector("[data-progress-container]");

  const indicator = createStepIndicator(STEPS);
  progressContainer.appendChild(indicator);

  populateSelect(form.branch, BRANCHES);
  populateSelect(form.component, COMPONENTS);
  populateSelect(form.stateOfResidence, STATES);

  const periodsContainer = form.querySelector("#service-periods");
  const addPeriodButton = form.querySelector("[data-add-period]");

  const draft = getOnboardingResult();
  if (draft?.servicePeriods?.length) {
    hydrateDraft(form, draft);
  } else {
    periodsContainer.appendChild(createPeriodRow());
  }

  let currentStep = 0;
  showStep(root, currentStep, form, indicator);

  addPeriodButton.addEventListener("click", () => {
    periodsContainer.appendChild(createPeriodRow());
    persistDraft(form);
  });

  periodsContainer.addEventListener("click", (event) => {
    if (event.target.matches("[data-remove]")) {
      event.target.closest(".service-period").remove();
      persistDraft(form);
      showStep(root, currentStep, form, indicator);
    }
  });

  form.addEventListener("input", () => {
    persistDraft(form);
    showStep(root, currentStep, form, indicator);
  });

  form.querySelector("[data-next]").addEventListener("click", () => {
    if (!validateStep(form, currentStep)) {
      updateButtons(root, currentStep, false);
      return;
    }

    if (currentStep === STEPS - 2) {
      buildSummary(root, getFormData(form));
    }

    currentStep = Math.min(STEPS - 1, currentStep + 1);
    showStep(root, currentStep, form, indicator);
  });

  form.querySelector("[data-prev]").addEventListener("click", () => {
    currentStep = Math.max(0, currentStep - 1);
    showStep(root, currentStep, form);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = getFormData(form);
    buildSummary(root, payload);

    status.textContent = "Submitting your onboarding details...";

    try {
      const response = await postOnboarding(payload);
      localStorage.setItem(VETERAN_KEY, response.veteranId);
      setOnboardingResult(payload);
      status.textContent = "Onboarding complete. Redirecting...";
      window.location.hash = "#/results";
    } catch (error) {
      status.textContent = error.message || "Unable to submit onboarding.";
    }
  });
};
