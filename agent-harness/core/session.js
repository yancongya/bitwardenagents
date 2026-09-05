/**
 * Session persistence for the CLI.
 *
 * Stores only what is needed to talk to the API and decrypt locally:
 *   - serverUrl, accessToken, refreshToken
 *   - the derived symmetric key (encKey + macKey) as base64
 *
 * SECURITY NOTES
 *   - The session file is created with mode 0600 (owner read/write only).
 *   - The MASTER PASSWORD is never written to disk. It exists in memory only
 *     for the duration of a login and is discarded immediately after key
 *     derivation.
 *   - The symmetric key on disk is what allows decryption without re-entering
 *     the master password; treat the session dir as sensitive. Use
 *     `bwvault auth logout` to clear it.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SESSION_DIR = process.env.BWVAULT_HOME || path.join(os.homedir(), '.bwvault');
const SESSION_FILE = path.join(SESSION_DIR, 'session.json');

function ensureDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true, mode: 0o700 });
  }
}

const u8ToB64 = (u8) => Buffer.from(u8).toString('base64');
const b64ToU8 = (b64) => new Uint8Array(Buffer.from(b64, 'base64'));

/**
 * Persist a session. Creates the file with 0600 before writing, so there is no
 * window where the key material is world-readable.
 */
export function saveSession(session) {
  ensureDir();
  const payload = {
    serverUrl: session.serverUrl,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken || null,
    encKey: u8ToB64(session.symmetricKey.encKey),
    macKey: u8ToB64(session.symmetricKey.macKey),
    email: session.email || null,
    kdf: session.kdf || null,
    savedAt: Date.now(),
  };

  // mode 0o600 on create; then chmod in case the file already existed loosely.
  const fd = fs.openSync(SESSION_FILE, 'w', 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(payload, null, 2));
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.chmodSync(SESSION_FILE, 0o600);
  } catch {
    /* chmod unsupported (e.g. some Windows mounts) -- best effort */
  }
  return payload;
}

/**
 * Load the session, or null when absent/corrupt.
 */
export function loadSession() {
  if (!fs.existsSync(SESSION_FILE)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    return {
      ...raw,
      symmetricKey: {
        encKey: b64ToU8(raw.encKey),
        macKey: b64ToU8(raw.macKey),
      },
    };
  } catch {
    return null;
  }
}

/**
 * Delete the session file (logout).
 */
export function clearSession() {
  if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
  return true;
}

/**
 * Non-secret session summary, safe to print.
 */
export function sessionStatus() {
  const s = loadSession();
  if (!s) {
    return { authenticated: false, sessionFile: SESSION_FILE };
  }
  let mode = null;
  try {
    mode = (fs.statSync(SESSION_FILE).mode & 0o777).toString(8);
  } catch {
    /* ignore */
  }
  return {
    authenticated: true,
    sessionFile: SESSION_FILE,
    fileMode: mode,
    serverUrl: s.serverUrl,
    email: s.email,
    savedAt: s.savedAt ? new Date(s.savedAt).toISOString() : null,
    // Age in minutes is handy for agents deciding whether to re-auth.
    ageMinutes: s.savedAt ? Math.round((Date.now() - s.savedAt) / 60000) : null,
  };
}

export const SESSION_PATHS = { SESSION_DIR, SESSION_FILE };
