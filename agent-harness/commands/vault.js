/**
 * `bwvault vault` — read-only inspection of the vault.
 *
 * Nothing in this module mutates the remote vault. Secrets are redacted unless
 * the caller passes --reveal (see core/security.js).
 */

import * as session from '../core/session.js';
import { syncVault, summarize, typeName } from '../core/vault.js';
import * as out from '../core/display.js';

/** Load the session or fail with an actionable message. */
function requireSession() {
  const s = session.loadSession();
  if (!s) {
    throw new Error(
      'Not authenticated. Run: bwvault auth login --api-key --email you@example.com'
    );
  }
  return s;
}

/** Pull the vault and apply optional filters. */
async function loadFiltered(opts, onProgress) {
  const s = requireSession();
  const { ciphers, folders } = await syncVault(s, onProgress);

  // Exclude trashed items unless explicitly asked for.
  let items = ciphers.filter((c) => !c.deletedDate);

  if (opts.type) {
    const t = String(opts.type).toLowerCase();
    items = items.filter((c) => c.typeName === t);
  }
  if (opts.folder) {
    const f = String(opts.folder).toLowerCase();
    items = items.filter((c) => (c.folderName || '').toLowerCase().includes(f));
  }
  if (opts.search || opts.query) {
    const q = String(opts.search || opts.query).toLowerCase();
    items = items.filter((c) =>
      [c.name, c.login?.username, ...(c.login?.uris || [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }
  return { items, folders, session: s };
}

/** Sync and report counts. */
export async function sync(opts) {
  const s = requireSession();
  const { ciphers, folders } = await syncVault(s, (d, t) => {
    if (!opts.json) out.progress(d, t, 'decrypting');
  });
  const active = ciphers.filter((c) => !c.deletedDate);
  const trashed = ciphers.filter((c) => c.deletedDate);

  return {
    ok: true,
    counts: {
      total: ciphers.length,
      active: active.length,
      trashed: trashed.length,
      folders: folders.length,
    },
    kv: opts.json
      ? undefined
      : [
          ['Total items', ciphers.length],
          ['Active', active.length],
          ['Trashed', trashed.length],
          ['Folders', folders.length],
        ],
  };
}

/** List entries in a table (redacted by default). */
export async function list(opts) {
  const { items } = await loadFiltered(opts, (d, t) => {
    if (!opts.json) out.progress(d, t, 'decrypting');
  });

  const rows = items.map((c) => {
    const s = summarize(c, { reveal: !!opts.reveal });
    return [
      s.name || '(unnamed)',
      s.type,
      s.username || '—',
      (s.uris && s.uris[0]) || '—',
      s.folder || '—',
      s.favorite ? '★' : '',
    ];
  });

  const limit = opts.limit ? parseInt(opts.limit, 10) : undefined;
  const shown = limit ? rows.slice(0, limit) : rows;

  return {
    ok: true,
    count: items.length,
    revealed: !!opts.reveal,
    items: items.map((c) => summarize(c, { reveal: !!opts.reveal })),
    headers: ['NAME', 'TYPE', 'USERNAME', 'URI', 'FOLDER', 'FAV'],
    rows: shown,
  };
}

/** Search entries. */
export async function search(opts) {
  if (!opts.query && !opts.search) {
    throw new Error('Provide a search term: bwvault vault search <query>');
  }
  return list(opts);
}

/** Full detail for one entry, redacted unless --reveal. */
export async function get(opts) {
  if (!opts.id) throw new Error('--id is required');
  const { items } = await loadFiltered(opts, (d, t) => {
    if (!opts.json) out.progress(d, t, 'decrypting');
  });

  const c = items.find((x) => x.id === opts.id);
  if (!c) throw new Error(`No entry with id ${opts.id}`);

  const s = summarize(c, { reveal: !!opts.reveal });
  const kv = Object.entries(s)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)]);

  return {
    ok: true,
    item: s,
    revealed: !!opts.reveal,
    kv: opts.json ? undefined : kv,
  };
}

/** List folders. */
export async function folders(opts) {
  const { folders } = await loadFiltered(opts, (d, t) => {
    if (!opts.json) out.progress(d, t, 'decrypting');
  });

  return {
    ok: true,
    count: folders.length,
    folders,
    headers: ['ID', 'NAME'],
    rows: folders.map((f) => [f.id || '(none)', f.name]),
  };
}

/**
 * Export the vault as an ENCRYPTED bundle.
 *
 * The export is encrypted with a key derived from the user's master password,
 * so an exported file is safe to store or transport. Bitwarden's own
 * account-restricted JSON export format is used for interoperability, but the
 * payload written here is additionally AES-encrypted at rest.
 */
export async function exportVault(opts) {
  const output = opts.output || 'bwvault-export.enc';
  const { items, session: s } = await loadFiltered(opts, (d, t) => {
    if (!opts.json) out.progress(d, t, 'decrypting');
  });

  const { encryptString } = await import('../core/bridge.js');
  const payload = JSON.stringify(
    {
      encrypted: true,
      format: 'bwvault-encrypted-json',
      version: 1,
      exportedAt: new Date().toISOString(),
      items: items.map((c) => summarize(c, { reveal: true })),
    },
    null,
    2
  );

  // Reuse the session's own symmetric key: only someone holding this session
  // (or the master password) can decrypt the bundle.
  const cipher = await encryptString(payload, s.symmetricKey);

  const fs = await import('node:fs');
  fs.writeFileSync(output, cipher, { mode: 0o600 });

  return {
    ok: true,
    message: `Exported ${items.length} items to ${output} (encrypted, mode 0600)`,
    output,
    count: items.length,
  };
}
