const defaultClockSkewSeconds = 30;

export class TokenManager {
  constructor() {
    this.token = null;
    this.expiresAt = 0;
  }

  setToken(tokenResponse) {
    const expiresIn = Number(tokenResponse.expires_in || 0);
    const now = Date.now();
    this.token = tokenResponse.access_token || null;
    this.expiresAt = now + Math.max(0, expiresIn - defaultClockSkewSeconds) * 1000;
  }

  isExpired() {
    return !this.token || Date.now() >= this.expiresAt;
  }

  getToken() {
    return this.token;
  }
}
