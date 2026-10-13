import { PROXY_TARGETS, proxyRouteDenial, stripProxyForwardingHeaders } from '../agent-harness/core/proxy-policy.js';

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.pathname === '/dev') {
    url.pathname = '/dev/';
    return Response.redirect(url.toString(), 308);
  }

  const proxyPath = Object.keys(PROXY_TARGETS).find((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));

  if (!proxyPath) {
    return context.next();
  }

  let sameOrigin = false;
  try { sameOrigin = Boolean(context.request.headers.get('origin')) && new URL(context.request.headers.get('origin')).origin === url.origin; } catch {}
  const upstreamPath = url.pathname.slice(proxyPath.length) || '/';
  const denial = proxyRouteDenial({
    proxyPath,
    method: context.request.method,
    pathname: upstreamPath,
    authorization: context.request.headers.get('authorization'),
    sameOrigin,
    requireBearer: proxyPath.endsWith('-api'),
  });
  if (denial) return Response.json({ ok: false, error: denial.message }, { status: denial.status, headers: { 'Cache-Control': 'no-store' } });
  const upstreamUrl = new URL(upstreamPath + url.search, PROXY_TARGETS[proxyPath]);
  const headers = new Headers(context.request.headers);
  stripProxyForwardingHeaders(headers);

  return fetch(upstreamUrl, {
    method: context.request.method,
    headers,
    body: context.request.body,
    redirect: 'manual',
  });
}
