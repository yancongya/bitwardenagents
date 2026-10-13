/**
 * Minimal test harness — zero external deps.
 *
 * Run:   node agent-harness/tests/run.js
 *        node agent-harness/tests/run.js --filter security
 *
 * Outputs TAP-style lines to stdout; exits 0 when all pass, 1 otherwise.
 */

import { redact, isSensitive, digestSecret, strengthBucket } from '../core/security.js';
import { sessionStatus, saveSession, loadSession, clearSession } from '../core/session.js';
import { emit } from '../core/display.js';
import { credentialItemName, normalizeAlias } from '../commands/credential.js';
import { move as moveItems } from '../commands/manage.js';
import { BitwardenClient } from '../../src/bitwarden-api.js';
import { proxyRequestDenial, proxyScopesForToken, PROXY_SCOPES } from '../core/proxy-policy.js';

let pass = 0, fail = 0;

function assert(cond, label) {
  if (cond) {
    pass++;
    console.log(`ok ${pass} ${label}`);
  } else {
    fail++;
    console.log(`not ok ${fail} ${label}`);
  }
}

function assertEqual(a, b, label) {
  assert(JSON.stringify(a) === JSON.stringify(b), `${label} (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`);
}

// ── security.js ──
assert(isSensitive('password') === true, 'isSensitive("password")');
assert(isSensitive('notes') === false, 'isSensitive("notes")');
assert(isSensitive('cardCode') === true, 'isSensitive("cardCode")');

const redacted = redact({ name: 'A', password: 's3cret', totp: '123' });
assertEqual(redacted.password, '••••••••', 'redact hides password');
assertEqual(redacted.totp, '••••••••', 'redact hides totp');
assertEqual(redacted.name, 'A', 'redact preserves non-sensitive');

const reveal = redact(redacted, { reveal: true });
assertEqual(reveal.password, '••••••••', 'reveal on already-redacted keeps redacted');

const original = { name: 'B', password: 's3cret' };
const revealed = redact(original, { reveal: true });
assertEqual(revealed.password, 's3cret', 'reveal preserves original password');
assertEqual(revealed.name, 'B', 'reveal preserves name');

assertEqual(strengthBucket(0), 'empty', 'strengthBucket empty');
assertEqual(strengthBucket(5), 'very-weak', 'strengthBucket very-weak');
assertEqual(strengthBucket(10), 'weak', 'strengthBucket weak');
assertEqual(strengthBucket(14), 'moderate', 'strengthBucket moderate');
assertEqual(strengthBucket(20), 'strong', 'strengthBucket strong');

const h1 = await digestSecret('password');
const h2 = await digestSecret('password');
const h3 = await digestSecret('different');
assert(h1 === h2, 'digestSecret is deterministic');
assert(h1 !== h3, 'digestSecret differs for different inputs');
assert(h1.length === 64, 'digestSecret is SHA-256 hex');

// Nested redaction
const nested = { login: { username: 'u', password: 'p' } };
const nr = redact(nested);
assertEqual(nr.login.password, '••••••••', 'redact traverses nested objects');

// ── session.js (dry run, no real file I/O beyond the temp test file) ──
const st = sessionStatus();
assert(typeof st.authenticated === 'boolean', 'sessionStatus returns boolean');

// ── emit ──
assert(typeof emit === 'function', 'emit is callable');

// ── credential aliases ──
assertEqual(normalizeAlias(' NAS.SSH '), 'nas.ssh', 'credential alias is normalized');
assertEqual(credentialItemName('nas.ssh'), 'Agent Credential: nas.ssh', 'credential item name is stable');
let rejectedAlias = false;
try { normalizeAlias('../secret'); } catch { rejectedAlias = true; }
assert(rejectedAlias, 'credential alias rejects path-like input');

