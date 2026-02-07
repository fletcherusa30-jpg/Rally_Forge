import { getOnboardingResult } from "../../js/state.js";

export const init = () => {
  const root = document.querySelector("[data-dashboard]");
  if (!root) {
    return;
  }

  if (!getOnboardingResult()) {
    window.location.hash = "#/onboarding";
  }
};
