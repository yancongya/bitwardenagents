/**
 * Credential file encryption/decryption (AES-256-GCM).
 * Extracted from app.js — pure WebCrypto, no DOM/app dependencies.
 */

const CRED_APP_SALT = 'BW-VaultManager-CredFile-v1';

async function deriveCredFileKey() {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(CRED_APP_SALT), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('bw-credfile-salt-2026'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptCredentials(data) {
  const key = await deriveCredFileKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  // Combine: [12-byte IV][ciphertext] then Base64-encode for text-based download
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  // Convert to Base64 string
  let binary = '';
  for (let i = 0; i < combined.length; i++) binary += String.fromCharCode(combined[i]);
  return btoa(binary);
}

export async function decryptCredentials(buffer) {
  const key = await deriveCredFileKey();
  let data;
  // Support both Base64 text (new) and raw binary (legacy)
  if (buffer instanceof ArrayBuffer) {
    const text = new TextDecoder().decode(buffer);
    try {
      // Try Base64 decode first
      const binary = atob(text.trim());
      data = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
    } catch {
      // Fallback: raw binary
      data = new Uint8Array(buffer);
    }
  } else {
    data = new Uint8Array(buffer);
  }
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(decrypted));
}
