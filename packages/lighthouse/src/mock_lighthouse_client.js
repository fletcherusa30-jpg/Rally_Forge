import { mockEndpoints, mockResponses } from "./mock_endpoints.js";
import { requestMockToken } from "./mock_oauth_flow.js";

export class MockLighthouseClient {
  constructor() {
    this.endpoints = mockEndpoints;
    this.tokenPromise = null;
  }

  async ensureToken() {
    if (!this.tokenPromise) {
      this.tokenPromise = requestMockToken();
    }
    return this.tokenPromise;
  }

  async request(path) {
    await this.ensureToken();

    switch (path) {
      case this.endpoints.veteranVerification:
        return mockResponses.veteranVerification;
      case this.endpoints.disabilityRating:
        return mockResponses.disabilityRating;
      case this.endpoints.claims:
        return mockResponses.claims;
      case this.endpoints.appeals:
        return mockResponses.appeals;
      case this.endpoints.facilities:
        return mockResponses.facilities;
      default:
        return { error: "Mock endpoint not found" };
    }
  }
}

