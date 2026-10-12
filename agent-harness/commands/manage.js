/**
 * `bwvault manage` — mutating operations.
 *
 * SAFETY RULES (non-negotiable)
 *   1. Destructive commands DEFAULT to dry-run; nothing is written without
 *      an explicit --apply. `trash purge` additionally requires --yes.
 *   2. Deletions are SOFT deletes (Bitwarden trash, recoverable ~30 days).
 *      Only `trash purge` destroys data permanently.
 *   3. Secrets are never echoed, even during mutations.
 *
 * NOTE ON FOLDER NAMES
 *   Bitwarden is zero-knowledge: folder names must be encrypted client-side
 *   before being sent. We encrypt with the session's symmetric key via the
 *   audited `encryptString` from src/crypto.js.
 */

import * as session from '../core/session.js';
import { syncVault } from '../core/vault.js';
import { digestSecret } from '../core/security.js';
import { createClient, encryptString } from '../core/bridge.js';
import * as out from '../core/display.js';

function requireSession() {
  const s = session.loadSession();
  if (!s) throw new Error('Not authenticated. Run: bwvault auth login --api-key --email you@example.com');
  return s;
}

/** Build {ciphers, client, symmetricKey} for a mutation run. */
async function prepare(opts, { forceRemote = false } = {}) {
  const s = requireSession();
  const { ciphers, folders } = await syncVault(s, (d, t) => {
    if (!opts.json) out.progress(d, t, 'decrypting');
  }, { forceRemote });
  const client = createClient(s.serverUrl);
  client.accessToken = s.accessToken;
  return { ciphers, folders, client, symmetricKey: s.symmetricKey, session: s };
}

/** Encrypt a folder name for the zero-knowledge API. */
async function encFolderName(name, key) {
  return encryptString(name, key);
}

/**
 * Merge duplicate login entries (soft-delete duplicates, keep the best one).
 * Grouping uses URI + username + password DIGEST, so plaintext is never
 * stored in the plan or transmitted anywhere.
 */
