export const mockEndpoints = {
  baseUrl: "https://mock.lighthouse.invalid",
  veteranVerification: "/MOCK/veteran-verification",
  disabilityRating: "/MOCK/disability-rating",
  claims: "/MOCK/claims",
  appeals: "/MOCK/appeals",
  facilities: "/MOCK/facilities"
};

export const mockResponses = {
  veteranVerification: {
    status: "verified",
    verified_at: "2026-02-08T00:00:00Z"
  },
  disabilityRating: {
    combined_rating: 0,
    effective_date: null
  },
  claims: {
    items: []
  },
  appeals: {
    items: []
  },
  facilities: {
    items: []
  }
};

