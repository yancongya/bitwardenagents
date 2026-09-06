/**
 * HTML escaping & URI utilities.
 * Extracted from app.js — zero dependencies.
 */

export function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Wrap a URI string as a clickable link (opens in new tab).
 * Non-web URIs (androidapp://, iosapp://) are displayed as plain text.
 */
export function linkUri(uri) {
  if (!uri) return '';
  const escaped = escHtml(uri);
  // Only linkify http/https URLs
  if (/^https?:\/\//i.test(uri)) {
    return `<a href="${escAttr(uri)}" target="_blank" rel="noopener noreferrer" class="uri-link" onclick="event.stopPropagation()">${escaped}</a>`;
  }
  return escaped;
}

export function escAttr(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
