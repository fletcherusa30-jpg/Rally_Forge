import { getOnboardingResult } from "./state.js";

const routes = {
  "#/onboarding": {
    template: "modules/onboarding/index.html",
    module: "modules/onboarding/module.js",
    protected: false
  },
  "#/results": {
    template: "modules/results/index.html",
    module: "modules/results/module.js",
    protected: true
  },
  "#/dashboard": {
    template: "modules/dashboard/index.html",
    module: "modules/dashboard/module.js",
    protected: true
  }
};

const loadTemplate = async (templatePath) => {
  const response = await fetch(templatePath, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load template: ${templatePath}`);
  }

  return response.text();
};

const loadModule = async (modulePath) => {
  const moduleUrl = new URL(modulePath, window.location.href);
  return import(moduleUrl.href);
};

const guardRoute = (route) => {
  if (route.protected && !getOnboardingResult()) {
    window.location.hash = "#/onboarding";
    return false;
  }

  return true;
};

const renderRoute = async () => {
  const appRoot = document.querySelector("#app");
  if (!appRoot) {
    return;
  }

  const hash = window.location.hash || "#/onboarding";
  const route = routes[hash] || routes["#/onboarding"];

  if (!guardRoute(route)) {
    return;
  }

  const html = await loadTemplate(route.template);
  appRoot.innerHTML = html;

  if (route.module) {
    const module = await loadModule(route.module);
    if (typeof module.init === "function") {
      module.init();
    }
  }
};

export const initRouter = () => {
  window.addEventListener("hashchange", () => {
    renderRoute().catch((error) => console.error(error));
  });

  renderRoute().catch((error) => console.error(error));
};
