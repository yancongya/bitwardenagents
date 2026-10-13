import assert from 'node:assert/strict';
import { BitwardenClient } from '../../src/bitwarden-api.js';

let calls = 0;
const fetchImpl = async (_url, { signal }) => {
  calls += 1;
  if (calls === 1) {
    await new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    });
  }
  return new Response('{}', { status: 200 });
};

const client = new BitwardenClient('https://vault.bitwarden.com', null, {
  requestTimeoutMs: 10,
  fetchImpl,
});
client.accessToken = 'fixture-token';

const response = await client._authedFetch('https://vault.bitwarden.com/api/sync');
assert.equal(response.status, 200, 'a timed out request should use the existing network retry path');
assert.equal(calls, 2, 'a timeout should retry instead of hanging indefinitely');

let refreshCalls = 0;
const refreshClient = new BitwardenClient('https://vault.bitwarden.com', null, {
  requestTimeoutMs: 10,
  fetchImpl: async (_url, { signal }) => {
    refreshCalls += 1;
    await new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    });
  },
});
refreshClient.refreshToken = 'fixture-refresh-token';
await assert.rejects(refreshClient.refreshAccessToken(), { name: 'AbortError' });
assert.equal(refreshCalls, 1, 'a stalled token refresh should time out without retrying indefinitely');

console.log('Bitwarden authenticated request and token refresh timeout tests passed.');
