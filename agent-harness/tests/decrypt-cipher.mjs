import assert from 'node:assert/strict';

const { encryptString } = await import('../core/bridge.js');
const { decryptCipher } = await import('../core/vault.js');

function makeKey(seed) {
  return {
    encKey: Uint8Array.from({ length: 32 }, (_, i) => (seed + i) % 256),
    macKey: Uint8Array.from({ length: 32 }, (_, i) => (seed + 64 + i) % 256),
  };
}

async function encryptLogin(name, username, password, key) {
  return {
    Id: `fixture-${name}`,
    Type: 1,
    Name: await encryptString(name, key),
    Notes: await encryptString('safe fixture note', key),
    Login: {
      Username: await encryptString(username, key),
      Password: await encryptString(password, key),
      Totp: null,
      Uris: [{ Uri: await encryptString('https://github.com', key) }],
    },
    Fields: [{ Name: await encryptString('scope', key), Value: await encryptString('contents:write', key), Type: 0 }],
  };
}

const accountKey = makeKey(3);
const itemKey = {
  encKey: Uint8Array.from({ length: 32 }, (_, i) => 33 + i),
  macKey: Uint8Array.from({ length: 32 }, (_, i) => 65 + i),
};
// decryptSymmetricKey expects the wrapped key plaintext to contain 64 bytes.
// ASCII bytes let the existing CipherString encryptor produce that fixture.
const itemKeyBytes = new Uint8Array([...itemKey.encKey, ...itemKey.macKey]);
const wrappedKeyText = String.fromCharCode(...itemKeyBytes);
const protectedItemKey = await encryptString(wrappedKeyText, accountKey);

const perItemCipher = await encryptLogin('Agent Credential: test.github', 'octocat', 'fixture-secret', itemKey);
perItemCipher.Key = protectedItemKey;
const decryptedPerItem = await decryptCipher(perItemCipher, accountKey);
assert.equal(decryptedPerItem.name, 'Agent Credential: test.github');
assert.equal(decryptedPerItem.login.username, 'octocat');
assert.equal(decryptedPerItem.login.password, 'fixture-secret');
assert.equal(decryptedPerItem.login.uris[0], 'https://github.com');
assert.equal(decryptedPerItem.fields[0].name, 'scope');
assert.equal(decryptedPerItem.fields[0].value, 'contents:write');

const legacyCipher = await encryptLogin('legacy-entry', 'legacy-user', 'legacy-secret', accountKey);
const decryptedLegacy = await decryptCipher(legacyCipher, accountKey);
assert.equal(decryptedLegacy.name, 'legacy-entry');
assert.equal(decryptedLegacy.login.password, 'legacy-secret');

const malformedCipher = { ...perItemCipher, Key: 'invalid-cipher-key' };
const decryptedMalformed = await decryptCipher(malformedCipher, accountKey);
assert.equal(decryptedMalformed.name, null);
assert.equal(decryptedMalformed.login.password, null);
assert.equal(decryptedMalformed.decryptionError, 'item-key-decryption-failed');

console.log('ok decrypt-cipher: per-item, legacy, and malformed key paths');
