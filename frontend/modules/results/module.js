import { getOnboardingResult, getVeteranId } from "../../js/state.js";
import { getBenefits, recalcBenefits } from "../../js/api.js";
import {
  buildActionPlan,
  computeReadiness,
  ensurePlanState,
  getPlanState,
  savePlanState,
  sortPlanItems
} from "../../js/plan.js";

const COMPACT_STORAGE_KEY = "rallyforge:resultsCompact";

const getCompactMode = () => {
  return localStorage.getItem(COMPACT_STORAGE_KEY) === "true";
};

const setCompactMode = (value) => {
  localStorage.setItem(COMPACT_STORAGE_KEY, value ? "true" : "false");
};

const escapeHtml = (value) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const safeUrl = (value) => {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.href;
    }
  } catch {
    return "";
  }

  return "";
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseIsoDate = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const diffDays = (startDate, endDate) => {
  const start = parseIsoDate(startDate);
  const end = endDate ? parseIsoDate(endDate) : new Date();
  if (!start || !end) {
    return 0;
  }
  const delta = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY);
  return Math.max(0, delta);
};

const formatServiceDuration = (periods = []) => {
  const totalDays = periods.reduce((sum, period) => {
    return sum + diffDays(period.startDate, period.endDate);
  }, 0);

  if (!totalDays) {
    return "0d";
  }

  const years = Math.floor(totalDays / 365);
  const remainingDays = totalDays % 365;
  const months = Math.floor(remainingDays / 30);
  const days = remainingDays % 30;
  const parts = [];
  if (years) {
    parts.push(`${years}y`);
  }
  if (months) {
    parts.push(`${months}m`);
  }
  if (days || !parts.length) {
    parts.push(`${days}d`);
  }

  return parts.join(" ");
};

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
    return { title: "Benefit option", description: "", link: "", tags: [] };
  }

  return {
    title: item.title || item.name || "Benefit option",
    description: item.description || item.summary || "",
    link: item.url || item.link || "",
    tags: item.tags || [],
    ruleId: item.ruleId || null,
    ruleDescription: item.ruleDescription || "",
    ruleConditions: item.ruleConditions || []
  };
};

const renderTrace = (formatted) => {
  const parts = [];
  if (formatted.ruleDescription) {
    parts.push(`Why: ${escapeHtml(formatted.ruleDescription)}`);
  }
  if (formatted.ruleId) {
    parts.push(`Rule: ${escapeHtml(formatted.ruleId)}`);
  }
  if (!parts.length) {
    return "";
  }

  return `<div class="item-trace">${parts.join(" · ")}</div>`;
};

const renderHero = (totals, onboardingResult, readiness, counts, nextFocus) => {
  const wrapper = document.createElement("div");
  wrapper.className = "results-hero";

  const profileChips = [];
  if (onboardingResult?.branch) {
    profileChips.push(`<span>Branch: ${escapeHtml(onboardingResult.branch)}</span>`);
  }
  if (onboardingResult?.component) {
    profileChips.push(`<span>Component: ${escapeHtml(onboardingResult.component)}</span>`);
  }
  if (onboardingResult?.stateOfResidence) {
    profileChips.push(`<span>State: ${escapeHtml(onboardingResult.stateOfResidence)}</span>`);
  }
  const periodCount = onboardingResult?.servicePeriods?.length || 0;
  if (periodCount) {
    const duration = formatServiceDuration(onboardingResult?.servicePeriods || []);
    profileChips.push(`<span>Service: ${duration}</span>`);
  }

  wrapper.innerHTML = `
    <div class="results-hero-main">
      <span class="hero-kicker">Benefits Snapshot</span>
      <h2>Personalized Next Steps, Ready to Act</h2>
      <p>Curated recommendations and a guided checklist tailored to your service profile.</p>
      <div class="hero-chips">
        ${profileChips.join("")}
      </div>
    </div>
    <div class="results-hero-stats">
      <div class="rf-card hero-card">
        <div class="hero-label">Readiness</div>
        <div class="hero-ring" style="--value: ${readiness}">
          <span>${readiness}%</span>
        </div>
        <div class="hero-sub">${counts.completed}/${counts.total} tasks complete</div>
      </div>
      <div class="rf-card hero-card">
        <div class="hero-label">Total Recommendations</div>
        <div class="hero-value">${totals.totalItems}</div>
        <div class="hero-sub">Next focus: ${escapeHtml(nextFocus)}</div>
      </div>
      <div class="rf-card hero-card">
        <div class="hero-label">Categories Reviewed</div>
        <div class="hero-value">${totals.categories}</div>
        <div class="hero-sub">Across federal and state benefits</div>
      </div>
    </div>
  `;

  return wrapper;
};

