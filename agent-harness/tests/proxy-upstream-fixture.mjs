import https from 'node:https';
import { PassThrough, Readable } from 'node:stream';

// Replace only this child process's Bitwarden HTTPS client with a local fixture.
https.request = (_url, options, callback) => {
  const request = new PassThrough();
  request.on('finish', () => {
    const body = options.method === 'POST' && options.headers?.['content-type']?.includes('application/x-www-form-urlencoded')
      ? JSON.stringify({ access_token: 'issued-fixture-token', expires_in: 3600 })
      : JSON.stringify({ Ciphers: [], Folders: [], Profile: {} });
    const response = Readable.from([Buffer.from(body)]);
    response.statusCode = 200;
    response.headers = { 'content-type': 'application/json' };
    callback(response);
  });
  return request;
};
