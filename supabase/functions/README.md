# Edge Functions — configuração de env vars

Esses scripts e instruções ajudam a definir as variáveis de ambiente necessárias para as Edge Functions do Supabase (por exemplo `send-magic-link`).

Variáveis necessárias (mínimo):

- `SUPABASE_URL` — URL do projeto Supabase (ex.: `https://<project>.supabase.co`).
- `SUPABASE_SERVICE_ROLE_KEY` — *Service Role* key (privilegiada) usada pelas funções.
- `RESEND_API_KEY` — chave da API do Resend (para envio de e-mails).
- `RESEND_FROM` — remetente preferencial (opcional, ex.: `AgriLink <no-reply@agrilink.ao>`).

Pré-requisitos:

- `supabase` CLI instalado e autenticado (`supabase login`).
- Ter permissões para modificar secrets no projeto Supabase.

Comandos úteis (exemplos):

1) Listar secrets atuais

```bash
supabase secrets list
```

2) Definir um secret (ex.):

```bash
supabase secrets set RESEND_API_KEY="sk_live_..."
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
supabase secrets set SUPABASE_URL="https://<project>.supabase.co"
```

3) Remover um secret

```bash
supabase secrets unset RESEND_API_KEY
```

Testar uma função localmente (desde que o `supabase functions serve` esteja disponível):

```bash
# serve todas as functions (vai ler secrets do projeto atual)
supabase functions serve

# ou apenas uma
supabase functions serve send-magic-link
```

Enviar um POST de teste (exemplo para `send-magic-link`):

```bash
curl -X POST http://localhost:54321/functions/v1/send-magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@exemplo.com"}'
```

Scripts auxiliares estão incluídos: `setup_env.sh` (Linux/macOS/WSL) e `setup_env.ps1` (PowerShell). Eles apenas chamam `supabase secrets set` — não fazem alterações remotas sem que você confirme os valores.

CI / GitHub Actions
-------------------

Existe um workflow de GitHub Actions que automatiza o deploy das Edge Functions em pushes para `main` e em execuções manuais: [`.github/workflows/deploy-supabase-functions.yml`](.github/workflows/deploy-supabase-functions.yml).

Secrets necessários no repositório (Settings → Secrets → Actions):

- `SUPABASE_ACCESS_TOKEN` — token do supabase CLI com permissões para deploy (use `supabase login` para gerar/obter este token conforme as instruções do Supabase).
- `SUPABASE_PROJECT_REF` — referência do projeto (project ref) usada pelo supabase CLI (ex.: `oqcrfqtlfqwrxxmsjpaf`).

Observação: esse workflow apenas executa `supabase functions deploy` — os secrets de runtime (por ex. `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) devem ser configurados no painel do Supabase (Project → Settings → Environment → Secrets) usando os scripts `setup_env.*` ou manualmente.
