/** Store service credentials in Bitwarden through stable, non-secret aliases. */

import * as session from '../core/session.js';
import { syncVault, invalidateCache } from '../core/vault.js';
import { createClient, decryptSymmetricKey, encryptString } from '../core/bridge.js';
import { getCredentialSecret, scrub } from '../utils/secrets.js';
import * as out from '../core/display.js';

const PREFIX = 'Agent Credential: ';

export function credentialItemName(alias) {
  return `${PREFIX}${alias}`;
}

export function normalizeAlias(alias) {
  const value = String(alias || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,79}$/.test(value)) {
    throw new Error('--alias must be 2-80 characters using a-z, 0-9, dot, underscore or hyphen');
  }
  return value;
}

function requireSession() {
  const value = session.loadSession();
  if (!value) throw new Error('Not authenticated. Run bwvault auth login first.');
  return value;
}

async function prepare(opts) {
  const current = requireSession();
  const { ciphers } = await syncVault(current, (done, total) => {
    if (!opts.json) out.progress(done, total, 'decrypting');
  });
  const client = createClient(current.serverUrl);
  client.accessToken = current.accessToken;
  return { current, ciphers, client };
}

export async function list(opts) {
  const { ciphers } = await prepare(opts);
  const items = ciphers
    .filter((item) => !item.deletedDate && item.typeName === 'login' && item.name?.startsWith(PREFIX))
    .map((item) => ({
      alias: item.name.slice(PREFIX.length),
      username: item.login?.username || null,
      uri: item.login?.uris?.[0] || null,
      updatedAt: item.revisionDate,
      secret: 'stored',
    }))
    .sort((a, b) => a.alias.localeCompare(b.alias));
  return {
    ok: true,
    count: items.length,
    items,
    headers: ['ALIAS', 'USERNAME', 'URI', 'SECRET'],
    rows: items.map((item) => [item.alias, item.username || '', item.uri || '', 'stored']),
  };
}

export async function set(opts) {
  const alias = normalizeAlias(opts.alias);
  if (!opts.apply) {
    return {
      ok: true,
      dryRun: true,
      alias,
      message: `Dry run: would save credential alias "${alias}". Add --apply and provide the secret via stdin, hidden prompt, or BWVAULT_SECRET.`,
    };
  }

  const secret = await getCredentialSecret({ allowPrompt: !opts.json });
  if (!secret) throw new Error('Credential secret required via stdin, hidden prompt, or BWVAULT_SECRET.');

  try {
    const { current, ciphers, client } = await prepare(opts);
    const name = credentialItemName(alias);
    const matches = ciphers.filter((item) => !item.deletedDate && item.name === name);
    if (matches.length > 1) throw new Error(`Multiple vault items use alias "${alias}"; resolve duplicates before saving.`);

    const existing = matches[0] || null;
    let key = current.symmetricKey;
    if (existing?._original?.Key) key = await decryptSymmetricKey(existing._original.Key, current.symmetricKey);

    const enc = (value) => value ? encryptString(value, key) : Promise.resolve(null);
    const uri = opts.url ? [{ Uri: await enc(opts.url), Match: null }] : [];
    const login = {
      Username: await enc(opts.username || ''),
      Password: await enc(secret),
      Totp: null,
      Uris: uri,
    };

    let result;
    if (existing) {
      const payload = structuredClone(existing._original);
      payload.Name = await enc(name);
      payload.Notes = await enc(`Managed by bwvault CLI\nalias=${alias}`);
      payload.Login = login;
      result = await client.updateCipher(existing.id, payload);
    } else {
      result = await client.createCipher({
        Type: 1,
        Name: await enc(name),
        Notes: await enc(`Managed by bwvault CLI\nalias=${alias}`),
        Favorite: false,
        Reprompt: 1,
        OrganizationId: null,
        FolderId: null,
        Fields: null,
        Login: login,
      });
    }

    invalidateCache();
    return {
      ok: true,
      alias,
      action: existing ? 'updated' : 'created',
      id: result?.Id || result?.id || existing?.id || null,
      secret: 'stored-not-returned',
      message: `${existing ? 'Updated' : 'Created'} credential alias "${alias}" without returning the secret.`,
    };
  } finally {
    scrub(secret);
  }
}
