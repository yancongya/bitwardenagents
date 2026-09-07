# Bitwardenagents agent rules

## Production source of truth

- The production service is the existing NAS container `bwvault` on
  `tycon@192.168.31.110`.
- Its persistent bind mount is
  `/vol1/1000/services/data/bwvault:/data` and `BWVAULT_HOME=/data/session`.
- Web and CLI must share `/data/session`. Never diagnose production by starting
  `docker run -v bwvault-data:/data`; that named volume is a separate vault.
- From this repository, use `./bitwardenagents <group> <command>` for NAS CLI
  operations. Start with `./bitwardenagents auth status --json`.

## Authentication lifecycle

- A container restart intentionally locks encrypted bootstrap credentials.
- Ask the user to unlock once through the HTTPS Web UI PIN page. Do not request
  the Bitwarden account password or API Key when the persisted session exists.
- `authenticated: true` plus `/data/session/session.json` mode `600` is evidence
  of a stored session. A failed operation must report its actual error before
  recommending re-login.

## Secret handling

- Store infrastructure credentials as Bitwarden Login items through stable
  aliases: `printf '%s' "$SECRET" | ./bitwardenagents credential set ... --apply`.
- Never put a secret in argv, source files, Skill files, Git URLs, logs, or
  command output. Never print encrypted cipher request payloads either.
- `credential list` may show aliases and metadata but never secret values.
- Do not use `--reveal` unless the user explicitly authorizes disclosure for a
  specific operation.

Known alias registry (names only):

| Alias | Purpose | Scope |
|---|---|---|
| `cloudflare.itycon.dns` | Cloudflare API Token | DNS management for `itycon.cn` |

Add future NAS, SSH, n8n, database, API and deployment credentials to this
registry by alias only. The value belongs in Bitwardenagents, not documentation.

## Changes and deployment

- Preserve unrelated dirty work and inspect recent commits before editing.
- Run syntax checks, `node agent-harness/tests/run.js`, `npm run build`, and
  `git diff --check` in proportion to the change.
- Use `./build-and-deploy.sh` for NAS replacement; verify health and actual
  mounts afterward. Permission to edit or deploy does not imply permission to
  commit or push.
