/**
 * Narrow authorization boundary for the browser-facing Bitwarden proxy.
 * The CLI talks to Bitwarden directly and is not affected by this policy.
 */

const IDENTITY_ROUTES = new Set([
  'POST /accounts/prelogin',
  'POST /connect/token',
]);

const API_ROUTES = new Set([
  'GET /sync',
  'GET /ciphers',
  'POST /ciphers',
  'PUT /ciphers/delete',
  'DELETE /ciphers/delete',
  'PUT /ciphers/delete-admin',
  'POST /ciphers/import',
  'PUT /ciphers/move',
  'PUT /ciphers/restore',
  'GET /folders',
  'POST /folders',
]);

export const PROXY_SCOPES = Object.freeze({
  READ: 'vault:read',
  SECRETS: 'vault:secrets',
  WRITE: 'vault:write',
  DELETE: 'vault:delete',
});

/** Resolve capabilities only from server-owned token state/configuration. */
export function proxyScopesForToken({ authorization, sessionToken, issuedTokenScopes = new Map(), configuredScopes }) {
  const token = /^Bearer\s+(\S+)$/.exec(String(authorization || ''))?.[1];
  if (!token) return undefined;
  if (issuedTokenScopes.has(token)) return issuedTokenScopes.get(token);
  if (sessionToken && token === sessionToken) return configuredScopes;
  return undefined;
}

function requiredScope(method, pathname) {
  const verb = String(method || '').toUpperCase();
  if (verb === 'GET' || verb === 'HEAD') {
    return pathname === '/sync' || pathname === '/ciphers' || isItemRoute(verb, pathname)
      ? PROXY_SCOPES.SECRETS
      : pathname === '/folders' ? PROXY_SCOPES.READ : null;
  }
  if (verb === 'DELETE' || pathname.includes('/delete')) return PROXY_SCOPES.DELETE;
  return PROXY_SCOPES.WRITE;
}

function isItemRoute(method, pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 2 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parts[1])) return false;
  if (parts[0] === 'ciphers') return ['GET', 'PUT', 'DELETE'].includes(method);
  if (parts[0] === 'folders') return ['PUT', 'DELETE'].includes(method);
  return false;
}

/** Return a safe status/message pair or null when a proxy request is allowed. */
export function proxyRequestDenial({
  proxyPath,
  method,
  pathname,
  authorization,
  sessionToken,
  issuedTokens = [],
  pinSet,
  unlocked,
  sameOrigin,
  grantedScopes,
}) {
  const verb = String(method || '').toUpperCase();
  const route = `${verb} ${pathname}`;
  const isIdentity = proxyPath.endsWith('-identity');

  if (isIdentity) {
    if (!IDENTITY_ROUTES.has(route)) return { status: 403, message: 'Identity route is not allowed.' };
    if (!sameOrigin) return { status: 403, message: 'Same-origin request required.' };
    return null;
  }

  if (!API_ROUTES.has(route) && !isItemRoute(verb, pathname)) {
    return { status: 403, message: 'Vault route is not allowed.' };
  }
  const suppliedToken = /^Bearer\s+(\S+)$/.exec(String(authorization || ''))?.[1];
  const allowedTokens = new Set([sessionToken, ...issuedTokens].filter(Boolean));
  if (!suppliedToken || !allowedTokens.has(suppliedToken)) {
    return { status: 401, message: 'Authenticated session required.' };
  }
  if (pinSet && !unlocked) return { status: 401, message: 'PIN unlock required.' };
  if (!['GET', 'HEAD'].includes(verb) && !sameOrigin) {
    return { status: 403, message: 'Same-origin request required for vault changes.' };
  }
  if (grantedScopes !== undefined) {
    const needed = requiredScope(verb, pathname);
    if (needed && !new Set(Array.isArray(grantedScopes) ? grantedScopes : []).has(needed)) {
      return { status: 403, message: `Vault capability required: ${needed}.` };
    }
  }
  return null;
}