// ── browser proxy authorization (pure policy; no network or vault access) ──
const proxyRequest = (overrides = {}) => proxyRequestDenial({
  proxyPath: '/bw-api', method: 'GET', pathname: '/sync',
  authorization: 'Bearer active-session', sessionToken: 'active-session',
  pinSet: true, unlocked: true, sameOrigin: true, ...overrides,
});
assertEqual(proxyRequest(), null, 'vault sync is allowed for an authenticated unlocked session');
assertEqual(proxyRequest({ sessionToken: null, issuedTokens: ['just-issued-token'], authorization: 'Bearer just-issued-token' }), null, 'initial vault sync allows only a token just issued by the same-origin login flow');
assertEqual(proxyRequest({ authorization: 'Bearer other-session' })?.status, 401, 'vault proxy rejects a different bearer token');
assertEqual(proxyRequest({ unlocked: false })?.status, 401, 'vault proxy requires PIN unlock when configured');
assertEqual(proxyRequest({ pathname: '/ciphers/delete-admin', method: 'GET' })?.status, 403, 'vault proxy rejects unsupported method/path combinations');
for (const [method, pathname] of [
  ['PUT', '/ciphers/delete'], ['PUT', '/ciphers/delete-admin'], ['DELETE', '/ciphers/delete'],
  ['PUT', '/ciphers/move'], ['PUT', '/ciphers/restore'],
]) {
  assertEqual(proxyRequest({ method, pathname }), null, `vault proxy allows the Web UI ${method} ${pathname} operation`);
}
assertEqual(proxyRequest({ pathname: '/organizations' })?.status, 403, 'vault proxy rejects unlisted Bitwarden APIs');
assertEqual(proxyRequest({ pathname: '/ciphers/item/extra', method: 'GET' })?.status, 403, 'vault proxy rejects nested item routes');
assertEqual(proxyRequest({ pathname: '/ciphers/00000000-0000-4000-8000-000000000001', method: 'DELETE', sameOrigin: false })?.status, 403, 'vault proxy rejects cross-origin writes');
assertEqual(proxyRequest({ proxyPath: '/bw-identity', pathname: '/connect/token', method: 'POST', sameOrigin: true, sessionToken: null, authorization: null, pinSet: false, unlocked: false }), null, 'identity proxy allows same-origin token login without an existing session');
assertEqual(proxyRequest({ proxyPath: '/bw-identity', pathname: '/admin/users', method: 'POST', sameOrigin: true }), { status: 403, message: 'Identity route is not allowed.' }, 'identity proxy rejects unlisted routes');

const scopedProxyRequest = (overrides = {}) => proxyRequest({ grantedScopes: [PROXY_SCOPES.READ], ...overrides });
assertEqual(scopedProxyRequest()?.status, 403, 'read scope cannot read vault sync payload');
assertEqual(scopedProxyRequest({ pathname: '/folders' }), null, 'read scope allows folder metadata');
assertEqual(scopedProxyRequest({ pathname: '/ciphers', grantedScopes: [PROXY_SCOPES.SECRETS] }), null, 'secrets scope allows cipher payload');
assertEqual(scopedProxyRequest({ pathname: '/ciphers/00000000-0000-4000-8000-000000000001' })?.status, 403, 'read scope cannot read item secrets');
assertEqual(scopedProxyRequest({ method: 'POST', pathname: '/ciphers', grantedScopes: [PROXY_SCOPES.WRITE] }), null, 'write scope allows cipher writes');
assertEqual(scopedProxyRequest({ method: 'POST', pathname: '/ciphers', grantedScopes: [PROXY_SCOPES.READ] })?.status, 403, 'read scope cannot write ciphers');
assertEqual(scopedProxyRequest({ method: 'PUT', pathname: '/ciphers/delete', grantedScopes: [PROXY_SCOPES.WRITE] })?.status, 403, 'write scope cannot delete ciphers');
assertEqual(scopedProxyRequest({ method: 'PUT', pathname: '/ciphers/delete', grantedScopes: [PROXY_SCOPES.DELETE] }), null, 'delete scope allows cipher deletion');
assertEqual(scopedProxyRequest({ method: 'DELETE', pathname: '/folders/00000000-0000-4000-8000-000000000001', grantedScopes: [PROXY_SCOPES.WRITE] })?.status, 403, 'write scope cannot delete a folder');
assertEqual(scopedProxyRequest({ method: 'DELETE', pathname: '/folders/00000000-0000-4000-8000-000000000001', grantedScopes: [PROXY_SCOPES.DELETE] }), null, 'delete scope allows folder deletion');
assertEqual(scopedProxyRequest({ grantedScopes: undefined }), null, 'omitted scopes preserve legacy UI behavior');
assertEqual(proxyScopesForToken({ authorization: 'Bearer saved-session', sessionToken: 'saved-session', configuredScopes: [PROXY_SCOPES.READ] }), [PROXY_SCOPES.READ], 'configured scope applies to persisted server session token');
assertEqual(proxyScopesForToken({ authorization: 'Bearer saved-session', sessionToken: 'saved-session' }), undefined, 'no configured scopes preserve saved session behavior');
assertEqual(proxyScopesForToken({ authorization: 'Bearer issued-token', issuedTokenScopes: new Map([['issued-token', [PROXY_SCOPES.SECRETS]]]) }), [PROXY_SCOPES.SECRETS], 'issued API token gets its server-side scope grant');
assertEqual(proxyScopesForToken({ authorization: 'Bearer attacker-token', sessionToken: 'saved-session', configuredScopes: [PROXY_SCOPES.READ] }), undefined, 'unrecognized bearer token receives no scope grant');

