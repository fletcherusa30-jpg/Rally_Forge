import { getOnboardingResult, getVeteranId } from "../../js/state.js";
import { getBenefits } from "../../js/api.js";

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

  renderProfile(profileDetails, onboardingResult);

  getBenefits(veteranId)
    .then((benefitsResult) => renderSummary(summaryDetails, benefitsResult))
    .catch(() => {
      summaryDetails.textContent = "Unable to load benefits summary.";
    });
};