export async function dedup(opts) {
  const { ciphers, client } = await prepare(opts, { forceRemote: !!opts.apply });
  const logins = ciphers.filter((c) => !c.deletedDate && c.typeName === 'login');

  const groups = new Map();
  for (const c of logins) {
    const pw = c.login?.password || '';
    const d = pw ? await digestSecret(pw) : '';
    const key = `${(c.login?.uris || []).join('|')}::${c.login?.username || ''}::${d}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  const dupGroups = [...groups.values()].filter((g) => g.length > 1);

  // Survivor heuristic: favourited > longest notes > oldest.
  const plan = dupGroups.map((g) => {
    const survivor = [...g].sort((a, b) => {
      if (!!b.favorite !== !!a.favorite) return (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
      const na = (a.notes || '').length;
      const nb = (b.notes || '').length;
      if (nb !== na) return nb - na;
      return new Date(a.creationDate || 0) - new Date(b.creationDate || 0);
    })[0];
    const remove = g.filter((c) => c.id !== survivor.id);
    return {
      keep: { id: survivor.id, name: survivor.name },
      remove: remove.map((c) => ({ id: c.id, name: c.name })),
    };
  });

  const toDelete = plan.flatMap((p) => p.remove);

  if (!opts.apply) {
    return {
      ok: true,
      dryRun: true,
      message:
        `Dry run: ${plan.length} duplicate groups, ${toDelete.length} items would be soft-deleted. ` +
        `Re-run with --apply to execute.`,
      summary: { groups: plan.length, wouldDelete: toDelete.length },
      plan,
      kv: opts.json
        ? undefined
        : [
            ['Mode', 'dry-run (no changes made)'],
            ['Duplicate groups', String(plan.length)],
            ['Items to soft-delete', String(toDelete.length)],
          ],
    };
  }

  // Execute in ONE bulk soft-delete call.
  const results = [];
  const ids = toDelete.map((v) => v.id);
  try {
    await client.softDeleteBulk(ids);
    for (const v of toDelete) results.push({ id: v.id, name: v.name, status: 'deleted' });
  } catch (e) {
    // Fall back to per-item so one bad id does not block the rest.
    for (const v of toDelete) {
      try {
        await client.softDeleteBulk([v.id]);
        results.push({ id: v.id, name: v.name, status: 'deleted' });
      } catch (e2) {
        results.push({ id: v.id, name: v.name, status: 'failed', error: e2.message });
      }
    }
  }

  const failed = results.filter((r) => r.status === 'failed');
  return {
    ok: failed.length === 0,
    dryRun: false,
    message:
      `Soft-deleted ${results.length - failed.length} duplicate items` +
      `${failed.length ? ` (${failed.length} failed)` : ''}. Recoverable from trash.`,
    summary: { groups: plan.length, deleted: results.length - failed.length, failed: failed.length },
    results,
  };
}

/** Move exact item IDs to a folder or No Folder. Sync is always remote-first. */
export async function move(opts, { prepareFn = prepare } = {}) {
  if (!Array.isArray(opts.ids) || opts.ids.length === 0 || opts.ids.some((id) => !id)) {
    throw new Error('At least one --id is required');
  }
  if (!opts.folderId) throw new Error('--folder-id is required (use "none" for No Folder)');

  const ids = opts.ids;
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate --id values are not allowed');
  const { ciphers, folders, client } = await prepareFn(opts, { forceRemote: true });
  const targetId = opts.folderId.toLowerCase() === 'none' ? null : opts.folderId;
  if (targetId && !folders.some((folder) => folder.id === targetId)) {
    throw new Error('Target folder was not found in the remotely synced vault');
  }

  const byId = new Map(ciphers.filter((cipher) => !cipher.deletedDate).map((cipher) => [cipher.id, cipher]));
  const results = [];
  const failures = {
    notInRemoteSync: 0,
    unauthorized: 0,
    forbidden: 0,
    notFound: 0,
    conflict: 0,
    rateLimited: 0,
    serverError: 0,
    network: 0,
    requestError: 0,
  };
  for (const id of ids) {
    const cipher = byId.get(id);
    if (!cipher) {
      results.push({ status: 'failed', reason: 'notInRemoteSync' });
      failures.notInRemoteSync += 1;
      continue;
    }
    try {
      // Use the server's dedicated move endpoint. It changes only FolderId and
      // leaves the encrypted cipher payload and per-item Key untouched.
      if (opts.apply) await client.bulkMoveCiphersToFolder([id], targetId);
      results.push({ status: opts.apply ? 'moved' : 'planned' });
    } catch (error) {
      // Keep only a coarse category. Error text can contain identifiers or payload details.
      const reason = classifyMoveFailure(error);
      results.push({ status: 'failed', reason });
      failures[reason] += 1;
    }
  }

  const moved = results.filter((result) => result.status === 'moved').length;
  const planned = results.filter((result) => result.status === 'planned').length;
  const failed = results.filter((result) => result.status === 'failed').length;
  return {
    ok: failed === 0,
    dryRun: !opts.apply,
    summary: { requested: ids.length, moved, wouldMove: planned, failed, failures },
    message: opts.apply
      ? `Moved ${moved} item(s); ${failed} failed.`
      : `Dry run: ${planned} item(s) would move; ${failed} failed. Add --apply to execute.`,
  };
}

/** Return a non-sensitive failure bucket for the CLI summary. */
function classifyMoveFailure(error) {
  const status = Number(
    (typeof error?.message === 'string' && error.message.match(/^Bulk move failed: (\d{3})$/)?.[1])
      ?? error?.statusCode
      ?? error?.status
      ?? error?.response?.status,
  );
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notFound';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rateLimited';
  if (status >= 500 && status <= 599) return 'serverError';

  const code = error?.code ?? error?.cause?.code;
  if (['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)
      || error?.name === 'AbortError') return 'network';
  return 'requestError';
}

/**
 * Trash operations: list | restore | purge
 * `purge` is irreversible: requires --apply AND --yes.
 */
export async function trash(opts) {
  const { ciphers, client } = await prepare(opts, { forceRemote: !!opts.apply });
  const trashed = ciphers.filter((c) => c.deletedDate);
  const action = opts.action || 'list';

  if (action === 'list') {
    return {
      ok: true,
      count: trashed.length,
      // Names/metadata only — never secrets.
      items: trashed.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.typeName,
        deletedDate: c.deletedDate,
      })),
      headers: ['NAME', 'TYPE', 'DELETED'],
      rows: trashed.map((c) => [
        c.name || '(unnamed)',
        c.typeName,
        String(c.deletedDate).slice(0, 10),
      ]),
    };
  }

  if (action === 'restore') {
    if (!opts.id) throw new Error('--id is required to restore');
    if (!opts.apply) {
      return { ok: true, dryRun: true, message: `Dry run: would restore ${opts.id}. Add --apply.` };
    }
    await client.restoreBulk([opts.id]);
    return { ok: true, message: `Restored ${opts.id}` };
  }

  if (action === 'purge') {
    if (!opts.id) throw new Error('--id is required to purge');
    if (!opts.apply || !opts.yes) {
      return {
        ok: false,
        message:
          'Refusing to purge: this is PERMANENT and irreversible. ' +
          'Add both --apply and --yes to confirm.',
        requiresConfirmation: true,
      };
    }
    await client.permanentDeleteBulk([opts.id]);
    return { ok: true, message: `Permanently deleted ${opts.id}` };
  }

  throw new Error(`Unknown trash action: ${action}. Use list | restore | purge`);
}

/** Folder operations: (list) | create | rename | delete */
export async function folders(opts) {
  const s = requireSession();
  const action = opts.action;

  // Listing only needs a sync, no mutation client.
  if (!action) {
    const { folders } = await syncVault(s, (d, t) => {
      if (!opts.json) out.progress(d, t, 'decrypting');
    }, { forceRemote: !!opts.apply });
    return {
      ok: true,
      count: folders.length,
      folders,
      headers: ['ID', 'NAME'],
      rows: folders.map((f) => [f.id, f.name]),
    };
  }

  const { client, symmetricKey } = await prepare(opts, { forceRemote: !!opts.apply });

  if (action === 'create') {
    if (!opts.name) throw new Error('--name is required to create a folder');
    if (!opts.apply) {
      return { ok: true, dryRun: true, message: `Dry run: would create folder "${opts.name}". Add --apply.` };
    }
    const enc = await encFolderName(opts.name, symmetricKey);
    const res = await client.createFolder(enc);
    return { ok: true, message: `Created folder "${opts.name}"`, id: res?.Id || res?.id || null };
  }

  if (action === 'rename') {
    if (!opts.id || !opts.name) throw new Error('--id and --name are required to rename');
    if (!opts.apply) {
      return { ok: true, dryRun: true, message: `Dry run: would rename ${opts.id} to "${opts.name}". Add --apply.` };
    }
    const enc = await encFolderName(opts.name, symmetricKey);
    await client.updateFolder(opts.id, enc);
    return { ok: true, message: `Renamed folder ${opts.id} to "${opts.name}"` };
  }

  if (action === 'delete') {
    if (!opts.id) throw new Error('--id is required to delete a folder');
    if (!opts.apply) {
      return { ok: true, dryRun: true, message: `Dry run: would delete folder ${opts.id}. Add --apply.` };
    }
    await client.deleteFolder(opts.id);
    return {
      ok: true,
      message: `Deleted folder ${opts.id} (entries are preserved, moved to No Folder)`,
    };
  }

  throw new Error(`Unknown folders action: ${action}. Use create | rename | delete`);
}