// ── manage move (mocked remote API; never connects to a vault) ──
const moveFixture = ({ moveErrors = {}, waitFn = async () => {}, randomFn = () => 0 } = {}) => {
  const original = {
    Id: 'fixture-item-1', Type: 1, Name: 'enc-name', FolderId: null,
    Key: 'fixture-item-key', Login: { Password: 'enc-password', Fido2Credentials: [{ CredentialId: 'fixture-key' }] },
    Fields: [{ Name: 'enc-field', Value: 'enc-value' }],
  };
  const calls = [];
  let remoteSync = false;
  let verifyCalls = 0;
  const ciphers = [
    { id: 'fixture-item-1', deletedDate: null, folderId: null, _original: { _original: original } },
    { id: 'fixture-item-fail', deletedDate: null, folderId: null, _original: { _original: original } },
    { id: 'fixture-item-forbidden', deletedDate: null, folderId: null, _original: { _original: original } },
    { id: 'fixture-item-network', deletedDate: null, folderId: null, _original: { _original: original } },
  ];
  const dependencies = {
    prepareFn: async (_opts, config) => {
      remoteSync = config.forceRemote === true;
      return {
        ciphers,
        folders: [{ id: 'fixture-folder-1', name: 'fixture-folder-name' }],
        client: { bulkMoveCiphersToFolder: async (ids, folderId) => {
          calls.push({ ids, folderId });
          const configuredErrors = moveErrors[ids[0]];
          if (configuredErrors?.length) throw configuredErrors.shift();
          if (ids[0] === 'fixture-item-fail') throw new Error('sensitive API detail');
          if (ids[0] === 'fixture-item-forbidden') throw new Error('Bulk move failed: 403');
          if (ids[0] === 'fixture-item-network') throw Object.assign(new Error('sensitive network detail'), { code: 'ETIMEDOUT' });
          ciphers.find((cipher) => cipher.id === ids[0]).folderId = folderId;
        } },
      };
    },
    verifyFn: async () => { verifyCalls++; return ciphers; },
    waitFn,
    randomFn,
  };
  return { original, calls, ciphers, dependencies, didSync: () => remoteSync, verifyCalls: () => verifyCalls };
};

{
  const fixture = moveFixture();
  const result = await moveItems({ ids: ['fixture-item-1'], folderId: 'fixture-folder-1' }, fixture.dependencies);
  assert(fixture.didSync(), 'manage move forces a remote sync during dry-run');
  assert(fixture.calls.length === 0, 'manage move dry-run performs no API update');
  assert(fixture.verifyCalls() === 0, 'manage move dry-run skips post-write verification');
  assert(result.dryRun && result.summary.wouldMove === 1, 'manage move dry-run reports planned item count');
  assert(!JSON.stringify(result).includes('fixture-item-1'), 'manage move output omits item IDs');
}

{
  const delays = [];
  const fixture = moveFixture({
    moveErrors: { 'fixture-item-1': [Object.assign(new Error('Bulk move failed: 429'), { statusCode: 429, retryAfterMs: 500 })] },
    waitFn: async (ms) => delays.push(ms),
  });
  const result = await moveItems(
    { ids: ['fixture-item-1'], folderId: 'fixture-folder-1', apply: true },
    fixture.dependencies,
  );
  assert(result.ok && result.summary.moved === 1 && fixture.calls.length === 2,
    'manage move retries a rate-limited item and verifies the eventual move');
  assertEqual(delays, [500], 'manage move honors a valid Retry-After delay');
}

{
  const delays = [];
  const repeated429 = () => Object.assign(new Error('Bulk move failed: 429'), { statusCode: 429 });
  const fixture = moveFixture({
    moveErrors: { 'fixture-item-1': [repeated429(), repeated429(), repeated429(), repeated429()] },
    waitFn: async (ms) => delays.push(ms),
  });
  const result = await moveItems(
    { ids: ['fixture-item-1', 'fixture-item-forbidden'], folderId: 'fixture-folder-1', apply: true },
    fixture.dependencies,
  );
  assert(result.summary.failures.rateLimited === 1 && result.summary.failures.rateLimitStopped === 1,
    'manage move reports exhausted rate limit and stops the remaining batch');
  assert(fixture.calls.length === 4 && delays.length === 3,
    'manage move uses a finite retry limit and does not submit later items after 429');
  assertEqual(delays, [1000, 2000, 4000], 'manage move applies bounded exponential backoff when Retry-After is absent');
  assert(!JSON.stringify(result).includes('Retry-After') && !JSON.stringify(result).includes('429'),
    'manage move keeps rate-limit response details out of its summary');
}

