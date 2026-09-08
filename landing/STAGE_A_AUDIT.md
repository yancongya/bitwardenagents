# Bitwardenagents Landing Stage A Audit

Audit window: 2026-09-07 to 2026-09-08

This document records repository evidence before any landing-page direction or implementation is selected. It does not define the final layout, copy, deployment workflow, or Cloudflare configuration.

## Design read

Reading this as a product landing page for technical Bitwarden users and automation agents, with a calm, trust-first CLI language, leaning toward native HTML and CSS that reuses the product's existing token system.

Initial dial reading:

- `DESIGN_VARIANCE: 7`: enough asymmetry to avoid a dashboard-shaped marketing page.
- `MOTION_INTENSITY: 5`: restrained CSS motion with a clear product purpose.
- `VISUAL_DENSITY: 5`: technical evidence must remain scannable without becoming a specification table.

These values are inputs for Stage B, not an approved design direction.

## Product evidence dossier

**One-sentence product definition at outcome level:** Bitwardenagents lets a person or agent inspect and organize a Bitwarden vault while keeping normal outputs free of plaintext secrets.

**Audience and primary CTA:** Technical Bitwarden users, self-hosters, and agent operators. The likely primary CTA is opening the real product; final CTA wording belongs to Stage B.

**Core promise:** Let an agent do useful vault maintenance without giving it routine access to plaintext credentials or irreversible actions by default.

| Capability | Repository evidence | User outcome | Emotional payoff | Confidence |
|---|---|---|---|---|
| Browser-side vault management | `src/app.js`, `src/crypto.js`, `src/bitwarden-api.js` | Inspect and organize a Bitwarden vault without sending plaintext to the application server | Keep control of the vault | High for implementation, live real-account proof is separate |
| Agent CLI | `agent-harness/bin/bwvault.js`, five command groups confirmed by `--help`, root `./bitwardenagents` NAS proxy | Agents can inspect, analyze, and perform scoped maintenance without using the Web UI | Automation no longer requires handing over an unrestricted shell workflow | High |
| Secret-safe defaults | `agent-harness/core/security.js`, `agent-harness/utils/secrets.js`, 23 passing harness tests | Passwords stay redacted unless disclosure is explicitly requested | Routine agent logs are less alarming | High for tested helpers |
| Dry-run and soft-delete workflow | `agent-harness/commands/manage.js`, `agent-harness/skills/SKILL.md`, README safety table | Agents can preview changes and recover normal deletions | You can delegate without treating every command as irreversible | High for documented command contract; live mutation proof not collected in Stage A |
| Credential aliases | `agent-harness/commands/credential.js` and stable item names such as `Agent Credential: nas.ssh` | Infrastructure secrets can be addressed by stable names without appearing in argv or normal output | Stop repeatedly searching for and pasting credentials | High for local tests; live vault retrieval is environment-dependent |
| Smart duplicate handling | `src/dedup-engine.js`, 765 lines, Path A and Path B logic described in README | Consolidates exact and same-site duplicates while preserving differing data | A crowded vault becomes manageable without blind deletion | High for code presence; no dedicated automated dedup test suite found |
| Vault health analysis | `src/health-engine.js`, README risk table | Surfaces weak, empty, reused, stale, insecure, missing, and damaged entries | Know what deserves attention first | High for implementation; scoring claims should be copied from code, not paraphrased from memory |
| URL checks | `src/app.js`, `src/data/domain-whitelist.js` | Finds likely dead account URLs while reducing known false positives | Spend less time opening abandoned sites manually | Medium because browser and bot-protection behavior is inherently probabilistic |
| Demo mode | `src/demo-data.js` and `enterDemoMode()` in `src/app.js` | Visitors can inspect the real product UI without an account | Evaluate the workflow before trusting it with a vault | High for button-triggered local demo |
| Web and CLI session sharing on NAS | `src/core/session-storage.js`, server session API, `AGENTS.md`, root CLI proxy | A single PIN unlock can restore the persisted Docker session for Web and CLI | Container updates stop feeling like repeated account setup | High for current architecture; production runtime should be reverified after deployment changes |

## Existing voice and positioning

The strongest current sentence is the README positioning: a zero-knowledge Bitwarden management dashboard plus an AI Agent CLI. The most differentiated proof is not generic password management. It is the combination of:

1. Local decryption.
2. Redacted agent output.
3. Mutations that default to dry-run.
4. Recoverable deletion.
5. One shared encryption implementation across Web and CLI.

The current writing is technically detailed and direct. It should be shortened for a landing page without replacing concrete mechanisms with generic claims such as "seamless", "next generation", or "AI powered".

Tone signals:

- Product name is descriptive and mixed-case rather than playful.
- Recent commits consistently use conventional `feat`, `fix`, `refactor`, and `chore` prefixes.
- README voice is tutorial-like, bilingual, and explicit about safety exceptions.
- The product is both a Web utility and a CLI, so technical vocabulary is appropriate when it proves a boundary.
- Voice spectrum: `2/5`, restrained and professional with small moments of confidence.

## Brand and design tokens

Canonical tokens exist at `src/design/tokens.css`.

