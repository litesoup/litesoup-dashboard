#!/usr/bin/env bash
# install.sh — deploy litesoup-agent to a managed VPS
#
# Usage:
#   bash install.sh [--target user@host] [--dry-run]
#
# With no --target, installs locally (must be run as root on the VPS itself).
# With --target, rsyncs the agent directory and installs via SSH.
#
# Requirements on the target:
#   - Ubuntu 22.04 or 24.04
#   - SSH access as root (or a user with sudo)
#   - curl (for Bun install)

set -euo pipefail

AGENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_PATH="/opt/litesoup-agent"
SERVICE_NAME="litesoup-agent"
SERVICE_FILE="${AGENT_DIR}/litesoup-agent.service"
CACHE_DIR="/var/lib/litesoup-agent"

TARGET=""
DRY_RUN=false

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

run() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

ssh_run() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] ssh ${TARGET} $*"
  else
    ssh "${TARGET}" "$@"
  fi
}

# ---------------------------------------------------------------------------
# Remote deployment
# ---------------------------------------------------------------------------
if [[ -n "$TARGET" ]]; then
  echo "[install] Syncing agent files to ${TARGET}:${INSTALL_PATH} ..."
  run rsync -az --delete \
    --exclude='node_modules' \
    --exclude='bun.lock' \
    --exclude='__tests__' \
    "${AGENT_DIR}/" \
    "${TARGET}:${INSTALL_PATH}/"

  echo "[install] Running remote install on ${TARGET} ..."
  ssh_run bash -s <<'REMOTE'
    set -euo pipefail
    INSTALL_PATH=/opt/litesoup-agent
    SERVICE_NAME=litesoup-agent
    CACHE_DIR=/var/lib/litesoup-agent

    # Install Bun if not present
    if ! command -v bun &>/dev/null; then
      echo "[install] Installing Bun..."
      curl -fsSL https://bun.sh/install | bash
      export PATH="$HOME/.bun/bin:$PATH"
    fi

    # Install dependencies
    echo "[install] Installing npm dependencies..."
    cd "$INSTALL_PATH"
    bun install --production

    # Create cache directory
    mkdir -p "$CACHE_DIR"
    chmod 700 "$CACHE_DIR"

    # Install systemd service
    cp "${INSTALL_PATH}/litesoup-agent.service" "/etc/systemd/system/${SERVICE_NAME}.service"
    systemctl daemon-reload
    systemctl enable "${SERVICE_NAME}"
    systemctl restart "${SERVICE_NAME}"

    echo "[install] litesoup-agent installed and started."
    systemctl status "${SERVICE_NAME}" --no-pager
REMOTE
  exit 0
fi

# ---------------------------------------------------------------------------
# Local installation (run directly on the VPS as root)
# ---------------------------------------------------------------------------
if [[ "$EUID" -ne 0 ]]; then
  echo "[install] Error: local install must be run as root." >&2
  exit 1
fi

echo "[install] Installing litesoup-agent locally to ${INSTALL_PATH} ..."

# Install Bun if not present
if ! command -v bun &>/dev/null; then
  echo "[install] Installing Bun..."
  run curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# Sync files to install path (if not already there)
if [[ "$AGENT_DIR" != "$INSTALL_PATH" ]]; then
  run rsync -az --delete \
    --exclude='node_modules' \
    --exclude='bun.lock' \
    --exclude='__tests__' \
    "${AGENT_DIR}/" \
    "${INSTALL_PATH}/"
fi

# Install dependencies
echo "[install] Installing npm dependencies..."
run bun install --production --cwd "${INSTALL_PATH}"

# Create cache directory
run mkdir -p "$CACHE_DIR"
run chmod 700 "$CACHE_DIR"

# Install and enable systemd service
run cp "${SERVICE_FILE}" "/etc/systemd/system/${SERVICE_NAME}.service"
run systemctl daemon-reload
run systemctl enable "${SERVICE_NAME}"
run systemctl restart "${SERVICE_NAME}"

echo "[install] litesoup-agent installed and started."
systemctl status "${SERVICE_NAME}" --no-pager
