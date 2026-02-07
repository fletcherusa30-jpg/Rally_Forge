import { getOnboardingResult } from "../../js/state.js";
import { getBenefits } from "../../js/api.js";

const VETERAN_KEY = "rallyforge:veteranId";

const renderCategory = (title, data) => {
  const wrapper = document.createElement("div");
  wrapper.className = "rf-card results-item";
  const pretty = JSON.stringify(data, null, 2);

  wrapper.innerHTML = `
    <h3>${title}</h3>
    <pre>${pretty}</pre>
  `;

  return wrapper;
};

export const init = async () => {
  const root = document.querySelector("[data-results]");
  if (!root) {
    return;
  }

  const onboardingResult = getOnboardingResult();
  const veteranId = localStorage.getItem(VETERAN_KEY);

  if (!onboardingResult || !veteranId) {
    window.location.hash = "#/onboarding";
    return;
  }

  const body = root.querySelector("[data-results-body]");
  body.textContent = "Loading benefits...";

  try {
    const benefitsResult = await getBenefits(veteranId);
    const grid = document.createElement("div");
    grid.className = "results-grid";

    [
      ["Federal", benefitsResult.federal],
      ["State", benefitsResult.state],
      ["Combat", benefitsResult.combat],
      ["Exposure", benefitsResult.exposure],
      ["Rating", benefitsResult.rating],
      ["Retirement", benefitsResult.retirement],
      ["Metadata", benefitsResult.metadata]
    ].forEach(([title, data]) => {
      grid.appendChild(renderCategory(title, data || {}));
    });

    body.replaceWith(grid);
  } catch (error) {
    body.textContent = error.message || "Failed to load benefits.";
  }
};
