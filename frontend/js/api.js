const API_BASE = "/api";

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || "Request failed";
    const error = new Error(message);
    error.details = payload?.error?.details || payload?.details || null;
    throw error;
  }

  return payload;
};

export const postOnboarding = async (onboardingResult) => {
  const payload = await requestJson("/onboarding", {
    method: "POST",
    body: JSON.stringify(onboardingResult)
  });

  return payload.data;
};

export const getBenefits = async (veteranId) => {
  const payload = await requestJson(`/benefits/${veteranId}`);
  return payload.data;
};

export const recalcBenefits = async (veteranId) => {
  const payload = await requestJson(`/benefits/recalculate/${veteranId}`,
    { method: "POST" }
  );
  return payload.data;
};
