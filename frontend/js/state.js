const STORAGE_KEY = "rallyforge:onboardingResult";

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
