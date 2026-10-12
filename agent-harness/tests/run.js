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
import { proxyRequestDenial } from '../core/proxy-policy.js';

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

// ── manage move (mocked remote API; never connects to a vault) ──
const moveFixture = () => {
  const original = {
    Id: 'fixture-item-1', Type: 1, Name: 'enc-name', FolderId: null,
    Key: 'fixture-item-key', Login: { Password: 'enc-password', Fido2Credentials: [{ CredentialId: 'fixture-key' }] },
    Fields: [{ Name: 'enc-field', Value: 'enc-value' }],
  };
  const calls = [];
  let remoteSync = false;
  const dependencies = {
    prepareFn: async (_opts, config) => {
      remoteSync = config.forceRemote === true;
      return {
        ciphers: [
          { id: 'fixture-item-1', deletedDate: null, _original: { _original: original } },
          { id: 'fixture-item-fail', deletedDate: null, _original: { _original: original } },
          { id: 'fixture-item-forbidden', deletedDate: null, _original: { _original: original } },
          { id: 'fixture-item-network', deletedDate: null, _original: { _original: original } },
        ],
        folders: [{ id: 'fixture-folder-1', name: 'fixture-folder-name' }],
        client: { bulkMoveCiphersToFolder: async (ids, folderId) => {
          calls.push({ ids, folderId });
          if (ids[0] === 'fixture-item-fail') throw new Error('sensitive API detail');
          if (ids[0] === 'fixture-item-forbidden') throw new Error('Bulk move failed: 403');
          if (ids[0] === 'fixture-item-network') throw Object.assign(new Error('sensitive network detail'), { code: 'ETIMEDOUT' });
        } },
      };
    },
  };
  return { original, calls, dependencies, didSync: () => remoteSync };
};

{
  const fixture = moveFixture();
  const result = await moveItems({ ids: ['fixture-item-1'], folderId: 'fixture-folder-1' }, fixture.dependencies);
  assert(fixture.didSync(), 'manage move forces a remote sync during dry-run');
  assert(fixture.calls.length === 0, 'manage move dry-run performs no API update');
  assert(result.dryRun && result.summary.wouldMove === 1, 'manage move dry-run reports planned item count');
  assert(!JSON.stringify(result).includes('fixture-item-1'), 'manage move output omits item IDs');
}

{
  const fixture = moveFixture();
  const result = await moveItems({ ids: ['fixture-item-1'], folderId: 'fixture-folder-1', apply: true }, fixture.dependencies);
  assert(fixture.didSync() && fixture.calls.length === 1, 'manage move apply forces remote sync and moves the exact item');
  assert(JSON.stringify(fixture.calls[0]?.ids) === JSON.stringify(['fixture-item-1'])
    && fixture.calls[0]?.folderId === 'fixture-folder-1', 'manage move sends exact ID and target to the dedicated move API');
  assert(typeof fixture.calls[0]?.cipher === 'undefined'
    && fixture.original.Key === 'fixture-item-key' && fixture.original.Login.Password === 'enc-password',
  'manage move does not rewrite cipher fields or its per-item key');
  assert(result.ok && result.summary.moved === 1 && !JSON.stringify(result).includes('fixture-item-1'),
    'manage move reports only a non-sensitive success summary');
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

// ── summary ──
console.log(`\n1..${pass + fail}`);
if (fail) {
  console.log(`# FAILED ${fail}/${pass + fail}`);
  process.exitCode = 1;
} else {
  console.log(`# ALL ${pass} PASSED`);
}
