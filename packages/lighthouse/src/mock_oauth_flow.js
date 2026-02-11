export const buildMockAuthorizeUrl = ({
  clientId = "MOCK_CLIENT_ID",
  redirectUri = "https://mock.invalid/callback",
  scope = "mock.scope",
  state = "mock-state"
} = {}) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state
  });

  return `https://mock.lighthouse.invalid/MOCK/authorize?${params.toString()}`;
};

export const exchangeMockToken = async () => ({
  access_token: "mock-access-token",
  token_type: "Bearer",
  expires_in: 3600,
  scope: "mock.scope"
});

export const validateMockToken = async (token) => ({
  active: token === "mock-access-token",
  scope: "mock.scope",
  exp: Math.floor(Date.now() / 1000) + 3600
});