const renderTopActions = (planItems) => {
  const wrapper = document.createElement("div");
  wrapper.className = "rf-card top-actions";

  const topItems = planItems.slice(0, 3);
  const itemsHtml = topItems
    .map((item) => {
      const title = escapeHtml(item.title);
      const category = escapeHtml(item.category);
      const priority = escapeHtml(item.priority);
      const rationale = escapeHtml(item.rationale);
      const dependency = escapeHtml(item.dependency);
      const linkUrl = safeUrl(item.link);
      const badges = `
        <span class="plan-badge">${item.timeEstimate}</span>
        <span class="plan-badge">Effort: ${item.effort}</span>
      `;
      const link = linkUrl
        ? `<a class="rf-button" href="${linkUrl}" target="_blank" rel="noreferrer">Open resource</a>`
        : "";
      const dependencyBlock = dependency ? `<div class="plan-dependency">${dependency}</div>` : "";
      return `
        <div class="top-action">
          <div>
            <div class="top-action-title">${title}</div>
            <div class="top-action-meta">
              <span>${category}</span>
              <span>${priority}</span>
            </div>
            <div class="plan-badges">${badges}</div>
            <p>${rationale}</p>
            ${dependencyBlock}
            <a class="top-action-link" href="#plan-${item.id}">View checklist</a>
          </div>
          <div class="top-action-cta">${link}</div>
        </div>
      `;
    })
    .join("");

  wrapper.innerHTML = `
    <div class="top-actions-header">
      <div>
        <span class="category-tag">Top 3</span>
        <h3>Start Here</h3>
        <p>Highest-impact actions based on your profile.</p>
      </div>
    </div>
    <div class="top-actions-list">
      ${itemsHtml || "<p>No actions yet.</p>"}
    </div>
  `;

  return wrapper;
};

const renderCategory = (title, data) => {
  const wrapper = document.createElement("div");
  wrapper.className = "rf-card results-item";
  const categoryKey = String(title || "").toLowerCase();
  if (categoryKey) {
    wrapper.dataset.category = categoryKey;
  }
  const normalized = normalizeCategory(data);
  const eligible = normalized.items.length > 0;
  const badgeText = eligible ? "Eligible" : "Review";
  const badgeClass = eligible ? "eligible" : "review";
  const safeTitle = escapeHtml(title);

  const itemsHtml = normalized.items.length
    ? normalized.items
        .map((item) => {
          const formatted = formatItem(item);
          const safeItemTitle = escapeHtml(formatted.title);
          const safeDescription = escapeHtml(formatted.description);
          const safeLink = safeUrl(formatted.link);
          const description = formatted.description
            ? `<span class="item-description">${safeDescription}</span>`
            : "";
          const link = safeLink
            ? `<a class="item-link" href="${safeLink}" target="_blank" rel="noreferrer">Learn more</a>`
            : "";
          const trace = renderTrace(formatted);

          return `
            <li>
              <div class="item-title">${safeItemTitle}</div>
              ${description}
              ${trace}
              ${link}
            </li>
          `;
        })
        .join("")
    : "<li>No recommendations yet.</li>";

  const notesHtml = normalized.notes.length
    ? normalized.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")
    : "";

  wrapper.innerHTML = `
    <div class="results-item-header">
      <div>
        <span class="category-tag">${safeTitle}</span>
        <h3>${safeTitle} Benefits</h3>
      </div>
      <div class="results-item-badges">
        <span class="badge ${badgeClass}">${badgeText}</span>
      </div>
    </div>
    <div class="results-item-body">
      <div>
        <h4>Recommendations</h4>
        <ul>${itemsHtml}</ul>
      </div>
      ${notesHtml ? `
        <div>
          <h4>Notes</h4>
          <ul>${notesHtml}</ul>
        </div>
      ` : ""}
    </div>
  `;

  return wrapper;
};

