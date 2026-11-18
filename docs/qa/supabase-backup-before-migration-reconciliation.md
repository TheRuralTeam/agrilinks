# Backup lógico da base de dados AgriLink

## Objectivo
Criar uma cópia lógica local antes de qualquer reconciliação do histórico de migrations.

## Pré-requisitos
- PowerShell 7 ou Windows PowerShell 5.1
- Supabase CLI instalada
- Docker Desktop instalado e em execução
- Connection string PostgreSQL do projecto AgriLink, obtida no Dashboard em **Connect** (preferir Session pooler)

## Execução
A partir da raiz do repositório:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\backup-supabase-before-migration-reconciliation.ps1
```

O script pede a connection string por entrada mascarada, cria uma pasta em `Documents\AgriLink-Supabase-Backups`, exporta roles, schema e dados, valida que os três ficheiros não estão vazios e calcula SHA-256.

## Limites importantes
A CLI oficial exclui schemas geridos pelo Supabase, incluindo `auth` e `storage`, e não exporta os binários dos objectos Storage. Portanto, este backup protege a estrutura e os dados das schemas de aplicação abrangidas pelo dump, mas **não é um backup integral do projecto Supabase**. O histórico `supabase_migrations.schema_migrations` também deve ser preservado separadamente.

Não executar restauração automaticamente. Não carregar os ficheiros SQL para GitHub, porque podem conter dados operacionais e pessoais.

Documentação oficial:
- https://supabase.com/docs/reference/cli/supabase-db-dump
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
