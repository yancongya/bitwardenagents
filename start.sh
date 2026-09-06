#!/bin/bash
# bwvault entrypoint: route "cli" commands to the CLI, otherwise serve Web UI.
# This lets the same image do both: long-running Web server or one-shot CLI.

if [ "$1" = "cli" ]; then
  shift
  exec node /app/agent-harness/bin/bwvault.js "$@"
fi

# Default: start web server
exec node /app/server.js
