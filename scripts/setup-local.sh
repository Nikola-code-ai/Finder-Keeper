#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

for dependency in node npm uv python3; do
  if ! command -v "$dependency" >/dev/null 2>&1; then
    printf 'Missing prerequisite: %s. See README.md for local setup.\n' "$dependency" >&2
    exit 1
  fi
done

node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { console.error("Node.js 22 or newer is required."); process.exit(1); }'
if [[ ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env
fi
printf 'Installing the website dependencies in this project...\n'
npm ci
printf 'Installing Python dependencies in backend/.venv...\n'
uv sync --project backend --frozen
printf '\nReady. Start with ./scripts/dev.sh, then open http://127.0.0.1:3000.\n'
printf 'The first start downloads embedding weights once; later searches run locally.\n'
