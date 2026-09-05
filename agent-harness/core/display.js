/**
 * Output rendering: human tables by default, JSON on demand.
 *
 * Every command supports `--json`. In JSON mode the process prints a single
 * machine-readable object to stdout and nothing else, so agents can pipe it
 * into `jq` or parse it directly. Diagnostics always go to stderr so they
 * never corrupt the JSON stream.
 */

const useColor = () => process.stdout.isTTY && !process.env.NO_COLOR;

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function paint(text, color) {
  if (!useColor() || !color) return text;
  return `${C[color]}${text}${C.reset}`;
}

export const color = paint;

/**
 * Emit the final result of a command.
 * JSON mode prints compact JSON; otherwise callers use printTable/printKV.
 */
export function emit(payload, { json = false } = {}) {
  if (json) {
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  }
  return payload;
}

/** Info/warning/error all go to stderr to keep stdout clean for JSON. */
export function info(msg) {
  process.stderr.write(`${paint('●', 'blue')} ${msg}\n`);
}
export function warn(msg) {
  process.stderr.write(`${paint('⚠', 'yellow')} ${msg}\n`);
}
export function fail(msg) {
  process.stderr.write(`${paint('✗', 'red')} ${msg}\n`);
}
export function ok(msg) {
  process.stderr.write(`${paint('✓', 'green')} ${msg}\n`);
}

/**
 * Render rows as an aligned table.
 * @param {string[]} headers
 * @param {(string|number)[][]} rows
 * @param {{maxWidth?: number}} [opts]
 */
export function printTable(headers, rows, { maxWidth = 40 } = {}) {
  if (!rows.length) {
    process.stdout.write(paint('(no items)\n', 'dim'));
    return;
  }
  const cols = headers.length;
  const widths = Array.from({ length: cols }, (_, i) =>
    Math.min(
      maxWidth,
      Math.max(headers[i].length, ...rows.map((r) => String(r[i] ?? '').length))
    )
  );

  const fmt = (cells, w) =>
    cells
      .map((c, i) => {
        let s = String(c ?? '');
        if (s.length > widths[i]) s = s.slice(0, widths[i] - 1) + '…';
        return s.padEnd(widths[i]);
      })
      .join('  ')
      .trimEnd();

  process.stdout.write(paint(fmt(headers, widths), 'bold') + '\n');
  process.stdout.write(paint(widths.map((w) => '─'.repeat(w)).join('  '), 'dim') + '\n');
  for (const r of rows) process.stdout.write(fmt(r, widths) + '\n');
}

/** Key/value block, e.g. for `auth status`. */
export function printKV(pairs) {
  const w = Math.max(...pairs.map(([k]) => k.length));
  for (const [k, v] of pairs) {
    process.stdout.write(`${paint(k.padEnd(w), 'cyan')}  ${v ?? paint('—', 'dim')}\n`);
  }
}

/** Simple deterministic progress line (no TTY animation, CI-friendly). */
export function progress(current, total, label = '') {
  const pct = total ? Math.round((current / total) * 100) : 0;
  process.stderr.write(`\r${paint('●', 'blue')} ${label} ${current}/${total} (${pct}%)`);
  if (current >= total) process.stderr.write('\n');
}
