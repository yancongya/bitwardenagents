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

export const PROXY_TARGETS = Object.freeze({
  '/bw-identity': 'https://identity.bitwarden.com',
  '/bw-api': 'https://api.bitwarden.com',
  '/bw-eu-identity': 'https://identity.bitwarden.eu',
  '/bw-eu-api': 'https://api.bitwarden.eu',
});

const FORWARDING_HEADER_NAMES = new Set([
  'host', 'forwarded', 'via', 'x-real-ip', 'x-client-ip', 'client-ip', 'true-client-ip',
  'fastly-client-ip', 'x-cluster-client-ip', 'x-original-forwarded-for',
  'x-original-host', 'x-original-url', 'x-rewrite-url',
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
]);

/** Remove proxy/routing metadata supplied by an untrusted browser request. */
export function stripProxyForwardingHeaders(headers) {
  const connectionHeaders = new Set(String(headers.get('connection') || '')
    .split(',').map((name) => name.trim().toLowerCase()).filter(Boolean));
  for (const name of [...headers.keys(), ...connectionHeaders]) {
    const normalized = name.toLowerCase();
    if (connectionHeaders.has(normalized) || FORWARDING_HEADER_NAMES.has(normalized)
        || normalized.startsWith('x-forwarded-') || normalized.startsWith('cf-')) {
      headers.delete(name);
    }
  }
  return headers;
}

function isItemRoute(method, pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 2 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parts[1])) return false;
  if (parts[0] === 'ciphers') return ['GET', 'PUT', 'DELETE'].includes(method);
  if (parts[0] === 'folders') return ['PUT', 'DELETE'].includes(method);
  return false;
}

export function proxyRouteDenial({ proxyPath, method, pathname, sameOrigin, authorization, requireBearer = false }) {
  const verb = String(method || '').toUpperCase();
  const route = `${verb} ${pathname}`;
  const isIdentity = proxyPath.endsWith('-identity');
  if (isIdentity && (!IDENTITY_ROUTES.has(route) || !sameOrigin)) {
    return { status: 403, message: IDENTITY_ROUTES.has(route) ? 'Same-origin request required.' : 'Identity route is not allowed.' };
  }
  if (!isIdentity && !API_ROUTES.has(route) && !isItemRoute(verb, pathname)) {
    return { status: 403, message: 'Vault route is not allowed.' };
  }
  if (!isIdentity && !['GET', 'HEAD'].includes(verb) && !sameOrigin) {
    return { status: 403, message: 'Same-origin request required for vault changes.' };
  }
  if (requireBearer && !/^Bearer\s+\S+$/.test(String(authorization || ''))) {
    return { status: 401, message: 'Authenticated session required.' };
  }
  return null;
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
  const routeDenial = proxyRouteDenial({ proxyPath, method, pathname, sameOrigin, authorization });
  if (routeDenial) return routeDenial;
  if (proxyPath.endsWith('-identity')) return null;
  const suppliedToken = /^Bearer\s+(\S+)$/.exec(String(authorization || ''))?.[1];
  const allowedTokens = new Set([sessionToken, ...issuedTokens].filter(Boolean));
  if (!suppliedToken || !allowedTokens.has(suppliedToken)) {
    return { status: 401, message: 'Authenticated session required.' };
  }
  if (pinSet && !unlocked) return { status: 401, message: 'PIN unlock required.' };
  if (grantedScopes !== undefined) {
    const needed = requiredScope(verb, pathname);
    if (needed && !new Set(Array.isArray(grantedScopes) ? grantedScopes : []).has(needed)) {
      return { status: 403, message: `Vault capability required: ${needed}.` };
    }
  }
  return null;
}