const renderMetadata = (metadata) => {
  const wrapper = document.createElement("div");
  wrapper.className = "rf-card results-item";

  const ruleVersions = metadata?.ruleVersions || {};
  const versionLines = Object.entries(ruleVersions)
    .map(([key, value]) => `<li>${escapeHtml(key)}: ${escapeHtml(value)}</li>`)
    .join("") || "<li>No version data.</li>";
  const computedAt = escapeHtml(metadata?.computedAt || "Unknown");

  wrapper.innerHTML = `
    <div class="results-item-header">
      <h3>Metadata</h3>
      <span class="pill">Computed</span>
    </div>
    <div class="results-item-body">
      <div>
        <h4>Computed At</h4>
        <p>${computedAt}</p>
      </div>
      <div>
        <h4>Rule Versions</h4>
        <ul>${versionLines}</ul>
      </div>
    </div>
  `;

  return wrapper;
};

const summarizePlanCounts = (planItems, planState) => {
  let total = 0;
  let completed = 0;

  planItems.forEach((item) => {
    const state = planState.items[item.id] || { done: false, checklist: {} };
    const checklist = Array.isArray(item.fullChecklist) ? item.fullChecklist : [];
    total += 1 + checklist.length;
    if (state.done) {
      completed += 1;
    }
    checklist.forEach((_, index) => {
      if (state.checklist?.[index]) {
        completed += 1;
      }
    });
  });

  return { total, completed };
};

const buildCategoryStats = (planItems, planState) => {
  const stats = {};

  planItems.forEach((item) => {
    const key = item.category;
    if (!stats[key]) {
      stats[key] = { total: 0, completed: 0 };
    }

    const state = planState.items[item.id] || { done: false, checklist: {} };
    const checklist = Array.isArray(item.fullChecklist) ? item.fullChecklist : [];
    stats[key].total += 1 + checklist.length;
    if (state.done) {
      stats[key].completed += 1;
    }
    checklist.forEach((_, index) => {
      if (state.checklist?.[index]) {
        stats[key].completed += 1;
      }
    });
  });

  return stats;
};

const buildDocVault = (planItems, planState) => {
  const vault = new Map();

  planItems.forEach((item) => {
    const state = planState.items[item.id] || { done: false, checklist: {} };
    const checklist = Array.isArray(item.fullChecklist) ? item.fullChecklist : [];
    checklist.forEach((doc, index) => {
      if (!vault.has(doc)) {
        vault.set(doc, { total: 0, completed: 0 });
      }
      const entry = vault.get(doc);
      entry.total += 1;
      if (state.checklist?.[index]) {
        entry.completed += 1;
      }
    });
  });

  return Array.from(vault.entries())
    .map(([doc, data]) => ({ doc, ...data }))
    .sort((left, right) => right.total - left.total);
};

