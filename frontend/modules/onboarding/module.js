import { BRANCHES, COMPONENTS, THEATERS } from "../../../packages/shared-data/src/constants/branches.js";
import { STATES } from "../../../packages/shared-data/src/constants/states.js";
import { AWARDS_LIST } from "../../../packages/shared-data/src/constants/awardsList.js";
import { postOnboarding } from "../../js/api.js";
import { getOnboardingResult, setOnboardingResult, setVeteranId } from "../../js/state.js";
import { createStepIndicator, updateStepIndicator } from "../common/module.js";

const STEPS = 6;

const isDebugEnabled = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("debug") === "1";
};

const ensureDebugPanel = (root) => {
  if (!isDebugEnabled()) {
    return null;
  }

  let panel = root.querySelector("[data-debug-panel]");
  if (panel) {
    return panel;
  }

  panel = document.createElement("div");
  panel.setAttribute("data-debug-panel", "");
  panel.style.cssText = "margin-top:16px;padding:12px;border:1px dashed #c4b7f2;border-radius:12px;background:#fff6f0;font-family:'Space Grotesk','Trebuchet MS',sans-serif;font-size:12px;color:#3a3e53;";
  root.appendChild(panel);
  return panel;
};

const updateDebugPanel = (root, form, stepIndex, isValid) => {
  const panel = ensureDebugPanel(root);
  if (!panel) {
    return;
  }

  const branch = getNamedValue(form, "branch");
  const component = getNamedValue(form, "component");
  const state = getNamedValue(form, "stateOfResidence");
  const combat = form.querySelector("input[name='combatSelfReported']:checked")?.value || "";
  const rating = form.querySelector("input[name='disabilityRatingKnown']:checked")?.value || "";
  const periods = Array.from(form.querySelectorAll(".service-period")).length;

  panel.innerHTML = `
    <div><strong>Debug:</strong> step ${stepIndex + 1}/${STEPS} | valid=${isValid}</div>
    <div>branch=${branch || "(empty)"} | component=${component || "(empty)"}</div>
    <div>periods=${periods} | combat=${combat || "(empty)"}</div>
    <div>ratingKnown=${rating || "(empty)"} | state=${state || "(empty)"}</div>
  `;
};

