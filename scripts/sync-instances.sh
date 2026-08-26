#!/usr/bin/env bash
set -e

# Usage:
#   ./scripts/sync-instances.sh
#   ./scripts/sync-instances.sh user/repo1 user/repo2

INSTANCES=("$@")

if [ ${#INSTANCES[@]} -eq 0 ]; then
  CONFIG_FILE="$(dirname "$0")/../.github/instances.json"
  if [ -f "$CONFIG_FILE" ]; then
    mapfile -t INSTANCES < <(jq -r '.[]' "$CONFIG_FILE")
  else
    echo "Error: No repositories specified and .github/instances.json not found."
    echo "Usage: ./scripts/sync-instances.sh [owner/repo1 owner/repo2 ...]"
    exit 1
  fi
fi

echo "=========================================="
echo " Triggering Sync for Template Instances   "
echo "=========================================="

for REPO in "${INSTANCES[@]}"; do
  echo "--> Triggering sync on: $REPO"
  if gh workflow run sync-template.yml --repo "$REPO" 2>/dev/null; then
    echo "    ✓ Successfully triggered sync-template workflow on $REPO"
  else
    echo "    Attempting dispatch trigger for $REPO..."
    if gh api --method POST "/repos/$REPO/dispatches" -f "event_type=template_updated" 2>/dev/null; then
      echo "    ✓ Successfully sent template_updated event to $REPO"
    else
      echo "    ❌ Failed to trigger sync on $REPO. Verify gh auth and repo permissions."
    fi
  fi
done

echo "=========================================="
echo " All instance sync triggers complete!     "
echo "=========================================="
