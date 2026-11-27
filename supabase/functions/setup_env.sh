#!/usr/bin/env bash
set -euo pipefail

echo "Este script define secrets do Supabase via supabase CLI. Certifique-se de estar logado com 'supabase login'."

read -rp "SUPABASE_URL (https://...): " SUPABASE_URL
read -rp "SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_ROLE_KEY
read -rp "RESEND_API_KEY: " RESEND_API_KEY
read -rp "RESEND_FROM (opcional): " RESEND_FROM

echo "Definindo secrets..."
supabase secrets set SUPABASE_URL="$SUPABASE_URL"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
supabase secrets set RESEND_API_KEY="$RESEND_API_KEY"
if [ -n "$RESEND_FROM" ]; then
  supabase secrets set RESEND_FROM="$RESEND_FROM"
fi

echo "Concluído. Verifique com: supabase secrets list"
