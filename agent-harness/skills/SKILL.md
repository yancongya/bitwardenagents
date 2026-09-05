---
name: cli-anything-bwvault
version: "1.0.0"
description: Headless CLI for Bitwarden Vault Manager — inspect, analyse and clean a Bitwarden vault without exposing plaintext
category: security
tags:
  - bitwarden
  - password-manager
  - vault
  - cli
  - zero-knowledge
trigger:
  - bitwarden
  - vault manager
  - password list
  - duplicate passwords
  - password health
  - bwvault
---

# cli-anything-bwvault

CLI harness for the Bitwarden Vault Manager web app. Allows an AI agent to
authenticate with a Bitwarden vault, inspect entries, analyse password health,
detect duplicates and perform safe cleanup — entirely from the terminal without
exposing any plaintext secrets.

## Safety Rules

1. **Never print secrets** unless `--reveal` is explicitly passed.
2. **All mutations default to dry-run**; pass `--apply` to commit.
3. **Deletions are soft** (recoverable ~30 days); `purge` requires `--yes`.
4. **Passwords are never arguments**; provide via stdin / env / prompt.

## Command Reference

```bash
# Session
bwvault auth login --api-key --client-id <id> --client-secret <s> --email <e>
bwvault auth login --password --email <e>
bwvault auth logout
bwvault auth status

# Inspection
bwvault vault sync
bwvault vault list [--type login] [--folder X] [--search Q] [--reveal]
bwvault vault search <query>
bwvault vault get --id <ID> [--reveal]
bwvault vault folders
bwvault vault export --output backup.enc

# Analysis (read-only)
bwvault analyze health
bwvault analyze duplicates
bwvault analyze urls

# Mutations (dry-run by default)
bwvault manage dedup [--apply]
bwvault manage trash list
bwvault manage trash restore --id <ID> --apply
bwvault manage trash purge --id <ID> --apply --yes
bwvault manage folders create --name <NAME> --apply
bwvault manage folders rename --id <ID> --name <NAME> --apply
bwvault manage folders delete --id <ID> --apply

# Flags
--json     # machine-readable JSON output
--reveal   # show secrets (password, TOTP, keys)
--server   # us | eu | <custom-url>
```

## Key Behaviours for Agents

- `vault list --json` returns `{ items: [...], count }` — each item has `name`,
  `type`, `username`, `uris`, `password` (redacted by default).
- `analyze health --json` returns `{ score: 0-100, summary, details }` with
  counts of empty/weak/reused/stale passwords. Passwords are compared via
  SHA-256 digests, never plaintext.
- `manage dedup --dry-run` (default) returns the plan without mutating anything.
  Pass `--apply` to execute soft-deletes.
- Every mutating command returns `{ ok, message, ... }` so the agent can branch
  on success/failure without parsing stderr.

## Installation

```bash
cd agent-harness && npm install && npm link
# or simply:
node bin/bwvault.js <command>
```

## Architecture

The CLI reuses the **audited browser crypto engine** (`src/crypto.js`) directly
from Node.js — no reimplemented cryptography. Node 22's built-in Web Crypto API
(`crypto.subtle`) makes this transparent. Argon2id accounts use `@node-rs/argon2`
(prebuilt Rust binary) instead of `argon2-browser` (browser WASM).
