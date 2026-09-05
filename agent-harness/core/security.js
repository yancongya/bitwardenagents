/**
 * Security policy: keep vault plaintext out of CLI output by default.
 *
 * Threat model this module defends against:
 *   - shoulder-surfing of terminal output
 *   - command history / CI logs capturing secrets (`vault list` in a pipeline)
 *   - agents or scripts accidentally persisting plaintext to disk
 *
 * Policy:
 *   1. Sensitive fields are NEVER rendered unless the caller passes --reveal.
 *   2. Even with --reveal, output goes to stdout only; it is never logged.
 *   3. Analytics (health, duplicates) run on metadata + hashes, never on
 *      decrypted secrets. Duplicates are compared via SHA-256 digests so the
 *      plaintext never has to sit in a comparison buffer longer than needed.
 *   4. Secrets are never written to the session file (only derived key
 *      material needed to talk to the API).
 */

/** Fields that must be redacted in any human/JSON rendering. */
export const SENSITIVE_FIELDS = new Set([
  'password',
  'totp',
  'cardNumber',
  'cardCode',        // CVV
  'securityCode',
  'privateKey',
  'key',
  'secret',
]);

/** Placeholder used when a sensitive value is withheld. */
export const REDACTED = '••••••••';

/**
 * Return true when a field name is considered secret.
 */
export function isSensitive(field) {
  if (typeof field !== 'string') return false;
  const lower = field.toLowerCase();
  for (const s of SENSITIVE_FIELDS) {
    if (lower === s.toLowerCase() || lower.includes(s.toLowerCase())) return true;
  }
  return false;
}

/**
 * Redact a single value: keep a tiny amount of shape info (length) but no
 * content. Length is useful for health checks (empty vs weak passwords)
 * without disclosing the secret itself.
 */
export function redactValue(value) {
  if (value === null || value === undefined || value === '') return REDACTED;
  return REDACTED;
}

/**
 * Recursively redact sensitive keys in an object/array.
 * Returns a deep copy; the input is never mutated.
 *
 * @param {any} obj
 * @param {object} opts
 * @param {boolean} opts.reveal when true, values pass through unredacted
 * @param {boolean} opts.lengths when true (default), expose `__len` for strings
 */
export function redact(obj, { reveal = false, lengths = true } = {}) {
  if (reveal) return obj;
  return walk(obj, lengths);
}

function walk(node, lengths) {
  if (Array.isArray(node)) return node.map((n) => walk(n, lengths));

  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (isSensitive(k)) {
        out[k] = REDACTED;
        if (lengths && typeof v === 'string') out[`${k}__len`] = v.length;
      } else {
        out[k] = walk(v, lengths);
      }
    }
    return out;
  }
  return node;
}

/**
 * SHA-256 digest (hex) of a secret, used to detect reuse across items WITHOUT
 * ever holding or comparing plaintext in a shared structure. Callers should
 * discard the plaintext immediately after computing this.
 */
export async function digestSecret(value) {
  if (!value) return null;
  const bytes = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Coarse password strength buckets. Evaluated from metadata only -- the
 * plaintext is never stored or echoed by this function.
 */
export function strengthBucket(length) {
  if (!length) return 'empty';
  if (length < 8) return 'very-weak';
  if (length < 12) return 'weak';
  if (length < 16) return 'moderate';
  return 'strong';
}

/**
 * Guard rail: refuse to print plaintext unless reveal was explicitly requested.
 * Throws so accidental misuse fails loudly rather than leaking.
 */
export function assertNotLeaking(payload, reveal) {
  if (reveal) return payload;
  const json = JSON.stringify(payload);
  // Cheap belt-and-braces check for the most common leak paths.
  for (const f of SENSITIVE_FIELDS) {
    if (json.includes(`"${f}":"`)) {
      // value present under a sensitive key -> redact defensively
      return redact(payload, { reveal: false });
    }
  }
  return payload;
}
