const TOKEN_KEYS = {
  access: 'weightTracker.accessToken',
  id: 'weightTracker.idToken',
  refresh: 'weightTracker.refreshToken',
  expiresAt: 'weightTracker.tokenExpiresAt',
  pkceVerifier: 'weightTracker.pkceVerifier',
};

function getAuthConfig() {
  const auth = window.APP_CONFIG?.auth;
  if (!auth?.clientId || !auth?.cognitoDomain || !auth?.redirectUri) {
    throw new Error(
      'Auth is not configured. Deploy with CDK or set auth in config.js.',
    );
  }
  return auth;
}

/** Full Cognito Hosted UI hostname (CDK once emitted prefix-only). */
function getCognitoHostedUiHost() {
  const auth = getAuthConfig();
  const domain = auth.cognitoDomain.trim();
  if (domain.includes('.amazoncognito.com')) {
    return domain;
  }
  if (!auth.region) {
    throw new Error('auth.region is required when cognitoDomain is a prefix only.');
  }
  return `${domain}.auth.${auth.region}.amazoncognito.com`;
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomVerifier(length = 64) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function sha256Base64Url(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

function parseJwtPayload(token) {
  const payload = token.split('.')[1];
  const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(json);
}

function storeTokens(tokenResponse) {
  sessionStorage.setItem(TOKEN_KEYS.access, tokenResponse.access_token);
  sessionStorage.setItem(TOKEN_KEYS.id, tokenResponse.id_token);
  if (tokenResponse.refresh_token) {
    sessionStorage.setItem(TOKEN_KEYS.refresh, tokenResponse.refresh_token);
  }
  const expiresAt = Date.now() + tokenResponse.expires_in * 1000;
  sessionStorage.setItem(TOKEN_KEYS.expiresAt, String(expiresAt));
}

function clearTokens() {
  sessionStorage.removeItem(TOKEN_KEYS.access);
  sessionStorage.removeItem(TOKEN_KEYS.id);
  sessionStorage.removeItem(TOKEN_KEYS.refresh);
  sessionStorage.removeItem(TOKEN_KEYS.expiresAt);
  sessionStorage.removeItem(TOKEN_KEYS.pkceVerifier);
}

function isAuthenticated() {
  const idToken = sessionStorage.getItem(TOKEN_KEYS.id);
  const expiresAt = Number(sessionStorage.getItem(TOKEN_KEYS.expiresAt) ?? 0);
  return Boolean(idToken && Date.now() < expiresAt);
}

/** Cognito ID token — required by API Gateway Cognito authorizers (not the access token). */
function getIdToken() {
  if (!isAuthenticated()) {
    return null;
  }
  return sessionStorage.getItem(TOKEN_KEYS.id);
}

function getUserDisplayName() {
  const idToken = sessionStorage.getItem(TOKEN_KEYS.id);
  if (!idToken) {
    return 'Signed in';
  }
  const claims = parseJwtPayload(idToken);
  return claims.email ?? claims['cognito:username'] ?? claims.sub ?? 'Signed in';
}

async function signIn() {
  const auth = getAuthConfig();
  const verifier = randomVerifier();
  const challenge = await sha256Base64Url(verifier);
  sessionStorage.setItem(TOKEN_KEYS.pkceVerifier, verifier);

  const params = new URLSearchParams({
    client_id: auth.clientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  window.location.href = `https://${getCognitoHostedUiHost()}/oauth2/authorize?${params}`;
}

function getRedirectUri() {
  const auth = getAuthConfig();
  if (window.location.hostname === 'localhost') {
    return `${window.location.origin}/auth/callback.html`;
  }
  return auth.redirectUri;
}

function getLogoutUri() {
  const auth = getAuthConfig();
  if (window.location.hostname === 'localhost') {
    return `${window.location.origin}/`;
  }
  return auth.logoutUri;
}

async function handleCallback() {
  const auth = getAuthConfig();
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  if (error) {
    throw new Error(params.get('error_description') ?? error);
  }

  const code = params.get('code');
  if (!code) {
    throw new Error('Missing authorization code');
  }

  const verifier = sessionStorage.getItem(TOKEN_KEYS.pkceVerifier);
  if (!verifier) {
    throw new Error('Missing PKCE verifier; try signing in again');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: auth.clientId,
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier,
  });

  const response = await fetch(`https://${getCognitoHostedUiHost()}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const tokenResponse = await response.json();
  if (!response.ok) {
    throw new Error(tokenResponse.error_description ?? tokenResponse.error ?? 'Token exchange failed');
  }

  storeTokens(tokenResponse);
  sessionStorage.removeItem(TOKEN_KEYS.pkceVerifier);
}

function signOut() {
  const auth = getAuthConfig();
  clearTokens();
  const params = new URLSearchParams({
    client_id: auth.clientId,
    logout_uri: getLogoutUri(),
  });
  window.location.href = `https://${getCognitoHostedUiHost()}/logout?${params}`;
}

window.WeightTrackerAuth = {
  signIn,
  signOut,
  handleCallback,
  isAuthenticated,
  getIdToken,
  getUserDisplayName,
};