{
  const originalFetch = globalThis.fetch;
  const client = new BitwardenClient('http://127.0.0.1');
  client.accessToken = 'test-only-token';
  globalThis.fetch = async () => new Response('private response body', {
    status: 429,
    headers: { 'Retry-After': '2' },
  });
  try {
    let caught;
    try {
      await client.bulkMoveCiphersToFolder(['test-only-id'], 'test-only-folder');
    } catch (error) {
      caught = error;
    }
    assert(caught?.statusCode === 429 && caught?.retryAfterMs === 2000,
      'Bitwarden move API preserves only status and parsed Retry-After metadata for rate limits');
    assert(!String(caught).includes('private response body'),
      'Bitwarden move API does not copy the rate-limit response body into its error');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

{
  const originalFetch = globalThis.fetch;
  const client = new BitwardenClient('http://127.0.0.1');
  client.accessToken = 'test-only-token';
  globalThis.fetch = async () => new Response('', {
    status: 429,
    headers: { 'Retry-After': '-1' },
  });
  try {
    let caught;
    try {
      await client.bulkMoveCiphersToFolder(['test-only-id'], 'test-only-folder');
    } catch (error) {
      caught = error;
    }
    assert(caught?.statusCode === 429 && caught?.retryAfterMs === undefined,
      'Bitwarden move API ignores malformed Retry-After values so bounded backoff is used');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

{
  const fixture = moveFixture();
  const result = await moveItems({ ids: ['fixture-item-1'], folderId: 'fixture-folder-1', apply: true }, fixture.dependencies);
  assert(fixture.didSync() && fixture.calls.length === 1, 'manage move apply forces remote sync and moves the exact item');
  assert(fixture.verifyCalls() === 1, 'manage move apply forces a second remote sync to verify the folder');
  assert(JSON.stringify(fixture.calls[0]?.ids) === JSON.stringify(['fixture-item-1'])
    && fixture.calls[0]?.folderId === 'fixture-folder-1', 'manage move sends exact ID and target to the dedicated move API');
  assert(typeof fixture.calls[0]?.cipher === 'undefined'
    && fixture.original.Key === 'fixture-item-key' && fixture.original.Login.Password === 'enc-password',
  'manage move does not rewrite cipher fields or its per-item key');
  assert(result.ok && result.summary.moved === 1 && !JSON.stringify(result).includes('fixture-item-1'),
    'manage move reports a remotely verified non-sensitive success summary');
}

{
  const fixture = moveFixture();
  const result = await moveItems({
    ids: ['fixture-item-fail', 'fixture-item-forbidden', 'fixture-item-network', 'missing-from-sync', 'fixture-item-1'],
    folderId: 'none', apply: true,
  }, fixture.dependencies);
  assert(result.summary.failed === 4 && result.summary.moved === 1, 'manage move reports per-item batch failures');
  assert(result.summary.failures.requestError === 1
    && result.summary.failures.forbidden === 1
    && result.summary.failures.network === 1
    && result.summary.failures.notInRemoteSync === 1,
  'manage move reports safe failure category counts');
  assert(fixture.calls.length === 4 && fixture.calls[3].folderId === null,
    'manage move supports No Folder and continues after an item failure');
  assert(!JSON.stringify(result).includes('fixture-item-fail')
    && !JSON.stringify(result).includes('sensitive API detail')
    && !JSON.stringify(result).includes('sensitive network detail')
    && !JSON.stringify(result).includes('403'),
  'manage move failure summary omits IDs, HTTP details and API error text');
}

{
  const fixture = moveFixture();
  const result = await moveItems(
    { ids: ['fixture-item-1'], folderId: 'fixture-folder-1', apply: true },
    { ...fixture.dependencies, verifyFn: async () => [{ id: 'fixture-item-1', folderId: null }] },
  );
  assert(result.summary.moved === 0 && result.summary.failed === 1 && result.summary.failures.notApplied === 1,
    'manage move does not report success when the remote folder did not change');
}

{
  const fixture = moveFixture();
  const result = await moveItems(
    { ids: ['fixture-item-1'], folderId: 'fixture-folder-1', apply: true },
    { ...fixture.dependencies, verifyFn: async () => { throw new Error('private sync detail'); } },
  );
  assert(result.summary.moved === 0 && result.summary.failed === 1 && result.summary.failures.verificationUnavailable === 1,
    'manage move fails closed when remote verification is unavailable');
  assert(!JSON.stringify(result).includes('private sync detail'), 'manage move verification errors remain redacted');
}

// ── summary ──
console.log(`\n1..${pass + fail}`);
if (fail) {
  console.log(`# FAILED ${fail}/${pass + fail}`);
  process.exitCode = 1;
} else {
  console.log(`# ALL ${pass} PASSED`);
}
