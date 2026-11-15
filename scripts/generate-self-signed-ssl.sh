#!/usr/bin/env bash
# =============================================================================
# Generate Self-Signed SSL/TLS Certificates for Local/Testing HTTPS
# =============================================================================

set -euo pipefail

SSL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../nginx/ssl" && pwd)"
mkdir -p "$SSL_DIR"

IP_OR_DOMAIN="${1:-127.0.0.1}"

echo "============================================================================="
echo "Generating Self-Signed SSL/TLS Certificate for: $IP_OR_DOMAIN"
echo "Target Directory: $SSL_DIR"
echo "============================================================================="

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$SSL_DIR/server.key" \
  -out "$SSL_DIR/server.crt" \
  -subj "/C=US/ST=Cloud/L=DevOps/O=EcommercePlatform/CN=$IP_OR_DOMAIN" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$IP_OR_DOMAIN" 2>/dev/null || \
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$SSL_DIR/server.key" \
  -out "$SSL_DIR/server.crt" \
  -subj "/C=US/ST=Cloud/L=DevOps/O=EcommercePlatform/CN=$IP_OR_DOMAIN"

chmod 600 "$SSL_DIR/server.key"
chmod 644 "$SSL_DIR/server.crt"

echo "[SUCCESS] Self-signed certificates successfully created."
echo "  Certificate: $SSL_DIR/server.crt"
echo "  Private Key: $SSL_DIR/server.key"
echo "============================================================================="
