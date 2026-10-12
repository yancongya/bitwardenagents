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
  return null;
}
