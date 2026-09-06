/**
 * Canonical icon system — single source of truth.
 *
 * Style contract:
 *   - 24×24 viewBox, 2px safe padding
 *   - stroke="currentColor", stroke-width 1.8, round caps/joins, fill none
 *   - No fills, no gradients, no status colors (CSS controls color via currentColor)
 *   - One family per project; do not mix with external icon libs
 *
 * Usage: icon('lock', { size: 18 }) → inline SVG string for HTML templates.
 */

const PATHS = {
  // ── Item types ──
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="15.5" r="1.2"/>',
  key: '<circle cx="8" cy="14" r="4"/><path d="M11 11 20 2M16 6l3 3M13 9l2 2"/>',
  note: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/>',
  card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M6.5 15h4"/>',
  identity: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6.5 16c.5-1.5 1.4-2.2 2.5-2.2s2 .7 2.5 2.2M15 10h3.5M15 14h3.5"/>',

  // ── Navigation ──
  chart: '<path d="M4 4v16h16"/><path d="M8 16v-5M13 16V8M18 16v-8"/>',
  star: '<path d="m12 3 2.7 5.8 6.3.8-4.6 4.3 1.2 6.1L12 17l-5.6 3 1.2-6.1L3 9.6l6.3-.8z"/>',
  shuffle: '<path d="M3 7h4l4 10h6"/><path d="M3 17h4l1.5-3.75"/><path d="M14 7h3"/><path d="m17 4 3 3-3 3M17 14l3 3-3 3"/><path d="M14 17h3"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  shield: '<path d="M12 3 5 6v6c0 4.4 3 7.4 7 9 4-1.6 7-4.6 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/>',
  broken: '<path d="M12 3 5 6v6c0 4.4 3 7.4 7 9 4-1.6 7-4.6 7-9V6z"/><path d="m12 8-2 3h3l-2 3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.5-1.5"/>',
  logout: '<path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8"/><path d="m17 8 4 4-4 4M21 12H9"/>',

  // ── Actions ──
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  sync: '<path d="M21.5 4v5h-5M2.5 20v-5h5"/><path d="M4.6 9a8 8 0 0 1 14.2-1.5M19.4 15a8 8 0 0 1-14.2 1.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 13.5A8.5 8.5 0 0 1 10.5 4 7.5 7.5 0 1 0 20 13.5z"/>',
  eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
  eyeOff: '<path d="M4 4l16 16"/><path d="M9.9 5.9A9.7 9.7 0 0 1 12 5.5c6.5 0 10 6.5 10 6.5a17.6 17.6 0 0 1-3.2 3.9M6.1 8.3A16.8 16.8 0 0 0 2 12s3.5 6.5 10 6.5a9.9 9.9 0 0 0 4-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m13.5 6.5 3 3"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m4 12.5 5 5L20 6.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  warn: '<path d="M12 3 2.5 20h19z"/><path d="M12 9.5v4.5M12 17.2v.3"/>',
  xmark: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18 14.5 14.5 0 0 1 0-18z"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
};

/**
 * Render an icon as an inline SVG string.
 * @param {string} name - icon name from PATHS
 * @param {{size?: number, cls?: string}} opts
 */
export function icon(name, opts = {}) {
  const paths = PATHS[name];
  if (!paths) {
    console.warn(`[icons] unknown icon: ${name}`);
    return '';
  }
  const size = opts.size || 18;
  const cls = opts.cls ? ` class="${opts.cls}"` : '';
  return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export const ICON_NAMES = Object.keys(PATHS);

/**
 * Hydrate all [data-icon] placeholders in the DOM.
 * Usage in HTML: <span class="nav-icon" data-icon="lock" data-icon-size="16"></span>
 */
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    const name = el.dataset.icon;
    const size = parseInt(el.dataset.iconSize || '18', 10);
    el.innerHTML = icon(name, { size });
  });
}
