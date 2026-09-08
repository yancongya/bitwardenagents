import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(project, 'dist');

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: project,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

run('npm', ['run', 'landing:build']);
run('npx', ['vite', 'build', '--outDir', 'dist/dev'], {
  VITE_BASE_PATH: '/dev/',
});

await cp(join(project, 'landing', 'dist'), dist, { recursive: true });
await cp(join(project, 'functions'), join(dist, 'functions'), { recursive: true });
await writeFile(join(dist, '_redirects'), '/dev /dev/ 308\n', 'utf8');

console.log('Cloudflare bundle: landing at / and application at /dev/.');
