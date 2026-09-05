/**
 * Interactive REPL.
 *
 * CLI-Anything convention: invoking the CLI with no subcommand drops into a
 * REPL so an agent (or human) can hold context across several operations
 * without re-authenticating or re-syncing on every call.
 *
 * The REPL is intentionally thin: it re-dispatches through the same command
 * modules the one-shot path uses, so behaviour cannot drift between modes.
 */

import readline from 'node:readline';
import * as out from '../core/display.js';
import * as auth from '../commands/auth.js';
import * as vaultCmd from '../commands/vault.js';
import * as analyzeCmd from '../commands/analyze.js';
import * as manageCmd from '../commands/manage.js';
import * as session from '../core/session.js';

const BANNER = `
${out.color('bwvault', 'cyan')} ${out.color('interactive', 'dim')}
Type ${out.color('help', 'green')} for commands, ${out.color('exit', 'green')} to quit.
Secrets stay redacted unless you pass ${out.color('--reveal', 'yellow')}.
`;

/**
 * Tokenise a REPL line the same way a shell would (respecting quotes).
 */
function tokenize(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    out.push(m[1] ?? m[2] ?? m[3]);
  }
  return out;
}

/** Dispatch one tokenised command. Returns a printable result. */
async function run(argv) {
  const json = argv.includes('--json');
  const reveal = argv.includes('--reveal');
  const [group, cmd, ...rest] = argv;
  const opts = { json, reveal };

  // Minimal flag grab (same names as the one-shot CLI).
  const flag = (name) => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const has = (name) => rest.includes(`--${name}`);

  switch (group) {
    case 'help':
      process.stdout.write(HELP_TEXT);
      return null;

    case 'auth':
      if (cmd === 'login') {
        return has('api-key')
          ? auth.loginApiKey({
              json,
              clientId: flag('client-id'),
              clientSecret: flag('client-secret'),
              email: flag('email'),
              server: flag('server'),
            })
          : auth.loginPassword({ json, email: flag('email'), server: flag('server') });
      }
      if (cmd === 'logout') return auth.logout();
      if (cmd === 'status') return auth.status();
      break;

    case 'vault':
      if (cmd === 'sync') return vaultCmd.sync(opts);
      if (cmd === 'list') return vaultCmd.list({ ...opts, type: flag('type'), folder: flag('folder') });
      if (cmd === 'search') return vaultCmd.search({ ...opts, query: rest.filter((a) => !a.startsWith('-'))[0] });
      if (cmd === 'get') return vaultCmd.get({ ...opts, id: flag('id') });
      if (cmd === 'folders') return vaultCmd.folders(opts);
      if (cmd === 'export') return vaultCmd.exportVault({ ...opts, output: flag('output') });
      break;

    case 'analyze':
      if (cmd === 'health') return analyzeCmd.health(opts);
      if (cmd === 'duplicates') return analyzeCmd.duplicates(opts);
      if (cmd === 'urls') return analyzeCmd.urls(opts);
      break;

    case 'manage':
      if (cmd === 'dedup') return manageCmd.dedup({ ...opts, apply: has('apply') });
      if (cmd === 'trash') return manageCmd.trash({ ...opts, action: cmd === 'trash' ? rest.find((a) => !a.startsWith('-')) : undefined, id: flag('id'), apply: has('apply'), yes: has('yes') });
      if (cmd === 'folders') return manageCmd.folders({ ...opts, action: rest.find((a) => !a.startsWith('-')), id: flag('id'), name: flag('name'), apply: has('apply') });
      break;

    case 'exit':
    case 'quit':
      return { __exit: true };

    default:
      out.fail(`Unknown command: ${argv.join(' ')}`);
      process.stdout.write('Type "help" for available commands.\n');
      return null;
  }
  out.fail(`Incomplete command: ${argv.join(' ')}`);
  return null;
}

const HELP_TEXT = `
${out.color('COMMANDS', 'bold')}
  auth login --api-key --client-id <id> --client-secret <s> --email <e>
  auth login --password --email <e>
  auth logout | auth status

  vault sync | vault list [--type login] [--folder f]
  vault search <query> | vault get --id <id> | vault folders
  vault export --output <file>

  analyze health | analyze duplicates | analyze urls

  manage dedup [--apply]        (dry-run unless --apply)
  manage trash list | restore --id <id> --apply | purge --id <id> --apply --yes
  manage folders create --name <n> --apply | rename --id <i> --name <n> --apply | delete --id <i> --apply

${out.color('FLAGS', 'bold')}
  --json     machine-readable output
  --reveal   show secrets (use deliberately)
  exit       leave the REPL
`;

/** Start the REPL. Resolves when the user exits. */
export async function repl() {
  process.stdout.write(BANNER);

  const st = session.sessionStatus();
  process.stdout.write(
    st.authenticated
      ? `${out.color('●', 'green')} authenticated as ${st.email || '(unknown)'} @ ${st.serverUrl}\n`
      : `${out.color('●', 'yellow')} not authenticated — run "auth login" first\n`
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: out.color('bwvault', 'cyan') + out.color('> ', 'dim'),
  });
  rl.prompt();

  return new Promise((resolve) => {
    rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return rl.prompt();

      let result;
      try {
        result = await run(tokenize(trimmed));
      } catch (e) {
        out.fail(e.message);
        return rl.prompt();
      }

      if (result?.__exit) {
        rl.close();
        return resolve();
      }
      if (result) {
        const useJson = trimmed.includes('--json');
        out.emit(result, { json: useJson });
        if (!useJson) {
          // Same rendering ladder as the one-shot path.
          if (Array.isArray(result?.items)) {
            out.printTable(result.headers || Object.keys(result.items[0] || {}), result.rows || []);
          } else if (result?.kv) {
            out.printKV(result.kv);
          } else if (result?.message) {
            out.ok(result.message);
          } else {
            process.stdout.write(JSON.stringify(result, null, 2) + '\n');
          }
        }
      }
      rl.prompt();
    });

    rl.on('close', () => {
      process.stdout.write(out.color('\nbye\n', 'dim'));
      resolve();
    });
  });
}
