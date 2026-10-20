#!/bin/sh
# Creates a self-signed certificate for localhost on first start, unless one
# was provided in ./certs (mounted at /etc/nginx/certs).
set -e

CERT_DIR=/etc/nginx/certs
CRT="$CERT_DIR/server-cert.crt"
KEY="$CERT_DIR/server-cert.key"

if [ -s "$CRT" ] && [ -s "$KEY" ]; then
  exit 0
fi

echo "generate-cert: creating a self-signed certificate for localhost"
mkdir -p "$CERT_DIR"
openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout "$KEY" -out "$CRT" \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null
chmod 600 "$KEY"
