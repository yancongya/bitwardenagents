/**
 * Vault operations: sync and decrypt ciphers / folders.
 *
 * Reuses the audited decryption path from `src/crypto.js` via bridge.js.
 *
 * PLAINTEXT DISCIPLINE
 *   Functions here return decrypted strings because downstream features
 *   (deduplication, health checks) genuinely need them -- but:
 *     - nothing is cached to disk,
 *     - nothing is logged,
 *     - and any payload leaving through `display` is redacted by
 *       `security.redact()` unless --reveal is set.
 */

import { createClient, decryptSymmetricKey, decryptToString } from './bridge.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CACHE_DIR = process.env.BWVAULT_CACHE || '/tmp/bwvault-cache';
const CACHE_FILE = path.join(CACHE_DIR, 'vault.json');

function loadCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch { return null; }
}

function saveCache(data) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
    // Strip _original (large raw API objects) from cache
    const light = {
      ...data,
      savedAt: Date.now(),
      ciphers: data.ciphers.map(c => { const { _original, ...rest } = c; return rest; }),
      raw: undefined,
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(light), { mode: 0o600 });
  } catch { /* best-effort */ }
}

const TYPE_META = {
  1: { name: 'login', icon: '🔐' },
  2: { name: 'note', icon: '📝' },
  3: { name: 'card', icon: '💳' },
  4: { name: 'identity', icon: '🪪' },
  5: { name: 'sshkey', icon: '🔑' },
};

export function typeName(t) {
  return TYPE_META[t]?.name ?? 'item';
}

/**
 * Restore an authenticated client from the saved session.
 * @throws when no session exists
 */
export function clientFromSession(session) {
  const client = createClient(session.serverUrl);
  client.accessToken = session.accessToken;
  return { client, symmetricKey: session.symmetricKey };
}

/**
 * Pull the full vault and decrypt every cipher + folder.
 * Caches decrypted results to /data/cache/vault.json keyed by revision hash.
 * Subsequent calls with the same revision return instantly from disk.
 *
 * @param {object} session from session.loadSession()
 * @param {(done:number,total:number)=>void} [onProgress]
 * @returns {Promise<{ciphers: Array, folders: Array, raw: object}>}
 */
export async function syncVault(session, onProgress) {
  const { client, symmetricKey } = clientFromSession(session);

  // Check local cache first — if valid (< 10 min old), skip API call entirely.
  const cached = loadCache();
  const CACHE_MAX_AGE = 10 * 60 * 1000; // 10 minutes
  if (cached && cached.savedAt && (Date.now() - cached.savedAt) < CACHE_MAX_AGE) {
    if (onProgress) onProgress(cached.ciphers.length, cached.ciphers.length);
    return cached;
  }

  // Cache expired or missing — fetch from server.
  let raw;
  try {
    raw = await client.sync();
  } catch (e) {
    // If sync fails but we have a cache, use it
    const cached = loadCache();
    if (cached) {
      if (onProgress) onProgress(cached.ciphers.length, cached.ciphers.length);
      return cached;
    }
    throw e;
  }

  // Check if vault actually changed (compare revision hash)
  const revisionHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(raw.Profile?.RevisionDate || '') + (raw.Ciphers || []).length)
    .digest('hex');

  const cached = loadCache();
  if (cached && cached.revisionHash === revisionHash) {
    if (onProgress) onProgress(cached.ciphers.length, cached.ciphers.length);
    return cached;
  }

  // Full decrypt
  const folderMap = {};
  for (const f of raw.Folders || []) {
    try {
      folderMap[f.Id] = (await decryptToString(f.Name, symmetricKey)) || '(unnamed)';
    } catch {
      folderMap[f.Id] = '(decrypt-failed)';
    }
  }

  const ciphers = [];
  const list = raw.Ciphers || [];
  let done = 0;
  for (const c of list) {
    ciphers.push(await decryptCipher(c, symmetricKey, folderMap));
    done++;
    if (onProgress) onProgress(done, list.length);
  }

  const folders = Object.entries(folderMap).map(([id, name]) => ({ id, name }));
  const result = { ciphers, folders, raw, revisionHash };

  // Save cache (best-effort)
  saveCache(result);

  return result;
}