const renderPlanItem = (item, state) => {
  const title = escapeHtml(item.title);
  const rationale = escapeHtml(item.rationale);
  const dependency = escapeHtml(item.dependency);
  const category = escapeHtml(item.category);
  const ruleId = escapeHtml(item.ruleId);
  const linkUrl = safeUrl(item.link);
  const badges = `
    <span class="plan-badge">${item.timeEstimate}</span>
    <span class="plan-badge">Effort: ${item.effort}</span>
  `;
  const dependencyBlock = dependency ? `<div class="plan-dependency">${dependency}</div>` : "";
  const checklistHtml = item.itemChecklist
    .map((entry) => {
      const index = item.fullChecklist.indexOf(entry);
      const checked = state.checklist?.[index] ? "checked" : "";
      return `
        <li>
          <label class="plan-check">
            <input type="checkbox" data-plan-item="${item.id}" data-plan-checklist="${index}" ${checked} />
            <span>${escapeHtml(entry)}</span>
          </label>
        </li>
      `;
    })
    .join("");

  const checklistBlock = item.itemChecklist.length
    ? `<ul class="plan-checklist">${checklistHtml}</ul>`
    : "<div class=\"plan-empty-docs\">No item-specific documents.</div>";

  const commonDocsLine = item.sharedChecklist.length
    ? `<div class="plan-common">Common docs: <a href="#doc-vault">View in Document Vault</a></div>`
    : "";

  const completed = state.done ? "checked" : "";
  const link = linkUrl
    ? `<a class="item-link" href="${linkUrl}" target="_blank" rel="noreferrer">Open resource</a>`
    : "";
  const isCollapsed = item.priority !== "Now";
  const toggleLabel = isCollapsed ? "Show details" : "Hide details";
  const toggleExpanded = isCollapsed ? "false" : "true";
  const collapsedClass = isCollapsed ? "is-collapsed" : "";

  return `
    <div class="plan-item ${collapsedClass}" id="plan-${item.id}" data-plan-item="${item.id}">
      <div class="plan-item-header">
        <label class="plan-check">
          <input type="checkbox" data-plan-item="${item.id}" data-plan-complete ${completed} />
          <span>${title}</span>
        </label>
        <div class="plan-header-actions">
          <span class="plan-priority">${item.priority}</span>
          <button class="rf-button secondary small" type="button" data-plan-toggle data-plan-item="${item.id}" aria-expanded="${toggleExpanded}">${toggleLabel}</button>
        </div>
      </div>
      <p class="plan-reason">${rationale}</p>
      <div class="plan-details">
        <div class="plan-badges">${badges}</div>
        ${dependencyBlock}
        <div class="plan-meta">
          <span class="pill">${category}</span>
          ${item.ruleId ? `<span class="pill">Rule ${ruleId}</span>` : ""}
        </div>
        ${commonDocsLine}
        ${checklistBlock}
        ${link}
      </div>
    </div>
  `;
};

const renderActionPlan = (planItems, planState) => {
  const wrapper = document.createElement("div");
  wrapper.className = "rf-card action-plan";

  const readiness = computeReadiness(planItems, planState);
  const counts = summarizePlanCounts(planItems, planState);

  const priorities = ["Now", "Soon", "Later"];
  const grouped = priorities.map((priority) => ({
    priority,
    items: planItems.filter((item) => item.priority === priority)
  }));

  const columnsHtml = grouped
    .map((group) => {
      const anchorId = `plan-${group.priority.toLowerCase()}`;
      const itemsHtml = group.items.length
        ? group.items
            .map((item) => renderPlanItem(item, planState.items[item.id] || { done: false, checklist: {} }))
            .join("")
        : `<div class="plan-empty">No ${group.priority.toLowerCase()} actions.</div>`;

      return `
        <div class="plan-column" id="${anchorId}">
          <h4>${group.priority}</h4>
          ${itemsHtml}
        </div>
      `;
    })
    .join("");

  wrapper.innerHTML = `
    <div class="action-plan-header">
      <div>
        <span class="category-tag">Action Plan</span>
        <h3>Next Steps That Move the Needle</h3>
        <p>Each recommendation includes a reason, checklist, and progress tracking.</p>
      </div>
      <div class="action-plan-metrics">
        <div>
          <span class="metric-label">Readiness</span>
          <span class="metric-value" data-readiness>${readiness}%</span>
        </div>
        <div>
          <span class="metric-label">Tasks</span>
          <span class="metric-value" data-completed>${counts.completed}</span>
          <span class="metric-sub">/ <span data-total>${counts.total}</span> completed</span>
        </div>
        <div class="action-plan-controls">
          <button class="rf-button secondary small" type="button" data-plan-toggle-all="expand">Expand all</button>
          <button class="rf-button secondary small" type="button" data-plan-toggle-all="collapse">Collapse all</button>
          <a class="rf-button secondary small" href="#doc-vault">Doc Vault</a>
        </div>
      </div>
    </div>
    <div class="action-plan-columns">
      ${columnsHtml}
    </div>
  `;

  return wrapper;
};

