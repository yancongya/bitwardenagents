import assert from 'node:assert/strict';
import { BitwardenClient } from '../../src/bitwarden-api.js';

const originalFetch = globalThis.fetch;

async function check(statuses, runAssertions) {
  const calls = [];
  const responses = [...statuses];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), method: options.method, body: options.body });
    const status = responses.shift();
    return { ok: status >= 200 && status < 300, status };
  };

  const client = new BitwardenClient('https://vault.bitwarden.com');
  client.apiUrl = 'https://vault.bitwarden.com/api';
  client.accessToken = 'fixture-only-token';
  try {
    await runAssertions(client, calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

for (const status of [401, 403, 404]) {
  await check([status], async (client, calls) => {
    await assert.rejects(client.permanentDeleteBulk(['fixture-id']), new RegExp(`Permanent delete failed: ${status}`));
    assert.equal(calls.length, 1, `${status} must not try a second destructive endpoint`);
    assert.equal(calls[0].method, 'PUT');
    assert.match(calls[0].url, /\/ciphers\/delete-admin$/);
  });
}

await check([405, 204], async (client, calls) => {
  await client.permanentDeleteBulk(['fixture-id']);
  assert.equal(calls.length, 2, '405 may use the documented legacy-method fallback');
  assert.deepEqual(calls.map(({ method }) => method), ['PUT', 'DELETE']);
  assert.deepEqual(calls.map(({ body }) => JSON.parse(body)), [{ ids: ['fixture-id'] }, { ids: ['fixture-id'] }]);
});

await check([200], async (client, calls) => {
  await client.permanentDeleteBulk(['fixture-id']);
  assert.equal(calls.length, 1, 'successful primary endpoint must not call fallback');
});

await check([405, 403], async (client, calls) => {
  await assert.rejects(client.permanentDeleteBulk(['fixture-id']), /Permanent delete failed: 403/);
  assert.equal(calls.length, 2, 'fallback permission denial must be returned without more requests');
});

console.log('Bitwarden delete endpoint fail-closed tests passed.');
