# BWVAULT — Agent Harness SOP

## Software
**Bitwardenagents** — `yancongya/bitwardenagents`

## Source
- `src/` — browser crypto engine (PBKDF2/Argon2, AES-CBC, dedup, health)
- `agent-harness/` — Node.js CLI reusing `src/` via `core/bridge.js`

## Key Design Decisions
1. **Node.js CLI (not Python)**: the crypto engine is JavaScript; reusing it
   avoids reimplementing audited cryptographic algorithms.
2. **Absolute URLs**: the web app uses Vite proxy (`/bw-api`). The CLI talks to
   Bitwarden directly via `https://vault.bitwarden.com/api`.
3. **Native Argon2**: `argon2-browser` WASM cannot resolve its `.wasm` file under
   Node. `@node-rs/argon2` (prebuilt Rust) provides the same algorithm.
4. **Plaintext discipline**: passwords/TOTP/keys are redacted by default; agents
   must pass `--reveal` to see them.

## Module Map
| File | Role |
|------|------|
| `core/bridge.js` | Re-exports `src/crypto.js` + `src/bitwarden-api.js` with Node-native Argon2 |
| `core/session.js` | Persistent session at `$BWVAULT_HOME/session.json`; local fallback is `~/.bwvault/session.json` |
| `core/security.js` | Redaction, digest, strength — no plaintext in output |
| `core/vault.js` | Sync + decrypt ciphers/folders |
| `core/display.js` | Table / KV / JSON rendering |
| `commands/auth.js` | login (API Key + password) · logout · status |
| `commands/vault.js` | sync · list · search · get · folders · export |
| `commands/analyze.js` | health · duplicates · urls |
| `commands/manage.js` | dedup · trash · folders (all dry-run by default) |
| `utils/repl.js` | Interactive REPL (default when no args) |
| `utils/secrets.js` | Safe password intake (TTY / stdin / env) |