const renderPlanNav = (planItems) => {
  const wrapper = document.createElement("div");
  wrapper.className = "rf-card plan-nav";

  const counts = planItems.reduce(
    (acc, item) => {
      acc[item.priority] = (acc[item.priority] || 0) + 1;
      return acc;
    },
    { Now: 0, Soon: 0, Later: 0 }
  );

  wrapper.innerHTML = `
    <div class="plan-nav-header">
      <div>
        <h3>Plan Navigator</h3>
        <p>Jump between lanes or filter the action plan.</p>
      </div>
      <div class="plan-nav-links">
        <a href="#plan-now">Now (${counts.Now})</a>
        <a href="#plan-soon">Soon (${counts.Soon})</a>
        <a href="#plan-later">Later (${counts.Later})</a>
      </div>
    </div>
    <div class="plan-filters" data-plan-filters>
      <button class="rf-button secondary small is-active" type="button" data-plan-filter="all">All (${counts.Now + counts.Soon + counts.Later})</button>
      <button class="rf-button secondary small" type="button" data-plan-filter="now">Now (${counts.Now})</button>
      <button class="rf-button secondary small" type="button" data-plan-filter="soon">Soon (${counts.Soon})</button>
      <button class="rf-button secondary small" type="button" data-plan-filter="later">Later (${counts.Later})</button>
    </div>
  `;

  return wrapper;
};

const renderReadinessByCategory = (planItems, planState) => {
  const wrapper = document.createElement("div");
  wrapper.className = "rf-card readiness-card";

  const stats = buildCategoryStats(planItems, planState);
  const rows = Object.entries(stats)
    .map(([category, data]) => {
      const percent = data.total ? Math.round((data.completed / data.total) * 100) : 0;
      return `
        <div class="readiness-row">
          <div>
            <span>${category}</span>
            <div class="readiness-bar" style="--value: ${percent}"></div>
          </div>
          <span>${percent}%</span>
        </div>
      `;
    })
    .join("");

  wrapper.innerHTML = `
    <h3>Readiness by Category</h3>
    <div class="readiness-grid">
      ${rows || "<p>No category data.</p>"}
    </div>
  `;

  return wrapper;
};

const renderDocRows = (docs) => {
  return docs
    .map((doc) => {
      const percent = doc.total ? Math.round((doc.completed / doc.total) * 100) : 0;
      const checked = doc.total && doc.completed === doc.total ? "checked" : "";
      return `
        <div class="doc-row" data-doc-row="${doc.doc}">
          <div>
            <div class="doc-title">${doc.doc}</div>
            <div class="doc-meta">Collected ${doc.completed}/${doc.total}</div>
          </div>
          <div class="doc-actions">
            <label class="plan-check">
              <input type="checkbox" data-doc-vault="${doc.doc}" ${checked} />
              <span class="doc-percent">${percent}%</span>
            </label>
          </div>
        </div>
      `;
    })
    .join("");
};

const sortDocs = (docs, mode) => {
  if (mode === "alpha") {
    return [...docs].sort((left, right) => left.doc.localeCompare(right.doc));
  }

  return [...docs].sort((left, right) => {
    const leftMissing = left.total - left.completed;
    const rightMissing = right.total - right.completed;
    if (leftMissing !== rightMissing) {
      return rightMissing - leftMissing;
    }
    return right.total - left.total;
  });
};

const renderDocVault = (planItems, planState) => {
  const wrapper = document.createElement("div");
  wrapper.className = "rf-card doc-vault";

  const docs = sortDocs(buildDocVault(planItems, planState), "missing");
  const itemsHtml = renderDocRows(docs);

  wrapper.id = "doc-vault";
  wrapper.innerHTML = `
    <div class="doc-vault-header">
      <div>
        <h3>Document Vault</h3>
        <p>Aggregate checklist items across all actions.</p>
      </div>
      <div class="doc-vault-actions">
        <button class="rf-button secondary small" type="button" data-doc-sort="missing">Sort by missing</button>
        <button class="rf-button secondary small" type="button" data-doc-sort="alpha">Sort A-Z</button>
        <button class="rf-button secondary small" type="button" data-doc-copy>Copy checklist</button>
      </div>
    </div>
    <div class="doc-grid" data-doc-grid>
      ${itemsHtml || "<p>No documents yet.</p>"}
    </div>
  `;

  return wrapper;
};

