Write-Host "Este script define secrets do Supabase via supabase CLI. Certifique-se de estar logado com 'supabase login'."

$SUPABASE_URL = Read-Host "SUPABASE_URL (https://...):"
$SERVICE_ROLE = Read-Host "SUPABASE_SERVICE_ROLE_KEY:"
$RESEND_API_KEY = Read-Host "RESEND_API_KEY:"
$RESEND_FROM = Read-Host "RESEND_FROM (opcional):"

Write-Host "Definindo secrets..."
supabase secrets set SUPABASE_URL="$SUPABASE_URL"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE"
supabase secrets set RESEND_API_KEY="$RESEND_API_KEY"
if ($RESEND_FROM -ne "") {
  supabase secrets set RESEND_FROM="$RESEND_FROM"
}

Write-Host "Concluído. Verifique com: supabase secrets list"