- Dark surfaces: Zinc-like `#09090b`, `#18181b`, and `#1e1e22`.
- Light surfaces: `#fafafa`, `#f4f4f5`, and white cards.
- Brand accent: `#3b82f6`; supporting light blue: `#60a5fa` or `#2563eb` in light mode.
- Typography: Geist first, then system fonts and Inter fallback.
- Shape language: 4px, 6px, and 8px radii.
- Material language: border-first, subtle shadows, no glow, no purple gradient.
- Theme behavior: system preference on first visit, persisted manual choice afterward.
- Brand mark: `public/brand-logo.svg`, a terminal prompt connected to agent nodes, with reduced-motion support.

Preserve the neutral palette, single blue accent, compact radii, restrained shadows, and dual-mode behavior. The landing page should not introduce a second visual system.

## Information architecture baseline

The current repository has one product application route. There is no independent landing directory in the baseline commit and no GitHub Pages branch.

Current conversion paths:

- Online product and demo: `https://bitwardenagents.itycon.cn/`
- Source: `https://github.com/yancongya/bitwardenagents`
- Human documentation: `README.md`
- Machine-oriented overview: `/llms.txt`
- Agent integration source: `agent-harness/skills/SKILL.md` in GitHub

The real product login page already exposes a demo button. There is no query-string or dedicated-route entry into demo mode. An independent landing page therefore cannot safely promise a direct demo deep link yet.

## Real visual evidence

- The repository contains one tracked PNG, `src/assets/hero.png`.
- That PNG is an abstract layered graphic, not a product screenshot.
- README explicitly states that real screenshots are not yet available.
- No `docs/assets/` screenshot set exists.
- The generated demo uses the actual product rendering path and is currently the strongest visual proof surface.

Stage B should use either a captured real demo-state screenshot or a deliberate live-product handoff. It must not construct a fake terminal or fake dashboard from decorative HTML.

## Demo constraints

`enterDemoMode()` is a module-local function attached to the login page button. It generates data, installs a no-op client, computes duplicate and health results, then enters the real dashboard.

Consequences:

- A separate GitHub Pages document cannot import the function as a stable public API.
- Linking to the product root gives visitors a working demo button but adds one click.
- A future direct CTA requires an explicit product contract such as `?demo=1`, implemented and tested in the main app during a later stage.
- Demo values are generated partly with random data. Exact marketing counts must not be promised unless the dataset becomes deterministic.

## SEO and discovery baseline

The application root already has title, description, canonical, Open Graph, Twitter, JSON-LD, `robots.txt`, and `llms.txt`.

Current gaps:

- Metadata still uses the older "Bitwarden Vault Manager" name in several places.
- No Open Graph image is declared.
- The live `/agent-harness/skills/SKILL.md` URL returns the SPA HTML fallback with status 200, not the skill file.
- An arbitrary missing path also returns the same status 200 HTML fallback, so status code alone cannot prove a public machine-readable resource exists.
- `llms.txt` says browser sessions use sessionStorage only, while current code also persists to localStorage and can share a server-side Docker session.
- `llms.txt` describes 375+ translations; the current dictionary contains about 512 entries.
- No analytics or tracking is present, matching the current privacy claim.

The landing build will need its own canonical URL, social metadata, structured data, and real public agent-document route. Existing application metadata must not be copied blindly.

## Build and publication baseline

- Application build: Vite.
- Existing deployment command: build the product and deploy `dist` to the `bitwardenagents` Cloudflare Pages project.
- Build copies `functions/` into `dist/functions` for the product API proxy.
- No `.github/workflows/` directory exists.
- No `gh-pages` branch exists locally or in the fetched remote refs.
- No independent landing build script exists.
- No evidence of a configured `bitwardenagents-landing` Cloudflare Pages project was collected in Stage A.

The proposed permanent dual publication is therefore new infrastructure, not an extension of an existing verified pipeline.

## Claims that need careful wording

- "Zero knowledge" is supported by the intended architecture, but deployment logging and proxy behavior must be described precisely rather than absolutely.
- URL dead-link detection is a heuristic, not a guarantee that an account site is dead.
- Soft-delete recovery is normally about 30 days and should not be presented as an unconditional service guarantee.
- The CLI security tests cover redaction, digests, strength buckets, session status shape, and alias normalization. They do not prove every network mutation path.
- A stored session and correct file permissions do not prove that the remote Bitwarden token is still valid.
- Demo statistics are synthetic and may vary between visits.

## Patterns to preserve

- One obvious primary action.
- Explicit security boundaries in plain language.
- Real errors and honest limitations.
- Product-native light and dark themes.
- The terminal-and-agent logo language.
- The real demo dashboard as evidence.
- Links to source, human docs, and agent docs.

## Patterns to avoid

- A centered hero over blue or purple glow.
- Three equal feature cards.
- A fake terminal window or fake vault dashboard.
- Decorative status dots, section numbering, and version stamps.
- A health progress bar used as marketing decoration.
- Claims based on random demo counts.
- Long security specification tables above the fold.
- Heavy animation libraries for a static site.

## Stage A exit status

Stage A is complete at the repository level.

Verified:

- The product, CLI, safety contract, token system, demo implementation, SEO baseline, assets, and current deployment structure were inspected.
- `node agent-harness/tests/run.js` passed all 23 tests.
- `npm run build` passed before the baseline commit.
- Live product root, GitHub repository, and `/llms.txt` returned HTTP 200 during the audit.
- The proposed public skill URL currently returns HTML fallback and is not a valid machine-readable skill endpoint.

Not performed:

- No landing layout or copy was implemented.
- No Stage B direction was selected.
- No GitHub Actions or Pages configuration was created.
- No Cloudflare project or DNS record was changed.
- No commit was created after this audit document.
