/**
 * Session storage primitives.
 * Pure persistence layer — no app state dependencies.
 */

const SESSION_KEY = 'bw_session';

export function _u8ToB64(u8) {
  return btoa(String.fromCharCode(...u8));
}

export function _b64ToU8(b64) {
  const bin = atob(b64);
  return new Uint8Array([...bin].map(c => c.charCodeAt(0)));
}

export function saveSession(serverUrl, accessToken, symKey, deviceIdentifier = null, refreshToken = null) {
  try {
    const payload = {
      serverUrl,
      accessToken,
      refreshToken,
      encKey: _u8ToB64(symKey.encKey),
      macKey: _u8ToB64(symKey.macKey),
      deviceIdentifier,
      savedAt: Date.now(),
    };
    // Persist to both browser storage and server (for CLI/Docker sharing)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {}); // best-effort, don't block
  } catch (e) {
    console.warn('[Session] Failed to save:', e);
  }
}

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      serverUrl: data.serverUrl || '',
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || null,
      encKey: _b64ToU8(data.encKey),
      macKey: _b64ToU8(data.macKey),
      deviceIdentifier: data.deviceIdentifier || null,
    };
  } catch {
    return null;
  }
}

export function clearSession() {
  // Only clear browser-side storage. Never delete the server-side session —
  // that's the single source of truth for Docker/CLI sharing. Server session
  // is only cleared by explicit CLI "auth logout".
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export { SESSION_KEY };
