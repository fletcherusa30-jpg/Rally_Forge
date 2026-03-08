export const requestToken = async ({
  tokenUrl,
  clientId,
  clientSecret,
  scope,
  grantType,
  code,
  redirectUri
}) => {
  const body = new URLSearchParams();
  body.set("grant_type", grantType);
  if (scope) {
    body.set("scope", scope);
  }
  if (code) {
    body.set("code", code);
  }
  if (redirectUri) {
    body.set("redirect_uri", redirectUri);
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth token request failed: ${response.status} ${errorText}`);
  }

  return response.json();
};