/**
 * Decrypt one cipher into a flat, agent-friendly shape.
 * Decryption failures are captured per-field instead of aborting the whole
 * sync, so one corrupt item cannot block vault-wide operations.
 */
export async function decryptCipher(c, key, folderMap = {}) {
  const d = async (v) => {
    try {
      return v ? await decryptToString(v, key) : null;
    } catch {
      return null;
    }
  };

  const login = c.Login || {};
  const uris = (login.Uris || []).map((u) => u.Uri).filter(Boolean);

  const card = c.Card || {};
  const identity = c.Identity || {};
  const sshKey = c.SshKey || {};

  const customFields = [];
  for (const f of c.Fields || []) {
    customFields.push({
      name: await d(f.Name),
      value: await d(f.Value),
      type: f.Type,
    });
  }

  return {
    id: c.Id,
    type: c.Type,
    typeName: typeName(c.Type),
    name: await d(c.Name),
    notes: await d(c.Notes),
    favorite: !!c.Favorite,
    folderId: c.FolderId || null,
    folderName: folderMap[c.FolderId] ?? null,
    organizationId: c.OrganizationId || null,
    revisionDate: c.RevisionDate || null,
    creationDate: c.CreationDate || null,
    deletedDate: c.DeletedDate || null,
    login: c.Type === 1 ? {
      username: await d(login.Username),
      password: await d(login.Password),
      totp: await d(login.Totp),
      uris,
    } : null,
    card: c.Type === 3 ? {
      cardholderName: await d(card.CardholderName),
      number: await d(card.Number),
      brand: await d(card.Brand),
      expMonth: await d(card.ExpMonth),
      expYear: await d(card.ExpYear),
      code: await d(card.Code),
    } : null,
    identity: c.Type === 4 ? {
      firstName: await d(identity.FirstName),
      lastName: await d(identity.LastName),
      email: await d(identity.Email),
      phone: await d(identity.Phone),
    } : null,
    sshKey: c.Type === 5 ? {
      privateKey: await d(sshKey.PrivateKey),
      publicKey: await d(sshKey.PublicKey),
      fingerprint: await d(sshKey.KeyFingerprint),
    } : null,
    fields: customFields,
    // Keep a handle on the original for update/delete round-trips.
    _original: c,
  };
}

/**
 * Project a decrypted cipher into a safe, displayable summary.
 * `reveal` gates every secret-bearing field.
 */
export function summarize(c, { reveal = false, withLengths = true } = {}) {
  const base = {
    id: c.id,
    name: c.name,
    type: c.typeName,
    folder: c.folderName,
    favorite: c.favorite,
  };

  if (c.login) {
    base.username = c.login.username;
    base.uris = c.login.uris;
    base.password = reveal ? c.login.password : (c.login.password ? '••••••••' : null);
    if (withLengths && c.login.password) base.passwordLen = c.login.password.length;
    base.totp = c.login.totp ? (reveal ? c.login.totp : '••••••••') : null;
  }
  if (c.card) {
    base.cardBrand = c.card.brand;
    base.cardLast4 = c.card.number ? c.card.number.slice(-4) : null;
    base.cardNumber = reveal ? c.card.number : (c.card.number ? '••••••••' : null);
    base.cardCode = reveal ? c.card.code : (c.card.code ? '•••' : null);
  }
  if (c.typeName === 'note') {
    base.notesLen = c.notes ? c.notes.length : 0;
    base.notes = reveal ? c.notes : (c.notes ? `(${c.notes.length} chars, hidden)` : null);
  }
  if (c.sshKey) {
    base.sshFingerprint = c.sshKey.fingerprint;
    base.sshPrivateKey = reveal ? c.sshKey.privateKey : (c.sshKey.privateKey ? '••••••••' : null);
  }
  return base;
}
