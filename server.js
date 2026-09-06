/**
 * Production server: serves the built web app + proxies Bitwarden API.
 * Replaces Vite dev server's proxy in production.
 */

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = parseInt(process.env.PORT || '3000', 10);
const SESSION_DIR = process.env.BWVAULT_HOME || path.join(__dirname, 'data');
const SESSION_FILE = path.join(SESSION_DIR, 'session.json');

// Bitwarden proxy targets (same as vite.config.js)
const PROXIES = {
  '/bw-identity': { target: 'https://identity.bitwarden.com', strip: '/bw-identity' },
  '/bw-eu-identity': { target: 'https://identity.bitwarden.eu', strip: '/bw-eu-identity' },
  '/bw-api': { target: 'https://api.bitwarden.com', strip: '/bw-api' },
  '/bw-eu-api': { target: 'https://api.bitwarden.eu', strip: '/bw-eu-api' },
};

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

function proxyRequest(proxyPath, req, res) {
  const conf = PROXIES[proxyPath];
  const targetPath = req.url.replace(conf.strip, '') || '/';
  const url = new URL(targetPath, conf.target);

  const headers = { ...req.headers, host: url.host };
  delete headers['x-forwarded-for'];
  delete headers['x-real-ip'];

  const proxyReq = https.request(url, {
    method: req.method,
    headers,
    timeout: 30000,
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`Proxy error: ${err.message}`);
    if (!res.headersSent) res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  // --- Session API: shared between Web UI and CLI ---
  const urlObj = new URL(req.url, `http://localhost:${PORT}`);

  // POST /api/session/verify — verify PIN and return session
  if (req.method === 'POST' && urlObj.pathname === '/api/session/verify') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const { pin } = JSON.parse(body);
        const pinFile = path.join(path.dirname(SESSION_FILE), 'pin.json');
        if (!fs.existsSync(pinFile)) {
          // No PIN set — require the user to set one via CLI first
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'PIN not set. Run: bwvault auth login --set-pin <pin>' }));
          return;
        }
        const { hash, salt } = JSON.parse(fs.readFileSync(pinFile, 'utf8'));
        const inputHash = crypto.createHash('sha256').update(salt + pin).digest('hex');
        if (inputHash !== hash) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid PIN' }));
          return;
        }
        // PIN correct — return session
        if (fs.existsSync(SESSION_FILE)) {
          const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, session }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'No session. Run CLI login first.' }));
        }
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // GET /api/pin — check if PIN is set
  if (req.method === 'GET' && urlObj.pathname === '/api/pin') {
    const pinFile = path.join(path.dirname(SESSION_FILE), 'pin.json');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, pinSet: fs.existsSync(pinFile) }));
    return;
  }

  // POST /api/session — save session from Web UI
  if (req.method === 'POST' && urlObj.pathname === '/api/session') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const session = JSON.parse(body);
        fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
        fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), { mode: 0o600 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // GET /api/session — load session for Web UI restore
  if (req.method === 'GET' && urlObj.pathname === '/api/session') {
    try {
      if (fs.existsSync(SESSION_FILE)) {
        const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, session: data }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
      }
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false }));
    }
    return;
  }

  // DELETE /api/session — clear session
  if (req.method === 'DELETE' && urlObj.pathname === '/api/session') {
    try {
      if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // --- Bitwarden proxy ---
  for (const prefix of Object.keys(PROXIES)) {
    if (req.url.startsWith(prefix)) {
      return proxyRequest(prefix, req, res);
    }
  }

  // Static file serving
  let filePath = path.join(DIST, req.url === '/' ? 'index.html' : req.url);

  // If no extension, try index.html (SPA fallback)
  if (!path.extname(filePath)) {
    filePath = path.join(DIST, 'index.html');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Fallback to index.html for SPA routing
      fs.readFile(path.join(DIST, 'index.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`bwvault web server running on http://0.0.0.0:${PORT}`);
  console.log(`Web UI: http://localhost:${PORT}`);
  console.log(`Bitwarden proxy: /bw-api, /bw-identity`);
});

// --- HTTPS with auto-generated self-signed cert ---
// Web Crypto API (crypto.subtle) requires HTTPS or localhost in browsers.
// Generate a self-signed cert on first start so the dashboard works over LAN.
const CERT_DIR = path.join(path.dirname(SESSION_DIR), 'certs');
const CERT_FILE = path.join(CERT_DIR, 'cert.pem');
const KEY_FILE = path.join(CERT_DIR, 'key.pem');
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '3443', 10);

function ensureCerts() {
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) return;
  fs.mkdirSync(CERT_DIR, { recursive: true, mode: 0o700 });
  // Generate self-signed cert valid for 10 years, covering LAN IPs
  execSync(`openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "${KEY_FILE}" -out "${CERT_FILE}" \
    -days 3650 -subj "/CN=bwvault-lan" \
    -addext "subjectAltName=IP:192.168.31.110,IP:127.0.0.1,DNS:localhost"`, {
    stdio: 'pipe',
  });
  fs.chmodSync(KEY_FILE, 0o600);
  console.log(`Self-signed cert generated at ${CERT_DIR}`);
}

try {
  ensureCerts();
  const httpsServer = https.createServer({
    cert: fs.readFileSync(CERT_FILE),
    key: fs.readFileSync(KEY_FILE),
  }, (req, res) => server.emit('request', req, res));
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`HTTPS (Web Crypto enabled): https://192.168.31.110:${HTTPS_PORT}`);
  });
} catch (e) {
  console.warn(`HTTPS setup failed (HTTPS won't be available): ${e.message}`);
}
