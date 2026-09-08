# Bitwardenagents Landing Stage B Directions

Date: 2026-09-08

This is the creative-direction gate. It contains no production implementation.

## Common creative brief

### Visitor and problem

The primary visitor already uses Bitwarden and is considering letting an agent help maintain credentials or infrastructure secrets. Their concern is not whether AI can run a command. It is whether delegation will expose plaintext or make an irreversible change.

### Core promise

Let an agent do useful vault maintenance while plaintext disclosure and irreversible actions remain explicit exceptions.

### Narrative arc

1. Arrival: acknowledge the tension between useful automation and credential risk.
2. First proof: show the four concrete guardrails, not a generic security badge.
3. Product proof: connect those guardrails to real CLI and Web capabilities.
4. Trust proof: explain local decryption and the shared Web/CLI implementation boundary.
5. Experience proof: invite the visitor into the real demo UI.
6. Close: open the product or inspect the source and agent skill.

### Voice system

- Tone position: `2/5`, restrained and professional with one or two confident phrases.
- Person: address the visitor as "you". Use the product name sparingly.
- Headlines: concrete verbs and outcomes, no generic AI vocabulary.
- Technical terms: retain `dry-run`, CLI command names, paths, and cryptographic names only where they prove a boundary.
- Chinese and English are independently written, not literal mirrors.
- Avoid: seamless, empowering, revolutionary, next generation, one-stop, military-grade.

### Shared content rules

- No invented adoption counts, testimonials, performance numbers, or demo statistics.
- Dynamic proof surfaces may reconstruct the real product information architecture when their fields and states trace to source or demo data.
- Synthetic records and simulated outcomes must be labeled in the surface; never present them as a connected account, benchmark, or captured production result.
- A command surface may quote only real `bwvault --help`, source-backed behavior, or verified output. Screenshots remain preferred for pixel-level UI claims; dynamic mocks are preferred when the point is interaction or state change.
- Exactly one primary CTA intent per viewport.
- Use the existing logo, neutral surfaces, blue accent, compact radii, and light/dark tokens.

## Direction 1: Delegation with guardrails

**One-line concept:** Give the agent a job, not unrestricted access.

### Structure sketch

```text
asymmetric hero: promise + real product frame
        ↓
four guardrails as one sequential control path
        ↓
real CLI output paired with Web/CLI shared-core evidence
        ↓
actual demo-state product capture
        ↓
open product + inspect agent skill
```

### Style family

Technical editorial with compact command details. Light and dark modes use the product's existing Zinc surfaces and single blue accent. Layout is asymmetric and border-led, but avoids turning every section into a card.

### Interaction concept

The visitor steps through a safe operation in four semantic states: request, redacted preview, explicit apply, recoverable result. Content comes from the documented CLI contract. This is an explanation of the workflow, not a runnable mutation on the landing page.

### Signature moment

- Metaphor: an operation passes through four gates while the secret remains masked.
- Timing: after the opening promise and before capability breadth.
- Motion: a single blue trace advances through the gates; labels change from preview to confirmed. Terminal cursor blinks only while a command is active.
- Technology: native CSS transforms and opacity.
- Reduced motion: all four gates remain visible with a static completed path.
- Mobile: vertical sequence instead of horizontal travel.

### Motion ambition

Medium. Entrance hierarchy, the four-gate sequence, and restrained hover/press feedback. No marquee, scroll hijack, GSAP, or continuous decorative field.

### Risk

CLI-first pages can look generic. The defense is the product-specific four-gate workflow, actual output, real product capture, and the orbit logo rather than a stock terminal window.

### Why it fits

This direction expresses the project's strongest differentiation: redaction, dry-run, explicit apply, and recoverable deletion. It also gives the new agent-oriented logo a functional role without inventing a new brand metaphor.

## Direction 2: Make the vault manageable again

**One-line concept:** Turn a crowded vault into a clear list of decisions.

### Structure sketch

```text
hero: clutter problem + real overview capture
        ↓
health issues arranged by attention, not a progress bar
        ↓
duplicate cluster becomes one reviewed result
        ↓
URL and folder maintenance breadth
        ↓
agent safety contract
        ↓
try the real demo
```

### Style family

Product-led utility editorial. More visual emphasis on the real dashboard, list rhythm, and before/after grouping. The page feels closer to a calm maintenance tool than a developer platform.

### Interaction concept

The visitor expands one evidence-backed duplicate group, reviews what will be retained, then sees a static dry-run result. No destructive action occurs and no fabricated account data is presented as real.

### Signature moment

- Metaphor: several duplicate entries align into one reviewed record while recoverable originals move into a clearly labeled trash state.
- Timing: midpoint, after health priorities establish the problem.
- Motion: items reposition with transform and opacity, then settle into one result.
- Technology: native CSS with a tiny state controller only if replay is needed.
- Reduced motion: side-by-side before and after composition.
- Mobile: stacked before and after panels.

### Motion ambition

Medium. One merge sequence plus ordinary reveal and feedback transitions.

### Risk

This can understate the agent credential-management story and resemble a conventional password-health product. Random demo counts must never appear as product metrics.

### Why it fits

It is the easiest route for a Bitwarden user to understand immediately and gives the real demo UI the largest proof role.

## Direction 3: Plaintext stops here

**One-line concept:** Show the boundary that useful automation never needs to cross.

### Structure sketch

```text
minimal hero: local plaintext boundary
        ↓
browser / proxy / Bitwarden data-flow proof
        ↓
shared Web and CLI crypto implementation
        ↓
agent operations with disclosure exceptions
        ↓
self-hosting and source inspection
        ↓
open product
```

### Style family

Security architecture editorial. Spacious composition, schematic data paths, more written evidence, and less dashboard imagery. It feels like an inspectable system rather than a feature showcase.

### Interaction concept

The visitor follows one encrypted request across browser, proxy, and Bitwarden boundaries. Plaintext is shown only inside the local boundary; the proxy receives an encrypted payload and returns an encrypted response.

### Signature moment

- Metaphor: plaintext reaches a hard local boundary, becomes an encrypted packet, crosses the proxy, and returns still encrypted.
- Timing: second screen, immediately after the trust claim.
- Motion: the packet changes state at the boundary and follows a short path.
- Technology: semantic HTML and CSS motion using transforms and opacity.
- Reduced motion: a static labeled flow diagram.
- Mobile: vertical data path with the same labels.

### Motion ambition

Low to medium. One explanatory transition, restrained section reveals, no perpetual background animation beyond the existing logo cursor.

### Risk

It is technically credible but emotionally colder. It may bury the duplicate cleanup, health analysis, and credential aliases that distinguish the product from a generic local-first security statement.

### Why it fits

This direction best supports cautious users who need to understand the proxy and local-decryption boundary before they will click anything.

## Recommendation

Choose **Direction 1: Delegation with guardrails**.

It best matches the renamed Bitwardenagents identity, the CLI-oriented logo, and the strongest source-backed product contract. Direction 2 can contribute one real dashboard proof section later, but its narrative should not replace the guardrail sequence. Direction 3's data boundary can become a supporting trust section without taking over the hero.

Do not merge the three directions at this gate. Selecting Direction 1 means its promise, workflow, and signature moment control Stage C, while dashboard and architecture evidence remain supporting material only.
