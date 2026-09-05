/**
 * `bwvault analyze` — read-only reporting. Never mutates the vault.
 *
 * PLAINTEXT DISCIPLINE
 *   Reports are built from metadata (lengths, hashes, timestamps, URLs) rather
 *   than from secret contents. Password reuse is detected via SHA-256 digests,
 *   so two identical passwords produce the same digest without any plaintext
 *   ever being written to the report or to disk.
 */

import * as session from '../core/session.js';
import { syncVault } from '../core/vault.js';
import { digestSecret, strengthBucket } from '../core/security.js';
import * as out from '../core/display.js';

async function load(opts) {
  const s = session.loadSession();
  if (!s) throw new Error('Not authenticated. Run: bwvault auth login --api-key --email you@example.com');
  const { ciphers } = await syncVault(s, (d, t) => {
    if (!opts.json) out.progress(d, t, 'decrypting');
  });
  // Reports consider active (non-trashed) login items by default.
  return ciphers.filter((c) => !c.deletedDate);
}

/** Weak / empty / reused / stale passwords + insecure URIs. */
export async function health(opts) {
  const items = await load(opts);
  const logins = items.filter((c) => c.typeName === 'login');

  const empty = [];
  const weak = [];
  const stale = [];
  const insecureUri = [];

  // digest -> [ids], used for reuse detection without keeping plaintext.
  const byDigest = new Map();
  const ONE_YEAR = 365 * 24 * 3600 * 1000;

  for (const c of logins) {
    const pw = c.login?.password;
    const id = c.id;
    const label = c.name || '(unnamed)';

    if (!pw || pw.length === 0) {
      empty.push({ id, name: label });
      continue;
    }
    if (pw.length < 12) {
      weak.push({ id, name: label, length: pw.length, strength: strengthBucket(pw.length) });
    }
    if (c.login?.passwordRevisionDate) {
      const age = Date.now() - new Date(c.login.passwordRevisionDate).getTime();
      if (age > ONE_YEAR) {
        stale.push({ id, name: label, daysSinceRotation: Math.round(age / 86400000) });
      }
    }
    for (const u of c.login?.uris || []) {
      if (String(u).startsWith('http://')) {
        insecureUri.push({ id, name: label, uri: u });
      }
    }

    const d = await digestSecret(pw);
    if (!byDigest.has(d)) byDigest.set(d, []);
    byDigest.get(d).push({ id, name: label });
  }

  const reused = [...byDigest.values()].filter((g) => g.length > 1);

  // Score: start at 100, subtract weighted issues.
  const total = logins.length || 1;
  const score = Math.max(
    0,
    Math.round(
      100 -
        (empty.length / total) * 40 -
        (weak.length / total) * 30 -
        (reused.length / total) * 20 -
        (insecureUri.length / total) * 10
    )
  );

  return {
    ok: true,
    score,
    summary: {
      totalLogins: logins.length,
      empty: empty.length,
      weak: weak.length,
      reused: reused.length,
      stale: stale.length,
      insecureUri: insecureUri.length,
    },
    // Names only — never secrets.
    details: { empty, weak, reused, stale, insecureUri },
    kv: opts.json
      ? undefined
      : [
          ['Health score', `${score}/100`],
          ['Login items', String(logins.length)],
          ['Empty passwords', String(empty.length)],
          ['Weak (<12 chars)', String(weak.length)],
          ['Reused passwords', String(reused.length)],
          ['Stale (>1 year)', String(stale.length)],
          ['Insecure http:// URIs', String(insecureUri.length)],
        ],
  };
}

/** Duplicate detection: exact matches and same-site clusters. */
export async function duplicates(opts) {
  const items = await load(opts);
  const logins = items.filter((c) => c.typeName === 'login');

  // Key on URI + username + password digest. Using the digest keeps this a
  // metadata comparison while still catching true duplicates.
  const exact = new Map();
  const bySite = new Map();

  for (const c of logins) {
    const pw = c.login?.password || '';
    const d = pw ? await digestSecret(pw) : '';
    const uriKey = (c.login?.uris || []).join('|');
    const exactKey = `${uriKey}::${c.login?.username || ''}::${d}`;

    if (!exact.has(exactKey)) exact.set(exactKey, []);
    exact.get(exactKey).push({ id: c.id, name: c.name, username: c.login?.username });

    // Same-site: normalise host, group regardless of credentials.
    for (const u of c.login?.uris || []) {
      let host = null;
      try {
        host = new URL(String(u).startsWith('http') ? u : `https://${u}`).host.replace(/^www\./, '');
      } catch {
        host = null;
      }
      if (!host) continue;
      if (!bySite.has(host)) bySite.set(host, []);
      bySite.get(host).push({ id: c.id, name: c.name, username: c.login?.username });
    }
  }

  const exactGroups = [...exact.values()].filter((g) => g.length > 1);
  const siteGroups = [...bySite.entries()]
    .map(([host, g]) => ({ host, items: g }))
    .filter((g) => g.items.length > 1);

  return {
    ok: true,
    summary: {
      exactGroups: exactGroups.length,
      exactItems: exactGroups.reduce((n, g) => n + g.length, 0),
      sameSiteGroups: siteGroups.length,
    },
    exact: exactGroups,
    sameSite: siteGroups,
    kv: opts.json
      ? undefined
      : [
          ['Exact duplicate groups', String(exactGroups.length)],
          ['Items in exact groups', String(exactGroups.reduce((n, g) => n + g.length, 0))],
          ['Same-site groups', String(siteGroups.length)],
        ],
  };
}

/**
 * Dead-link candidates.
 *
 * NOTE: This contacts each URL to see whether it still resolves. Non-login
 * items and well-known hosts are skipped to avoid noisy/aggressive crawling.
 * Only the URL is transmitted — no credentials are ever sent.
 */
export async function urls(opts) {
  const items = await load(opts);
  const candidates = [];

  for (const c of items) {
    for (const u of c.login?.uris || []) {
      let url = String(u);
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      try {
        // Guard against non-http schemes like androidapp://
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) continue;
        candidates.push({ id: c.id, name: c.name, uri: url, host: parsed.host });
      } catch {
        /* skip malformed */
      }
    }
  }

  const dead = [];
  let checked = 0;
  for (const cand of candidates) {
    checked++;
    if (!opts.json) out.progress(checked, candidates.length, 'checking URLs');
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(cand.uri, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(t);
      if (!res || res.status >= 400) {
        dead.push({ ...cand, status: res ? res.status : 'unreachable' });
      }
    } catch {
      dead.push({ ...cand, status: 'error' });
    }
  }

  return {
    ok: true,
    summary: { checked: candidates.length, dead: dead.length },
    dead,
    kv: opts.json
      ? undefined
      : [
          ['URLs checked', String(candidates.length)],
          ['Unreachable', String(dead.length)],
        ],
  };
}
