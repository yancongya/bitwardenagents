# syntax=docker/dockerfile:1
#
# bwvault — containerised CLI for Bitwarden Vault Manager.
#
# Design goals:
#   1. The container IS the CLI: `docker run bwvault <any command>` behaves
#      exactly like the host-installed `bwvault`, so agents can drive it from
#      cron, CI or orchestration without a local Node toolchain.
#   2. Rootless: runs as UID 1000 (`bwvault`), read-only rootfs friendly.
#   3. Session state (never plaintext secrets — see core/session.js) persists
#      in a dedicated volume so re-authentication is not needed every run.
#
# Build:
#   docker build -t bwvault .
#
# Run:
#   docker run --rm -v bwvault-data:/data bwvault auth status
#   docker run --rm -it -v bwvault-data:/data bwvault          # REPL
#
# Interactive login (prompts on TTY):
#   docker run --rm -it -v bwvault-data:/data bwvault auth login --password --email you@example.com

# ---------- Stage 1: install production dependencies ----------
FROM node:22-slim AS deps

WORKDIR /build

# Copy manifests first for layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------- Stage 2: runtime image ----------
FROM node:22-slim AS runtime

# tini gives us correct signal handling (Ctrl-C in the REPL, cron TERM).
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 # Dedicated non-root user; uid/gid fixed for volume permission stability.
 && groupadd -g 1000 bwvault \
 && useradd -u 1000 -g 1000 -m -s /bin/bash bwvault

WORKDIR /app

# Application source (web app included — it is small and keeps the image
# useful for serving the dashboard if ever needed).
COPY --from=deps /build/node_modules ./node_modules
COPY package.json package-lock.json vite.config.js index.html ./
COPY src ./src
COPY public ./public
COPY functions ./functions
COPY agent-harness ./agent-harness

# Session home goes to /data so it can live on a volume.
# BWVAULT_HOME is read by core/session.js.
ENV BWVAULT_HOME=/data/session \
    NODE_ENV=production \
    NO_COLOR=

# /data is the only writable location we need.
RUN mkdir -p /data/session && chown -R bwvault:bwvault /data /app

USER bwvault
VOLUME ["/data"]
WORKDIR /app/agent-harness

# Sensible default: show help. Override with any bwvault arguments.
ENTRYPOINT ["/usr/bin/tini", "--", "node", "bin/bwvault.js"]
CMD ["--help"]

# A trivial self-check: the CLI answers --version without network access.
HEALTHCHECK --interval=60s --timeout=5s --start-period=5s --retries=2 \
  CMD ["node", "bin/bwvault.js", "--version"]
