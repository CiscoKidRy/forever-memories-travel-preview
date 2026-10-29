#!/bin/bash
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
LIVE_BEFORE="$(sudo -n -u postgres psql -d forever_memories -tAc 'select count(*) from inquiries' | tr -d '[:space:]')"
echo "LIVE_COUNT_BEFORE=${LIVE_BEFORE}"
systemctl is-active forever-memories-inquiries forever-memories-staff cloudflared postgresql

if ! sudo -n -u postgres psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='forever_memories_preview'" | grep -q 1; then
  sudo -n -u postgres createdb forever_memories_preview
fi

sudo mkdir -p /opt/forever-memories-inquiries-preview
sudo cp -a "$SRC"/. /opt/forever-memories-inquiries-preview/
sudo rm -f /opt/forever-memories-inquiries-preview/install-preview.sh /opt/forever-memories-inquiries-preview/staff.token
sudo chown -R root:root /opt/forever-memories-inquiries-preview
sudo chmod -R a+rX /opt/forever-memories-inquiries-preview

sudo tee /etc/forever-memories-inquiries-preview.env >/dev/null <<'EOF'
DATABASE_URL=dbname=forever_memories_preview user=fmtinq host=/var/run/postgresql
BIND=127.0.0.1
PORT=8789
MAIL_DISABLED=1
EOF
sudo chmod 600 /etc/forever-memories-inquiries-preview.env
sudo chown root:root /etc/forever-memories-inquiries-preview.env

TOKEN="$(tr -d '\r\n' < "$SRC/staff.token")"
if [ "${#TOKEN}" -lt 32 ]; then
  echo "TOKEN_MISSING"
  exit 1
fi
sudo tee /etc/forever-memories-staff-preview.env >/dev/null <<EOF
STAFF_DATABASE_URL=dbname=forever_memories_preview user=fmtstaff host=/var/run/postgresql
BIND=127.0.0.1
PORT=8790
INQUIRY_STAFF_TOKEN=${TOKEN}
EOF
sudo chmod 600 /etc/forever-memories-staff-preview.env
sudo chown root:root /etc/forever-memories-staff-preview.env
unset TOKEN

sudo -n -u postgres psql -d forever_memories_preview -v ON_ERROR_STOP=1 -f /opt/forever-memories-inquiries-preview/schema.sql
sudo -n -u postgres psql -d forever_memories_preview -v ON_ERROR_STOP=1 -f /opt/forever-memories-inquiries-preview/staff-note-author.sql

sudo cp /opt/forever-memories-inquiries-preview/forever-memories-inquiries-preview.service /etc/systemd/system/
sudo cp /opt/forever-memories-inquiries-preview/forever-memories-staff-preview.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now forever-memories-inquiries-preview.service
sudo systemctl enable --now forever-memories-staff-preview.service

echo "PREVIEW_HEALTH=$(curl -fsS http://127.0.0.1:8789/health)"
echo "PREVIEW_STAFF=$(curl -sS -o /tmp/fmt-preview-staff-body.txt -w '%{http_code}' http://127.0.0.1:8790/staff/inquiries)"
echo "LIVE_HEALTH=$(curl -fsS http://127.0.0.1:8787/health)"
LIVE_AFTER="$(sudo -n -u postgres psql -d forever_memories -tAc 'select count(*) from inquiries' | tr -d '[:space:]')"
PREVIEW_COUNT="$(sudo -n -u postgres psql -d forever_memories_preview -tAc 'select count(*) from inquiries' | tr -d '[:space:]')"
echo "LIVE_COUNT_AFTER=${LIVE_AFTER}"
echo "PREVIEW_COUNT=${PREVIEW_COUNT}"
echo "LIVE_CONSTRAINT=$(sudo -n -u postgres psql -d forever_memories -tAc "select pg_get_constraintdef(oid) from pg_constraint where conname='inquiries_source_url'")"
echo "PREVIEW_CONSTRAINT=$(sudo -n -u postgres psql -d forever_memories_preview -tAc "select pg_get_constraintdef(oid) from pg_constraint where conname='inquiries_source_url'")"
echo "PORTS=$(ss -ltn | awk '/:8787|:8788|:8789|:8790/ {print $4}')"
if [ "$LIVE_BEFORE" != "$LIVE_AFTER" ]; then
  echo "LIVE_COUNT_CHANGED"
  exit 2
fi
