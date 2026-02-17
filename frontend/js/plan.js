import { getActionPlanState, setActionPlanState } from "./state.js";

const PLAN_KEY_VERSION = 1;

const PRIORITY_ORDER = ["Now", "Soon", "Later"];

const categoryMap = {
  federal: "Federal",
  state: "State",
  combat: "Combat",
  exposure: "Exposure",
  rating: "Rating",
  retirement: "Retirement"
};

const buildPlanId = (category, item, index) => {
  if (item?.ruleId) {
    return `${category}-${item.ruleId}`;
  }
  const title = String(item?.title || item?.name || "item").toLowerCase();
  const slug = title.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${category}-${slug || "item"}-${index}`;
};

const pickPriority = (categoryLabel, item) => {
  const tags = Array.isArray(item?.tags) ? item.tags.map((tag) => String(tag).toLowerCase()) : [];
  if (tags.includes("urgent") || tags.includes("time_sensitive") || tags.includes("high_priority")) {
    return "Now";
  }
  if (["Combat", "Exposure", "Rating"].includes(categoryLabel)) {
    return "Now";
  }
  if (["Federal", "State"].includes(categoryLabel)) {
    return "Soon";
  }
  return "Later";
};

const pickEffort = (item) => {
  const tags = Array.isArray(item?.tags) ? item.tags.map((tag) => String(tag).toLowerCase()) : [];
  if (tags.includes("quick") || tags.includes("low_effort")) {
    return "Low";
  }
  if (tags.includes("high_effort")) {
    return "High";
  }
  return "Medium";
};

const pickTimeEstimate = (item) => {
  const tags = Array.isArray(item?.tags) ? item.tags.map((tag) => String(tag).toLowerCase()) : [];
  if (tags.includes("quick")) {
    return "15-30 min";
  }
  if (tags.includes("long_form")) {
    return "1-2 hours";
  }
  return "30-60 min";
};

const normalizeChecklist = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry) => typeof entry === "string" && entry.trim().length > 0);
};

const buildPlanItem = (categoryKey, item, index) => {
  const categoryLabel = categoryMap[categoryKey] || categoryKey;
  const title = item?.title || item?.name || "Benefit option";
  const rationale = item?.description || item?.summary || item?.ruleDescription || "Based on your profile.";
  const link = item?.url || item?.link || "";

  const itemChecklist = normalizeChecklist(item?.checklist);
  const sharedChecklist = normalizeChecklist(item?.sharedChecklist);
  const fullChecklist = [...itemChecklist, ...sharedChecklist];

  return {
    id: buildPlanId(categoryKey, item, index),
    title,
    rationale,
    category: categoryLabel,
    priority: pickPriority(categoryLabel, item),
    effort: pickEffort(item),
    timeEstimate: pickTimeEstimate(item),
    dependency: item?.dependency || "",
    link,
    ruleId: item?.ruleId || null,
    itemChecklist,
    sharedChecklist,
    fullChecklist
  };
};

export const buildActionPlan = (benefitsResult) => {
  if (!benefitsResult || typeof benefitsResult !== "object") {
    return [];
  }

  const categories = ["federal", "state", "combat", "exposure", "rating", "retirement"];
  const planItems = [];

  categories.forEach((categoryKey) => {
    const items = Array.isArray(benefitsResult?.[categoryKey]?.items)
      ? benefitsResult[categoryKey].items
      : [];
    items.forEach((item, index) => {
      planItems.push(buildPlanItem(categoryKey, item, index));
    });
  });

  return planItems;
};

export const sortPlanItems = (planItems) => {
  const order = new Map(PRIORITY_ORDER.map((value, index) => [value, index]));
  return [...planItems].sort((left, right) => {
    const leftRank = order.get(left.priority) ?? PRIORITY_ORDER.length;
    const rightRank = order.get(right.priority) ?? PRIORITY_ORDER.length;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    if (left.category !== right.category) {
      return String(left.category).localeCompare(String(right.category));
    }
    return String(left.title).localeCompare(String(right.title));
  });
};

export const getPlanState = () => {
  const stored = getActionPlanState();
  if (!stored || typeof stored !== "object") {
    return { version: PLAN_KEY_VERSION, items: {} };
  }

  return {
    version: stored.version || PLAN_KEY_VERSION,
    items: stored.items || {}
  };
};

export const ensurePlanState = (planItems, planState) => {
  const next = { version: PLAN_KEY_VERSION, items: { ...(planState?.items || {}) } };
  const validIds = new Set(planItems.map((item) => item.id));

  planItems.forEach((item) => {
    if (!next.items[item.id]) {
      next.items[item.id] = { done: false, checklist: {} };
    }
  });

  Object.keys(next.items).forEach((id) => {
    if (!validIds.has(id)) {
      delete next.items[id];
    }
  });

  return next;
};

export const savePlanState = (planState) => {
  setActionPlanState(planState);
};

export const computeReadiness = (planItems, planState) => {
  if (!planItems.length) {
    return 0;
  }

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

  return Math.round((completed / Math.max(1, total)) * 100);
};
