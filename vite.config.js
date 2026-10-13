import { defineConfig } from 'vite';
import { proxyRouteDenial } from './agent-harness/core/proxy-policy.js';

export function proxyContractGuard() {
  return {
    name: 'bwvault-proxy-contract-guard',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = ['/bw-identity', '/bw-api', '/bw-eu-identity', '/bw-eu-api']
          .find((prefix) => req.url === prefix || req.url?.startsWith(`${prefix}/`));
        if (!match) return next();
        const parsed = new URL(req.url, 'http://localhost');
        let sameOrigin = false;
        try {
          const origin = new URL(req.headers.origin);
          const requestOrigin = `${req.socket?.encrypted ? 'https' : 'http'}://${req.headers.host}`;
          sameOrigin = Boolean(req.headers.origin) && origin.origin === requestOrigin;
        } catch {}
        const denial = proxyRouteDenial({
          proxyPath: match,
          method: req.method,
          pathname: parsed.pathname.slice(match.length) || '/',
          sameOrigin,
          authorization: req.headers.authorization,
          requireBearer: match.endsWith('-api'),
        });
        if (!denial) return next();
        res.statusCode = denial.status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, error: denial.message }));
      });
    },
  };
}

export default defineConfig({
  plugins: [proxyContractGuard()],
  base: process.env.VITE_BASE_PATH || '/',
  optimizeDeps: {
    include: ['argon2-browser'],
  },
  build: {
    target: 'esnext',
  },
  server: {
    proxy: {
      '/bw-identity': {
        target: 'https://identity.bitwarden.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bw-identity/, ''),
        secure: true,
      },
      '/bw-api': {
        target: 'https://api.bitwarden.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bw-api/, ''),
        secure: true,
      },
      '/bw-eu-identity': {
        target: 'https://identity.bitwarden.eu',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bw-eu-identity/, ''),
        secure: true,
      },
      '/bw-eu-api': {
        target: 'https://api.bitwarden.eu',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bw-eu-api/, ''),
        secure: true,
      },
    },
  },
});