const renderPrintPacket = (onboardingResult, benefitsResult, planItems) => {
  const wrapper = document.createElement("div");
  wrapper.className = "print-packet";

  const profile = onboardingResult
    ? `
      <ul>
        <li>Branch: ${onboardingResult.branch}</li>
        <li>Component: ${onboardingResult.component}</li>
        <li>State: ${onboardingResult.stateOfResidence}</li>
      </ul>
    `
    : "";

  const actionsHtml = planItems
    .map((item) => `
      <li>
        <strong>${item.title}</strong> (${item.category} · ${item.priority})
        <div>${item.rationale}</div>
        ${item.link ? `<div>${item.link}</div>` : ""}
      </li>
    `)
    .join("");

  wrapper.innerHTML = `
    <h1>Rally Forge Benefits Action Packet</h1>
    <p>Generated ${benefitsResult.metadata?.computedAt || ""}</p>
    <h2>Profile Snapshot</h2>
    ${profile}
    <h2>Priority Actions</h2>
    <ol>${actionsHtml}</ol>
  `;

  return wrapper;
};

const attachPlanHandlers = (grid, planItems, planState) => {
  const planRoot = grid.querySelector(".action-plan");
  const docRoot = grid.querySelector(".doc-vault");
  const filterRoot = grid.querySelector("[data-plan-filters]");
  if (!planRoot) {
    return;
  }

  const updateMetrics = () => {
    const readiness = computeReadiness(planItems, planState);
    const counts = summarizePlanCounts(planItems, planState);
    const readinessEl = planRoot.querySelector("[data-readiness]");
    const completedEl = planRoot.querySelector("[data-completed]");
    const totalEl = planRoot.querySelector("[data-total]");

    if (readinessEl) {
      readinessEl.textContent = `${readiness}%`;
    }
    if (completedEl) {
      completedEl.textContent = String(counts.completed);
    }
    if (totalEl) {
      totalEl.textContent = String(counts.total);
    }
  };

  const updateDocVault = () => {
    if (!docRoot) {
      return;
    }
    const gridEl = docRoot.querySelector("[data-doc-grid]");
    const sortMode = docRoot.dataset.sortMode || "missing";
    const docs = sortDocs(buildDocVault(planItems, planState), sortMode);
    if (gridEl) {
      gridEl.innerHTML = renderDocRows(docs) || "<p>No documents yet.</p>";
    }
  };

  if (filterRoot) {
    filterRoot.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const mode = target.getAttribute("data-plan-filter");
      if (!mode) {
        return;
      }

      filterRoot.querySelectorAll("[data-plan-filter]").forEach((button) => {
        button.classList.toggle("is-active", button === target);
      });

      planRoot.querySelectorAll(".plan-column").forEach((column) => {
        if (mode === "all") {
          column.classList.remove("is-hidden");
          return;
        }

        const columnId = column.id || "";
        column.classList.toggle("is-hidden", !columnId.endsWith(mode));
      });
    });
  }

  planRoot.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const planId = target.dataset.planItem;
    if (!planId) {
      return;
    }

    const current = planState.items[planId] || { done: false, checklist: {} };
    const checklistIndex = target.dataset.planChecklist;

    if (checklistIndex !== undefined) {
      current.checklist[Number(checklistIndex)] = target.checked;
    } else if (target.hasAttribute("data-plan-complete")) {
      current.done = target.checked;
    }

    planState.items[planId] = current;
    savePlanState(planState);

    updateMetrics();
    updateDocVault();
  });

  planRoot.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.hasAttribute("data-plan-toggle")) {
      const planId = target.getAttribute("data-plan-item");
      const card = planId ? planRoot.querySelector(`[data-plan-item='${planId}']`) : null;
      if (!card) {
        return;
      }
      card.classList.toggle("is-collapsed");
      const isCollapsed = card.classList.contains("is-collapsed");
      target.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
      target.textContent = isCollapsed ? "Show details" : "Hide details";
    }

    if (target.hasAttribute("data-plan-toggle-all")) {
      const mode = target.getAttribute("data-plan-toggle-all");
      const collapse = mode === "collapse";
      planRoot.querySelectorAll(".plan-item").forEach((card) => {
        card.classList.toggle("is-collapsed", collapse);
        const button = card.querySelector("[data-plan-toggle]");
        if (button) {
          button.setAttribute("aria-expanded", collapse ? "false" : "true");
          button.textContent = collapse ? "Show details" : "Hide details";
        }
      });
    }
  });

  if (docRoot) {
    docRoot.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.hasAttribute("data-doc-sort")) {
        const mode = target.getAttribute("data-doc-sort") || "missing";
        docRoot.dataset.sortMode = mode;
        updateDocVault();
        return;
      }

      if (target.hasAttribute("data-doc-copy")) {
        const docs = sortDocs(buildDocVault(planItems, planState), "missing");
        const text = docs
          .map((doc) => `${doc.doc} (${doc.completed}/${doc.total})`)
          .join("\n");

        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text).catch(() => {
            window.alert("Unable to copy checklist.");
          });
        } else {
          window.prompt("Copy checklist:", text);
        }
      }
    });

    docRoot.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      const docName = target.dataset.docVault;
      if (!docName) {
        return;
      }

      planItems.forEach((item) => {
        const index = item.fullChecklist.indexOf(docName);
        if (index === -1) {
          return;
        }
        const current = planState.items[item.id] || { done: false, checklist: {} };
        current.checklist[index] = target.checked;
        planState.items[item.id] = current;

        const checkbox = planRoot.querySelector(
          `input[data-plan-item='${item.id}'][data-plan-checklist='${index}']`
        );
        if (checkbox) {
          checkbox.checked = target.checked;
        }
      });

      savePlanState(planState);
      updateMetrics();
    });
  }
};