const createPeriodRow = (period = {}) => {
  const wrapper = document.createElement("div");
  wrapper.className = "service-period";

  wrapper.innerHTML = `
    <div class="period-header">
      <div class="period-title">Service period</div>
      <div class="period-actions">
        <label class="present-toggle">
          <input type="checkbox" data-present />
          <span>Present</span>
        </label>
        <button type="button" class="ghost" data-remove>Remove</button>
      </div>
    </div>
    <div class="period-fields">
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
    </div>
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

  const presentToggle = wrapper.querySelector("[data-present]");
  const endDateInput = wrapper.querySelector("input[name='endDate']");
  const isPresent = !period.endDate;
  presentToggle.checked = isPresent;
  endDateInput.disabled = isPresent;
  if (isPresent) {
    endDateInput.value = "";
  }

  return wrapper;
};

const updatePeriodLabels = (container) => {
  Array.from(container.querySelectorAll(".service-period")).forEach((row, index) => {
    const title = row.querySelector(".period-title");
    if (title) {
      title.textContent = `Service period ${index + 1}`;
    }
  });
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

const getNamedValue = (form, name) => {
  const field = form.elements.namedItem(name);
  if (!field) {
    return "";
  }
  return typeof field.value === "string" ? field.value : "";
};

const getFormData = (form) => {
  const periods = Array.from(form.querySelectorAll(".service-period")).map((row) => ({
    startDate: row.querySelector("input[name='startDate']").value,
    endDate: row.querySelector("[data-present]")?.checked
      ? null
      : row.querySelector("input[name='endDate']").value || null,
    theater: row.querySelector("select[name='theater']").value || null
  }));

  const ratingKnown = form.querySelector("input[name='disabilityRatingKnown']:checked")?.value;
  const ratingPercentRaw = form.disabilityRatingPercent.value;
  const ratingPercent = ratingPercentRaw ? Number(ratingPercentRaw) : null;

  return {
    branch: getNamedValue(form, "branch"),
    component: getNamedValue(form, "component"),
    servicePeriods: periods,
    combatSelfReported: form.querySelector("input[name='combatSelfReported']:checked")?.value || "",
    disabilityRatingKnown: ratingKnown === "yes",
    disabilityRatingPercent: ratingKnown === "yes" ? ratingPercent : null,
    stateOfResidence: getNamedValue(form, "stateOfResidence"),
    awards: Array.from(form.querySelectorAll("select[name='awards'] option:checked")).map(
      (option) => option.value
    )
  };
};

const setError = (form, field, message) => {
  const el = form.querySelector(`[data-error-for='${field}']`);
  if (el) {
    el.textContent = message || "";
  }

  const input = form.querySelector(`[name='${field}']`);
  if (input) {
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }
};

const focusFirstError = (form) => {
  const error = form.querySelector(".error:not(:empty)");
  if (!error) {
    return;
  }

  const field = error.getAttribute("data-error-for");
  const input = form.querySelector(`[name='${field}']`);
  if (input) {
    input.focus();
  }
};

const validateStep = (form, stepIndex) => {
  let valid = true;

  if (stepIndex === 0) {
    const branchValue = getNamedValue(form, "branch");
    const componentValue = getNamedValue(form, "component");

    if (!branchValue) {
      setError(form, "branch", "Select a branch.");
      valid = false;
    } else {
      setError(form, "branch", "");
    }

    if (!componentValue) {
      setError(form, "component", "Select a component.");
      valid = false;
    } else {
      setError(form, "component", "");
    }
  }

  if (stepIndex === 1) {
    const periods = Array.from(form.querySelectorAll(".service-period"));
    const hasPeriod = periods.every((row) => row.querySelector("input[name='startDate']").value);
    periods.forEach((row) => {
      const startInput = row.querySelector("input[name='startDate']");
      const isMissing = !startInput?.value;
      row.classList.toggle("is-invalid", isMissing);
      if (startInput) {
        startInput.setAttribute("aria-invalid", isMissing ? "true" : "false");
      }
    });
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
    if (!getNamedValue(form, "stateOfResidence")) {
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
  root.querySelector("[data-next]").disabled = false;
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
  updateDebugPanel(root, form, stepIndex, isValid);
};

const buildSummary = (root, payload) => {
  const summary = root.querySelector("[data-summary]");
  const periods = payload.servicePeriods
    .map((period) => `${period.startDate} to ${period.endDate || "Present"}${period.theater ? ` (${period.theater})` : ""}`)
    .join("\n");
  const awardLabels = (payload.awards || [])
    .map((awardId) => AWARDS_LIST.find((award) => award.id === awardId)?.name || awardId)
    .join(", ");
  summary.innerHTML = `
    <div class="summary-row"><strong>Branch:</strong> ${payload.branch}</div>
    <div class="summary-row"><strong>Component:</strong> ${payload.component}</div>
    <div class="summary-row"><strong>Service periods:</strong></div>
    <pre>${periods}</pre>
    <div class="summary-row"><strong>Combat self-report:</strong> ${payload.combatSelfReported}</div>
    <div class="summary-row"><strong>Disability rating:</strong> ${payload.disabilityRatingKnown ? payload.disabilityRatingPercent + "%" : "Not sure"}</div>
    <div class="summary-row"><strong>State of residence:</strong> ${payload.stateOfResidence}</div>
    <div class="summary-row"><strong>Awards:</strong> ${awardLabels || "None selected"}</div>
  `;
};

const persistDraft = (form) => {
  setOnboardingResult(getFormData(form));
};

const hydrateDraft = (form, draft) => {
  if (!draft) {
    return;
  }

  const branchField = form.elements.namedItem("branch");
  const componentField = form.elements.namedItem("component");
  const stateField = form.elements.namedItem("stateOfResidence");

  if (branchField) {
    branchField.value = draft.branch || "";
  }
  if (componentField) {
    componentField.value = draft.component || "";
  }
  if (stateField) {
    stateField.value = draft.stateOfResidence || "";
  }

  if (Array.isArray(draft.awards)) {
    const selected = new Set(draft.awards);
    Array.from(form.querySelectorAll("select[name='awards'] option")).forEach((option) => {
      option.selected = selected.has(option.value);
    });
  }

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


const awardCategoryLabels = {
  combat_award: "Combat awards",
  valor_award: "Valor awards",
  campaign_medal: "Campaign medals",
  hazardous_duty_badge: "Hazardous duty badges",
  service_medal: "Service medals",
  medical_related_award: "Medical-related awards",
  high_honor_award: "High honor awards",
  unit_award: "Unit awards",
  rare_award: "Rare awards"
};

const populateAwards = (select) => {
  select.innerHTML = "";
  const groups = new Map();

  AWARDS_LIST.forEach((award) => {
    if (!groups.has(award.category)) {
      const label = awardCategoryLabels[award.category] || award.category;
      const group = document.createElement("optgroup");
      group.label = label;
      groups.set(award.category, group);
    }
    const option = document.createElement("option");
    option.value = award.id;
    option.textContent = award.name;
    groups.get(award.category).appendChild(option);
  });

  groups.forEach((group) => select.appendChild(group));
};

const filterAwards = (select, query, statusEl) => {
  const normalized = query.trim().toLowerCase();
  let visibleCount = 0;
  const options = Array.from(select.querySelectorAll("option"));
  options.forEach((option) => {
    const match = !normalized || option.textContent.toLowerCase().includes(normalized);
    option.hidden = !match;
    if (match) {
      visibleCount += 1;
    }
  });

  Array.from(select.querySelectorAll("optgroup")).forEach((group) => {
    const groupOptions = Array.from(group.querySelectorAll("option"));
    group.hidden = groupOptions.every((option) => option.hidden);
  });

  if (statusEl) {
    statusEl.textContent = normalized
      ? `Showing ${visibleCount} matching awards`
      : "Showing all awards";
  }
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

  const draft = getOnboardingResult();

  populateSelect(form.branch, BRANCHES);
  populateSelect(form.component, COMPONENTS);
  populateSelect(form.stateOfResidence, STATES);
  populateAwards(form.awards);

  const periodsContainer = form.querySelector("#service-periods");
  const addPeriodButton = form.querySelector("[data-add-period]");
  const ratingPercentInput = form.querySelector("input[name='disabilityRatingPercent']");
  const awardsSearch = form.querySelector("[data-awards-search]");
  const awardsStatus = form.querySelector("[data-awards-status]");

  if (draft?.servicePeriods?.length) {
    hydrateDraft(form, draft);
  } else {
    periodsContainer.appendChild(createPeriodRow());
  }
  updatePeriodLabels(periodsContainer);

  let currentStep = 0;
  showStep(root, currentStep, form, indicator);

  addPeriodButton.addEventListener("click", () => {
    periodsContainer.appendChild(createPeriodRow());
    updatePeriodLabels(periodsContainer);
    persistDraft(form);
  });

  periodsContainer.addEventListener("click", (event) => {
    if (event.target.matches("[data-remove]")) {
      event.target.closest(".service-period").remove();
      updatePeriodLabels(periodsContainer);
      persistDraft(form);
      showStep(root, currentStep, form, indicator);
    }
  });

  periodsContainer.addEventListener("change", (event) => {
    if (event.target.matches("[data-present]")) {
      const row = event.target.closest(".service-period");
      const endDateInput = row?.querySelector("input[name='endDate']");
      if (endDateInput) {
        endDateInput.disabled = event.target.checked;
        if (event.target.checked) {
          endDateInput.value = "";
        }
      }
    }
  });

  form.addEventListener("input", () => {
    persistDraft(form);
    showStep(root, currentStep, form, indicator);
  });

  form.addEventListener("change", (event) => {
    if (event.target.name === "disabilityRatingKnown") {
      const isKnown = event.target.value === "yes";
      ratingPercentInput.disabled = !isKnown;
      if (!isKnown) {
        ratingPercentInput.value = "";
      }
    }

    persistDraft(form);
    showStep(root, currentStep, form, indicator);
  });

  if (awardsSearch) {
    awardsSearch.addEventListener("input", (event) => {
      filterAwards(form.awards, event.target.value, awardsStatus);
    });
    filterAwards(form.awards, "", awardsStatus);
  }

  form.querySelector("[data-next]").addEventListener("click", () => {
    if (!validateStep(form, currentStep)) {
      updateButtons(root, currentStep, false);
      focusFirstError(form);
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
    showStep(root, currentStep, form, indicator);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = getFormData(form);
    buildSummary(root, payload);

    status.textContent = "Submitting your onboarding details...";

    try {
      const response = await postOnboarding(payload);
      setVeteranId(response.veteranId);
      setOnboardingResult(payload);
      status.textContent = "Onboarding complete. Redirecting...";
      window.location.hash = "#/results";
      setTimeout(() => {
        if (window.location.hash !== "#/results") {
          window.location.hash = "#/results";
        }
      }, 500);
    } catch (error) {
      status.textContent = error.message || "Unable to submit onboarding.";
    }
  });
};
