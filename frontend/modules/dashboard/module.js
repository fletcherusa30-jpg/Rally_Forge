import { getOnboardingResult, getVeteranId } from "../../js/state.js";
import { getBenefits } from "../../js/api.js";
import {
  buildActionPlan,
  computeReadiness,
  ensurePlanState,
  getPlanState,
  savePlanState,
  sortPlanItems
} from "../../js/plan.js";

const renderProfile = (container, onboardingResult) => {
  const periods = onboardingResult?.servicePeriods || [];
  const periodLabel = periods.length === 1 ? "period" : "periods";

  container.innerHTML = `
    <div class="stat-row"><strong>Branch</strong><span>${onboardingResult.branch}</span></div>
    <div class="stat-row"><strong>Component</strong><span>${onboardingResult.component}</span></div>
    <div class="stat-row"><strong>Service</strong><span>${periods.length} ${periodLabel}</span></div>
    <div class="stat-row"><strong>State</strong><span>${onboardingResult.stateOfResidence}</span></div>
  `;
};

const renderSummary = (container, benefitsResult) => {
  const categories = [
    benefitsResult.federal,
    benefitsResult.state,
    benefitsResult.combat,
    benefitsResult.exposure,
    benefitsResult.rating,
    benefitsResult.retirement
  ];

  const totalItems = categories.reduce((count, data) => {
    const items = Array.isArray(data?.items) ? data.items : [];
    return count + items.length;
  }, 0);

  container.innerHTML = `
    <div class="stat-row"><strong>Total Recommendations</strong><span>${totalItems}</span></div>
    <div class="stat-row"><strong>Computed At</strong><span>${benefitsResult.metadata?.computedAt || "Unknown"}</span></div>
    <div class="stat-row"><strong>Categories</strong><span>${categories.length}</span></div>
  `;
};

const renderPlan = (summaryContainer, listContainer, benefitsResult, onboardingResult) => {
  const planItems = sortPlanItems(buildActionPlan(benefitsResult, onboardingResult));
  const planState = ensurePlanState(planItems, getPlanState());
  savePlanState(planState);

  const readiness = computeReadiness(planItems, planState);
  const totalTasks = planItems.reduce((count, item) => count + 1 + item.fullChecklist.length, 0);
  const completedTasks = planItems.reduce((count, item) => {
    const state = planState.items[item.id] || { done: false, checklist: {} };
    let completed = state.done ? 1 : 0;
    item.fullChecklist.forEach((_, index) => {
      if (state.checklist?.[index]) {
        completed += 1;
      }
    });
    return count + completed;
  }, 0);

  summaryContainer.innerHTML = `
    <div class="stat-row"><strong>Readiness</strong><span>${readiness}%</span></div>
    <div class="stat-row"><strong>Tasks Complete</strong><span>${completedTasks}/${totalTasks}</span></div>
    <div class="stat-row"><strong>Next Focus</strong><span>${planItems[0]?.priority || "Soon"}</span></div>
  `;

  const topItems = planItems.slice(0, 3);
  if (!topItems.length) {
    listContainer.innerHTML = "<li>No action items yet.</li>";
    return;
  }

  listContainer.innerHTML = topItems
    .map((item) => {
      const link = item.link
        ? `<a href="${item.link}" target="_blank" rel="noreferrer">Open resource</a>`
        : "";
      return `
        <li>
          <div class="plan-list-title">${item.title}</div>
          <div class="plan-list-meta">
            <span>${item.category}</span>
            <span>${item.priority}</span>
          </div>
          ${link}
        </li>
      `;
    })
    .join("");
};

export const init = () => {
  const root = document.querySelector("[data-dashboard]");
  if (!root) {
    return;
  }

  const onboardingResult = getOnboardingResult();
  const veteranId = getVeteranId();

  if (!onboardingResult || !veteranId) {
    window.location.hash = "#/onboarding";
    return;
  }

  const profileDetails = root.querySelector("[data-profile-details]");
  const summaryDetails = root.querySelector("[data-summary-details]");
  const planSummary = root.querySelector("[data-plan-summary]");
  const planList = root.querySelector("[data-plan-list]");
  const printButton = root.querySelector("[data-print]");

  renderProfile(profileDetails, onboardingResult);

  getBenefits(veteranId)
    .then((benefitsResult) => {
      renderSummary(summaryDetails, benefitsResult);
      renderPlan(planSummary, planList, benefitsResult, onboardingResult);
    })
    .catch(() => {
      summaryDetails.textContent = "Unable to load benefits summary.";
      planSummary.textContent = "Unable to load plan summary.";
    });

  if (printButton) {
    printButton.addEventListener("click", () => {
      window.print();
    });
  }
};
