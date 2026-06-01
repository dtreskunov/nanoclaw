#!/bin/bash
# Rebuild all container images: the base image first, then rebuild and restart
# every agent group that has a per-group image (custom packages).
#
# Usage:
#   ./container/rebuild-all.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=== Rebuilding base image ==="
bash container/build.sh
echo ""

echo "=== Rebuilding per-group images ==="
rebuilt=0

for config in groups/*/container.json; do
  [ -f "$config" ] || continue
  grep -q '"imageTag"' "$config" || continue

  group_folder=$(basename "$(dirname "$config")")
  # Extract agentGroupId from the config
  agent_group_id=$(grep '"agentGroupId"' "$config" | sed 's/.*"agentGroupId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
  [ -n "$agent_group_id" ] || continue

  echo "  [$group_folder] rebuilding and restarting ($agent_group_id)..."
  pnpm exec tsx src/cli/client.ts groups restart --id "$agent_group_id" --rebuild
  rebuilt=$((rebuilt + 1))
done

echo ""
echo "=== Done: base + $rebuilt per-group image(s) rebuilt ==="
