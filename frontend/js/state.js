const STORAGE_KEY = "rallyforge:onboardingResult";
const VETERAN_KEY = "rallyforge:veteranId";
const PLAN_KEY = "rallyforge:actionPlanState";

const safeParse = (value) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

export const getOnboardingResult = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? safeParse(raw) : null;
};

export const setOnboardingResult = (result) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
};

export const clearOnboardingResult = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const getVeteranId = () => localStorage.getItem(VETERAN_KEY);

export const setVeteranId = (veteranId) => {
  if (veteranId) {
    localStorage.setItem(VETERAN_KEY, veteranId);
  }
};

export const clearVeteranId = () => {
  localStorage.removeItem(VETERAN_KEY);
};

export const getActionPlanState = () => {
  const raw = localStorage.getItem(PLAN_KEY);
  return raw ? safeParse(raw) : null;
};

export const setActionPlanState = (state) => {
  localStorage.setItem(PLAN_KEY, JSON.stringify(state));
};

export const clearActionPlanState = () => {
  localStorage.removeItem(PLAN_KEY);
};
