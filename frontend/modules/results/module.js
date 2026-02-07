import { getOnboardingResult, getVeteranId } from "../../js/state.js";
import { getBenefits, recalcBenefits } from "../../js/api.js";


const normalizeCategory = (data) => {
  const items = Array.isArray(data?.items) ? data.items : [];
  const notes = Array.isArray(data?.notes) ? data.notes : [];

  return {
    rulesVersion: data?.rulesVersion || "unknown",
    items,
    notes
  };
};

const formatItem = (item) => {
  if (!item || typeof item !== "object") {
    return { title: "Benefit option", description: "", link: "" };
  }

  return {
    title: item.title || item.name || "Benefit option",
    description: item.description || item.summary || "",
    link: item.url || item.link || ""
  };
};

const renderSummary = (totals) => {
  const wrapper = document.createElement("div");
  wrapper.className = "results-summary";

  wrapper.innerHTML = `
    <div class="rf-card summary-card">
      <h2>Total Recommendations</h2>
      <p class="summary-value">${totals.totalItems}</p>
    </div>
    <div class="rf-card summary-card">
      <h2>Categories Reviewed</h2>
      <p class="summary-value">${totals.categories}</p>
    </div>
    <div class="rf-card summary-card">
      <h2>Last Computed</h2>
      <p class="summary-value">${totals.computedAt}</p>
    </div>
  `;

  return wrapper;
};

const renderCategory = (title, data) => {
  const wrapper = document.createElement("div");
  wrapper.className = "rf-card results-item";
  const normalized = normalizeCategory(data);
  const eligible = normalized.items.length > 0;
  const badgeText = eligible ? "Eligible" : "Review";
  const badgeClass = eligible ? "eligible" : "review";

  const itemsHtml = normalized.items.length
    ? normalized.items
        .map((item) => {
          const formatted = formatItem(item);
          const description = formatted.description
            ? `<span class="item-description">${formatted.description}</span>`
            : "";
          const link = formatted.link
            ? `<a class="item-link" href="${formatted.link}" target="_blank" rel="noreferrer">Learn more</a>`
            : "";

          return `
            <li>
              <div class="item-title">${formatted.title}</div>
              ${description}
              ${link}
            </li>
          `;
        })
        .join("")
    : "<li>No recommendations yet.</li>";

  const notesHtml = normalized.notes.length
    ? normalized.notes.map((note) => `<li>${note}</li>`).join("")
    : "<li>No notes available.</li>";

  wrapper.innerHTML = `
    <div class="results-item-header">
      <div>
        <span class="category-tag">${title}</span>
        <h3>${title} Benefits</h3>
      </div>
      <div class="results-item-badges">
        <span class="badge ${badgeClass}">${badgeText}</span>
        <span class="pill">Rules v${normalized.rulesVersion}</span>
      </div>
    </div>
    <div class="results-item-body">
      <div>
        <h4>Recommendations</h4>
        <ul>${itemsHtml}</ul>
      </div>
      <div>
        <h4>Notes</h4>
        <ul>${notesHtml}</ul>
      </div>
    </div>
  `;

  return wrapper;
};

const renderMetadata = (metadata) => {
  const wrapper = document.createElement("div");
  wrapper.className = "rf-card results-item";

  const ruleVersions = metadata?.ruleVersions || {};
  const versionLines = Object.entries(ruleVersions)
    .map(([key, value]) => `<li>${key}: ${value}</li>`)
    .join("") || "<li>No version data.</li>";

  wrapper.innerHTML = `
    <div class="results-item-header">
      <h3>Metadata</h3>
      <span class="pill">Computed</span>
    </div>
    <div class="results-item-body">
      <div>
        <h4>Computed At</h4>
        <p>${metadata?.computedAt || "Unknown"}</p>
      </div>
      <div>
        <h4>Rule Versions</h4>
        <ul>${versionLines}</ul>
      </div>
    </div>
  `;

  return wrapper;
};

const renderResults = (body, benefitsResult) => {
  const grid = document.createElement("div");
  grid.className = "results-grid";

  const categories = [
    ["Federal", benefitsResult.federal],
    ["State", benefitsResult.state],
    ["Combat", benefitsResult.combat],
    ["Exposure", benefitsResult.exposure],
    ["Rating", benefitsResult.rating],
    ["Retirement", benefitsResult.retirement]
  ];

  const totalItems = categories.reduce((count, [, data]) => {
    const items = Array.isArray(data?.items) ? data.items : [];
    return count + items.length;
  }, 0);

  const summary = renderSummary({
    totalItems,
    categories: categories.length,
    computedAt: benefitsResult.metadata?.computedAt || "Unknown"
  });

  grid.appendChild(summary);

  categories.forEach(([title, data]) => {
    grid.appendChild(renderCategory(title, data || {}));
  });

  grid.appendChild(renderMetadata(benefitsResult.metadata || {}));

  body.replaceWith(grid);
  return grid;
};

export const init = async () => {
  const root = document.querySelector("[data-results]");
  if (!root) {
    return;
  }

  const onboardingResult = getOnboardingResult();
  const veteranId = getVeteranId();

  if (!onboardingResult || !veteranId) {
    window.location.hash = "#/onboarding";
    return;
  }

  const body = root.querySelector("[data-results-body]");
  const recalcButton = root.querySelector("[data-recalc]");
  body.textContent = "Loading benefits...";

  try {
    let grid = null;
    const benefitsResult = await getBenefits(veteranId);
    grid = renderResults(body, benefitsResult);

    if (recalcButton) {
      recalcButton.addEventListener("click", async () => {
        recalcButton.disabled = true;
        recalcButton.textContent = "Recalculating...";
        try {
          const refreshed = await recalcBenefits(veteranId);
          const newGrid = renderResults(grid, refreshed);
          grid = newGrid;
        } catch (error) {
          alert(error.message || "Failed to recalculate benefits.");
        } finally {
          recalcButton.disabled = false;
          recalcButton.textContent = "Recalculate";
        }
      });
    }
  } catch (error) {
    body.textContent = error.message || "Failed to load benefits.";
  }
};
