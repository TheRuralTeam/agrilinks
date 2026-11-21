# Backup lógico da base de dados AgriLink

## Objectivo
Criar uma cópia lógica local antes de qualquer reconciliação do histórico de migrations. O script não executa DDL, não aplica migrations e não altera dados no Supabase.

## Pré-requisitos
- PowerShell 7 ou Windows PowerShell 5.1
- Supabase CLI instalada e autenticada (supabase login)
- Docker Desktop instalado e em execução
- Senha PostgreSQL do projecto AgriLink, obtida no Supabase Dashboard em **Connect** (não é a anon key nem a service-role key)

## Execução
A partir da raiz do repositório:

    Set-ExecutionPolicy -Scope Process Bypass
    .\scripts\backup-supabase-before-migration-reconciliation.ps1

O script pede a senha PostgreSQL por entrada mascarada, usa SUPABASE_DB_PASSWORD apenas no ambiente do processo (não na linha de comandos), cria um contexto CLI temporário fora do repositório, confirma o project ref ligado, exporta roles, schema, dados, os ficheiros SQL recuperados do histórico remoto e a lista de versões aplicadas; valida os ficheiros e calcula SHA-256. O contexto temporário e a variável de ambiente são removidos no fim.

Se o CLI ainda não estiver autenticado, executa supabase login e repete o script. Nunca coloques a senha PostgreSQL, connection string ou access token no GitHub ou neste chat.

## Limites importantes
A CLI oficial exclui schemas geridos pelo Supabase, incluindo auth e storage, e não exporta os binários dos objectos Storage. Portanto, este backup protege a estrutura e os dados das schemas de aplicação abrangidas pelo dump, mas **não é um backup integral do projecto Supabase**. O ficheiro migrations-ledger.txt preserva os timestamps remotos e remote-migrations.zip contém os ficheiros SQL recuperados por migration fetch. Estes ficheiros são uma cópia de segurança; não os uses para reparar ou alterar o ledger automaticamente.

Não executar restauração automaticamente. Não carregar os ficheiros SQL para GitHub, porque podem conter dados operacionais e pessoais. Partilha apenas o manifest.json e os SHA-256 para verificarmos a integridade; não envies os dumps SQL.

Documentação oficial:
- https://supabase.com/docs/reference/cli/global-flags
- https://supabase.com/docs/reference/cli/supabase-db-dump
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
