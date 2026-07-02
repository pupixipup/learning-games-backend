#!/usr/bin/env bash
# Rebuild and redeploy the production stack on the VPS.
# Uses only docker-compose.yml — the override file is dev-only (local db).
set -euo pipefail

cd "$(dirname "$0")"

git pull --ff-only

docker compose -f docker-compose.yml up -d --build --remove-orphans

docker image prune -f

docker compose -f docker-compose.yml ps
