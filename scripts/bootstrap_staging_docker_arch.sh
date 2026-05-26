#!/usr/bin/env bash
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_ROOT="${APP_ROOT:-/opt/studyforge-staging}"
SSH_PUBLIC_KEY="${SSH_PUBLIC_KEY:-}"

if ! command -v pacman >/dev/null 2>&1; then
    echo "This bootstrap script is for Arch Linux servers with pacman." >&2
    exit 1
fi

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    SUDO="sudo"
fi

$SUDO pacman -Syu --noconfirm
$SUDO pacman -S --needed --noconfirm docker docker-compose openssh curl vim

$SUDO systemctl enable --now docker
$SUDO systemctl enable --now sshd

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
    $SUDO useradd -m -s /bin/bash "$DEPLOY_USER"
fi

$SUDO usermod -aG docker "$DEPLOY_USER"

$SUDO mkdir -p "$APP_ROOT"
$SUDO chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "$APP_ROOT"

if [ -n "$SSH_PUBLIC_KEY" ]; then
    $SUDO install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/${DEPLOY_USER}/.ssh"
    printf '%s\n' "$SSH_PUBLIC_KEY" | $SUDO tee "/home/${DEPLOY_USER}/.ssh/authorized_keys" >/dev/null
    $SUDO chown "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh/authorized_keys"
    $SUDO chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"
fi

docker --version
docker compose version

cat <<EOF
Arch Docker bootstrap finished.

Next:
1. Log out and log back in as ${DEPLOY_USER}, or reconnect SSH, so docker group membership takes effect.
2. Confirm: ssh ${DEPLOY_USER}@SERVER_IP "docker ps"
3. Open TCP 7897 in the cloud security group.
EOF
