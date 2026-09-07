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

// ── summary ──
console.log(`\n1..${pass + fail}`);
if (fail) {
  console.log(`# FAILED ${fail}/${pass + fail}`);
  process.exitCode = 1;
} else {
  console.log(`# ALL ${pass} PASSED`);
}
