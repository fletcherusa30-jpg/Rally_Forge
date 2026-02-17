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
  moduleUrl.searchParams.set("v", Date.now().toString());
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

  try {
    const html = await loadTemplate(route.template);
    appRoot.innerHTML = html;

    if (route.module) {
      const module = await loadModule(route.module);
      if (typeof module.init === "function") {
        await Promise.resolve(module.init());
      }
    }
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    window.RallyForgeLastError = error;
    appRoot.innerHTML = `
      <div class="app-fallback">
        <div class="app-fallback-card">
          <h1>Welcome to Rally Forge</h1>
          <p>The onboarding flow could not load. Start the dev server and refresh this page.</p>
          <p>If you are opening a file directly, use the dev server URL instead.</p>
          <p><strong>Load error:</strong> ${message}</p>
          <div class="app-fallback-actions">
            <button class="primary" type="button" onclick="window.location.reload()">Retry load</button>
            <button class="ghost" type="button" onclick="window.location.hash = '#/onboarding'">Open onboarding</button>
          </div>
        </div>
      </div>
    `;
  }
};

export const initRouter = () => {
  window.addEventListener("hashchange", () => {
    renderRoute().catch((error) => console.error(error));
  });

  renderRoute().catch((error) => console.error(error));
};