const applyCompactMode = (root, grid, enabled) => {
  if (enabled) {
    root.classList.add("compact");
  } else {
    root.classList.remove("compact");
  }

  grid.querySelectorAll(".plan-item").forEach((card) => {
    card.classList.toggle("is-collapsed", enabled);
    const button = card.querySelector("[data-plan-toggle]");
    if (button) {
      button.setAttribute("aria-expanded", enabled ? "false" : "true");
      button.textContent = enabled ? "Show details" : "Hide details";
    }
  });
};

const renderResults = (body, benefitsResult, onboardingResult) => {
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

  const planItems = sortPlanItems(buildActionPlan(benefitsResult, onboardingResult));
  const planState = ensurePlanState(planItems, getPlanState());
  savePlanState(planState);
  const readiness = computeReadiness(planItems, planState);
  const counts = summarizePlanCounts(planItems, planState);
  const nextFocus = planItems[0]?.priority || "Soon";

  const summary = renderHero(
    {
    totalItems,
    categories: categories.length,
    computedAt: benefitsResult.metadata?.computedAt || "Unknown"
    },
    onboardingResult,
    readiness,
    counts,
    nextFocus
  );

  grid.appendChild(summary);

  grid.appendChild(renderTopActions(planItems));
  grid.appendChild(renderPlanNav(planItems));
  grid.appendChild(renderActionPlan(planItems, planState));
  grid.appendChild(renderReadinessByCategory(planItems, planState));
  grid.appendChild(renderDocVault(planItems, planState));

  categories.forEach(([title, data]) => {
    grid.appendChild(renderCategory(title, data || {}));
  });

  grid.appendChild(renderMetadata(benefitsResult.metadata || {}));

  grid.appendChild(renderPrintPacket(onboardingResult, benefitsResult, planItems));

  body.replaceWith(grid);
  attachPlanHandlers(grid, planItems, planState);
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
  const printButton = root.querySelector("[data-print]");
  const compactButton = root.querySelector("[data-compact-toggle]");
  body.textContent = "Loading benefits...";

  try {
    let grid = null;
    const benefitsResult = await getBenefits(veteranId);
    grid = renderResults(body, benefitsResult, onboardingResult);
    const isCompact = getCompactMode();
    applyCompactMode(root, grid, isCompact);

    if (compactButton) {
      compactButton.setAttribute("aria-pressed", String(isCompact));
      compactButton.textContent = isCompact ? "Comfort mode" : "Compact mode";
      compactButton.addEventListener("click", () => {
        const next = !getCompactMode();
        setCompactMode(next);
        applyCompactMode(root, grid, next);
        compactButton.setAttribute("aria-pressed", String(next));
        compactButton.textContent = next ? "Comfort mode" : "Compact mode";
      });
    }

    if (printButton) {
      printButton.addEventListener("click", () => {
        window.print();
      });
    }

    if (recalcButton) {
      recalcButton.addEventListener("click", async () => {
        recalcButton.disabled = true;
        recalcButton.textContent = "Recalculating...";
        try {
          const refreshed = await recalcBenefits(veteranId);
          const newGrid = renderResults(grid, refreshed, onboardingResult);
          grid = newGrid;
          applyCompactMode(root, grid, getCompactMode());
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
