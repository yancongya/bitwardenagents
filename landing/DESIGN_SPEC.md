# Bitwardenagents Landing v2.1 Design Specification

## Design system

Design read: a trustworthy agent tool that makes delegation visible, constrained, and reversible.

- Design variance: `0.75`
- Motion intensity: `0.45`
- Visual density: `0.6`
- Visual family: technical editorial with source-backed interactive proof
- Theme: automatic light and dark with persisted manual override
- Accent: product blue for action, amber for pending confirmation, green only for completed recoverable outcomes
- Geometry: compact border-led surfaces; the product workbench uses an asymmetric `60/40` hierarchy

## Evidence boundary

- Dynamic panels reproduce real product fields, command groups, and states rather than its pixels.
- Every synthetic record and outcome carries a visible `Synthetic data` / `合成数据` label.
- Terminal commands and behavior trace to `bwvault --help` and the CLI implementation.
- Dashboard screenshots are retained for social metadata, not used as interactive page content.

## Narrative and motion

1. Hero: a live vault preview scans once and stops at `waiting for confirmation`.
2. Guardrails: the only signature moment; a real dry-run contract advances through four gates.
3. CLI playground: instant command-group switching with restrained state feedback, not a second theater.
4. Product workbench: one dominant health panel plus two supporting operation panels.
5. Trust boundary: encrypted packets travel once and decode only at the browser boundary.
6. Final CTA: a quiet decision point with source, skill, and machine-readable documentation.

Core content is visible by default. JavaScript adds `.motion-ready` only when reveal behavior can run. Reduced-motion mode renders stable final states and starts no looping choreography.

## Validation contract

- No console errors during initial load, anchor navigation, language/theme changes, or theater replay.
- Core content remains readable before IntersectionObserver callbacks and when JavaScript is disabled.
- Test desktop, 768px, and 390px in light/dark and reduced-motion modes.
- The terminal signature moment runs to completion; CLI tabs remain keyboard reachable; no horizontal overflow.
