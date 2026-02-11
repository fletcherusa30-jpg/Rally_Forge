import { requestToken } from "./oauth_client.js";
import { TokenManager } from "./token_manager.js";

export class LighthouseClient {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.tokenUrl = config.tokenUrl;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.scope = config.scope || "";
    this.grantType = config.grantType || "client_credentials";
    this.tokenManager = new TokenManager();
  }

  async ensureToken() {
    if (!this.tokenManager.isExpired()) {
      return this.tokenManager.getToken();
    }

    const tokenResponse = await requestToken({
      tokenUrl: this.tokenUrl,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      scope: this.scope,
      grantType: this.grantType
    });

    this.tokenManager.setToken(tokenResponse);
    return this.tokenManager.getToken();
  }

  async request(path, options = {}) {
    const token = await this.ensureToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lighthouse request failed: ${response.status} ${errorText}`);
    }

    return response.json();
  }
}
