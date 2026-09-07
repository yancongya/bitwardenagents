/**
 * Secret intake for the CLI.
 *
 * CLI-Anything rule: never require secrets as command arguments. A password on
 * argv leaks into shell history, `ps` output and CI logs. This module prefers,
 * in order:
 *   1. interactive TTY prompt (echo suppressed)  -> best for humans
 *   2. stdin                                     -> best for agents/scripts
 *   3. environment variable                      -> best for CI
 *
 * The master password is used ONLY to derive keys and is then dropped; it is
 * never persisted (see core/session.js).
 */

import readline from 'node:readline';

/**
 * Prompt on a TTY with echo disabled.
 */
function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr, // keep stdout clean for JSON
      terminal: true,
    });
    // Suppress echo by intercepting the write of each keystroke.
    const origWrite = process.stderr.write.bind(process.stderr);
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
    rl._writeToOutput = function () {
      /* swallow echo */
    };
    // Restore normal output after the prompt finishes.
    rl.on('close', () => {
      process.stderr.write = origWrite;
    });
  });
}

/**
 * Read a full stream as a string (used for piped stdin).
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

/**
 * Obtain the master password.
 *
 * @param {object} opts
 * @param {string} [opts.value]      explicitly supplied (discouraged)
 * @param {string} [opts.envVar]     env var name to fall back on
 * @param {boolean} [opts.allowPrompt] permit interactive prompt when TTY
 * @param {string} [opts.prompt]     prompt label
 * @returns {Promise<string|null>}
 */
export async function getMasterPassword({
  value,
  envVar = 'BWVAULT_PASSWORD',
  allowPrompt = true,
  prompt = 'Master password: ',
} = {}) {
  if (value) return value;

  if (process.env[envVar]) return process.env[envVar];

  // Piped stdin (non-TTY): read it fully.
  if (!process.stdin.isTTY) {
    const piped = await readStdin();
    const trimmed = piped.replace(/\r?\n$/, '');
    if (trimmed) return trimmed;
  }

  if (allowPrompt && process.stdin.isTTY) {
    return promptHidden(prompt);
  }

  return null;
}

/** Obtain a generic credential secret without accepting it on argv. */
export async function getCredentialSecret({
  envVar = 'BWVAULT_SECRET',
  allowPrompt = true,
  prompt = 'Credential secret: ',
} = {}) {
  return getMasterPassword({ envVar, allowPrompt, prompt });
}

/**
 * Read a one-time code (new-device verification / 2FA) from TTY or stdin.
 */
export async function getOneTimeCode(prompt = 'Verification code: ') {
  if (!process.stdin.isTTY) {
    const piped = await readStdin();
    const trimmed = piped.replace(/\r?\n$/, '');
    if (trimmed) return trimmed;
    return null;
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Best-effort scrub of a string from memory. JS strings are immutable so this
 * cannot guarantee erasure, but it narrows the window and documents intent.
 */
export function scrub(s) {
  if (typeof s !== 'string') return;
  try {
    s.replace(/./g, '\0');
  } catch {
    /* no-op */
  }
}
