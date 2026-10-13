import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bwvault-proxy-scopes-'));
const sessionFile = path.join(testRoot, 'session.json');
fs.writeFileSync(sessionFile, JSON.stringify({
  serverUrl: 'https://vault.bitwarden.com',
  accessToken: 'persistent-fixture-token',
}), { mode: 0o600 });

async function reservePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => listener.once('error', reject).listen(0, '127.0.0.1', resolve));
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return port;
}

async function startServer(scopeConfig) {
  const port = await reservePort();
  const httpsPort = await reservePort();
  const env = {
    PATH: process.env.PATH || '',
    BWVAULT_HOME: testRoot,
    PORT: String(port),
    HTTPS_PORT: String(httpsPort),
    NODE_OPTIONS: `--import=${path.join(repoRoot, 'agent-harness/tests/proxy-upstream-fixture.mjs')}`,
  };
  if (scopeConfig === undefined) delete env.BWVAULT_PROXY_SCOPES;
  else env.BWVAULT_PROXY_SCOPES = scopeConfig;

  const child = spawn(process.execPath, [path.join(repoRoot, 'server.js')], {
    cwd: repoRoot,
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Fixture server exited during startup (${child.exitCode}). ${stderr}`);
    try {
      const response = await fetch(`${baseUrl}/api/pin`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return { child, baseUrl, stderr: () => stderr };
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  child.kill('SIGTERM');
  throw new Error(`Fixture server did not start. ${stderr}`);
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exitPromise = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  const exited = await Promise.race([
    exitPromise.then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), 3000)),
  ]);
  if (!exited) {
    child.kill('SIGKILL');
    await exitPromise;
  }
}

async function request(baseUrl, pathname, { method = 'GET', token, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: method === 'POST' ? 'grant_type=client_credentials' : undefined,
  });
  return response;
}

try {
  const scoped = await startServer('vault:read');
  try {
    assert.equal((await request(scoped.baseUrl, '/bw-api/folders', { token: 'persistent-fixture-token' })).status, 200,
      'configured read scope reaches the proxy for the persisted session token');
    const widenedRequest = await request(scoped.baseUrl, '/bw-api/sync?scope=vault%3Asecrets', {
      token: 'persistent-fixture-token',
      headers: { 'X-BWVault-Scopes': 'vault:secrets,vault:delete' },
    });
    assert.equal(widenedRequest.status, 403,
      'client scope header and query parameter cannot expand persisted session capabilities');

    const login = await request(scoped.baseUrl, '/bw-identity/connect/token', {
      method: 'POST',
      headers: { Origin: scoped.baseUrl, 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    assert.equal(login.status, 200, 'same-origin token login is relayed through the local upstream fixture');
    const issuedToken = (await login.json()).access_token;
    assert.equal((await request(scoped.baseUrl, '/bw-api/folders', { token: issuedToken })).status, 200,
      'configured read scope is attached to a token issued during this process');
    const issuedWidenedRequest = await request(scoped.baseUrl, '/bw-api/sync?scope=vault%3Asecrets', {
      token: issuedToken,
      headers: { 'X-BWVault-Scopes': 'vault:secrets' },
    });
    assert.equal(issuedWidenedRequest.status, 403,
      'client scope header and query parameter cannot expand short-lived token capabilities');
  } finally {
    await stopServer(scoped.child);
  }

  const invalid = await startServer('vault:unknown');
  try {
    assert.equal((await request(invalid.baseUrl, '/bw-api/folders', { token: 'persistent-fixture-token' })).status, 403,
      'unknown scope values grant no folder capability');
    assert.equal((await request(invalid.baseUrl, '/bw-api/sync', { token: 'persistent-fixture-token' })).status, 403,
      'unknown scope values grant no vault secret capability');
  } finally {
    await stopServer(invalid.child);
  }

  console.log('ok proxy-scopes-integration: process configuration restricts persisted and issued tokens; client scope inputs cannot expand grants; unknown scopes fail closed');
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true });
}
