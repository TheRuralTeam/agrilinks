[CmdletBinding()]
param(
  [string]$ProjectRef = "oqcrfqtlfqwrxxmsjpaf",
  [string]$OutputRoot = (Join-Path $env:USERPROFILE "Documents\AgriLink-Supabase-Backups")
)
$ErrorActionPreference = "Stop"

function Invoke-SupabaseDump {
  param([string[]]$Arguments, [string]$OutputFile)
  Write-Host "A exportar $OutputFile ..."
  $output = & supabase @Arguments 2>&1
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    $safeOutput = ($output | Out-String) -replace '(?i)(postgres(?:ql)?://)[^@\s]+@', '$1[REDACTED]@'
    throw ("Falha no dump ($OutputFile), código $exitCode. " + $safeOutput)
  }
  if (!(Test-Path -LiteralPath $OutputFile) -or (Get-Item -LiteralPath $OutputFile).Length -eq 0) {
    throw "O dump $OutputFile não foi criado ou está vazio."
  }
}

if (!(Get-Command supabase -ErrorAction SilentlyContinue)) { throw "Supabase CLI não encontrado." }
if (!(Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker CLI não encontrado." }
& docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker Desktop não está iniciado." }

$secureUri = Read-Host "Cola a connection string PostgreSQL do Supabase (Session pooler recomendado)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUri)
try { $dbUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
if ($dbUrl -notmatch '^postgres(?:ql)?://') { $dbUrl = $null; throw "URI PostgreSQL inválida." }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $OutputRoot "$ProjectRef-$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
try {
  $rolesFile = Join-Path $backupDir "roles.sql"
  $schemaFile = Join-Path $backupDir "schema.sql"
  $dataFile = Join-Path $backupDir "data.sql"
  Invoke-SupabaseDump -Arguments @("db","dump","--db-url",$dbUrl,"-f",$rolesFile,"--role-only") -OutputFile $rolesFile
  Invoke-SupabaseDump -Arguments @("db","dump","--db-url",$dbUrl,"-f",$schemaFile) -OutputFile $schemaFile
  Invoke-SupabaseDump -Arguments @("db","dump","--db-url",$dbUrl,"-f",$dataFile,"--use-copy","--data-only","-x","storage.buckets_vectors","-x","storage.vector_indexes") -OutputFile $dataFile
  $files = @($rolesFile,$schemaFile,$dataFile) | ForEach-Object {
    $item = Get-Item -LiteralPath $_
    [pscustomobject]@{ file=$item.Name; bytes=$item.Length; sha256=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash }
  }
  $manifest = [ordered]@{
    backup_created_utc=(Get-Date).ToUniversalTime().ToString("o")
    project_ref=$ProjectRef
    postgres_version="17.6.1"
    backup_method="Supabase CLI db dump"
    files=$files
    important_scope_limitations=@(
      "Schemas geridos auth e storage são excluídos pelo dump CLI.",
      "Binários dos objectos Storage não estão incluídos.",
      "Isto é um dump lógico de schemas/dados da aplicação e roles, não um snapshot físico integral do projecto.",
      "O ledger remoto de migrations tem de ser preservado separadamente."
    )
  }
  $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $backupDir "manifest.json") -Encoding UTF8
  Write-Host ""
  Write-Host "BACKUP LOGICO CONCLUIDO" -ForegroundColor Green
  Write-Host "Pasta: $backupDir"
  $files | Format-Table -AutoSize
  Write-Host "Não publiques estes SQL no GitHub nem os envies para terceiros."
} finally { $dbUrl=$null; $secureUri=$null }
