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

# A password is read as SecureString and supplied only through the process environment.
# It is never placed in a command-line argument or written to a file.
$securePassword = Read-Host "Senha PostgreSQL do projecto Supabase" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try { $dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
if ([string]::IsNullOrWhiteSpace($dbPassword)) { throw "A senha PostgreSQL não pode estar vazia." }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $OutputRoot "$ProjectRef-$stamp"
$cliWorkDir = Join-Path $env:TEMP "agrilink-supabase-backup-cli-$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
New-Item -ItemType Directory -Path $cliWorkDir -Force | Out-Null

$previousLocation = Get-Location
$locationPushed = $false
try {
  $env:SUPABASE_DB_PASSWORD = $dbPassword
  $dbPassword = $null

  Push-Location $cliWorkDir
  $locationPushed = $true
  & supabase init 2>&1 | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível inicializar o contexto temporário do Supabase CLI." }

  & supabase link --project-ref $ProjectRef 2>&1 | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível ligar o CLI ao projecto $ProjectRef. Confirma primeiro a sessão com 'supabase login'." }

  $linkedRefFile = Join-Path $cliWorkDir "supabase\.temp\project-ref"
  if (!(Test-Path -LiteralPath $linkedRefFile)) { throw "O CLI não confirmou o projecto ligado." }
  $linkedRef = (Get-Content -LiteralPath $linkedRefFile -Raw).Trim()
  if ($linkedRef -ne $ProjectRef) { throw "O projecto ligado ($linkedRef) não corresponde ao projecto esperado ($ProjectRef)." }

  $rolesFile = Join-Path $backupDir "roles.sql"
  $schemaFile = Join-Path $backupDir "schema.sql"
  $dataFile = Join-Path $backupDir "data.sql"
  $ledgerFile = Join-Path $backupDir "migrations-ledger.txt"

  Invoke-SupabaseDump -Arguments @("db","dump","--remote","-f",$rolesFile,"--role-only") -OutputFile $rolesFile
  Invoke-SupabaseDump -Arguments @("db","dump","--remote","-f",$schemaFile) -OutputFile $schemaFile
  Invoke-SupabaseDump -Arguments @("db","dump","--remote","-f",$dataFile,"--use-copy","--data-only") -OutputFile $dataFile

  Write-Host "A recuperar os ficheiros SQL do histórico remoto ..."
  $fetchOutput = & supabase migration fetch --remote 2>&1
  if ($LASTEXITCODE -ne 0) {
    $safeFetchOutput = ($fetchOutput | Out-String) -replace '(?i)(postgres(?:ql)?://)[^@\s]+@', '$1[REDACTED]@'
    throw ("Falha ao recuperar os ficheiros SQL do histórico remoto. " + $safeFetchOutput)
  }
  $remoteMigrationDir = Join-Path $cliWorkDir "supabase\migrations"
  $remoteMigrationFiles = @(Get-ChildItem -LiteralPath $remoteMigrationDir -Filter "*.sql" -File -ErrorAction SilentlyContinue)
  if ($remoteMigrationFiles.Count -eq 0) { throw "O CLI não devolveu ficheiros SQL do histórico remoto." }
  $migrationsArchive = Join-Path $backupDir "remote-migrations.zip"
  Compress-Archive -Path (Join-Path $remoteMigrationDir "*.sql") -DestinationPath $migrationsArchive -CompressionLevel Optimal

  Write-Host "A preservar o histórico remoto de migrations ..."
  $ledgerOutput = & supabase migration list --remote 2>&1
  if ($LASTEXITCODE -ne 0) {
    $safeLedgerOutput = ($ledgerOutput | Out-String) -replace '(?i)(postgres(?:ql)?://)[^@\s]+@', '$1[REDACTED]@'
    throw ("Falha ao exportar o histórico remoto de migrations. " + $safeLedgerOutput)
  }
  $ledgerOutput | Set-Content -LiteralPath $ledgerFile -Encoding UTF8
  if (!(Test-Path -LiteralPath $ledgerFile) -or (Get-Item -LiteralPath $ledgerFile).Length -eq 0) {
    throw "O histórico remoto de migrations não foi guardado."
  }

  $files = @($rolesFile,$schemaFile,$dataFile,$ledgerFile,$migrationsArchive) | ForEach-Object {
    $item = Get-Item -LiteralPath $_
    [pscustomobject]@{ file=$item.Name; bytes=$item.Length; sha256=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash }
  }
  $manifest = [ordered]@{
    backup_created_utc=(Get-Date).ToUniversalTime().ToString("o")
    project_ref=$ProjectRef
    postgres_version="17.6.1"
    remote_migration_file_count=$remoteMigrationFiles.Count
    backup_method="Supabase CLI db dump --remote"
    files=$files
    important_scope_limitations=@(
      "Schemas geridos auth e storage são excluídos pelo dump CLI.",
      "Binários dos objectos Storage não estão incluídos.",
      "Isto é um dump lógico de schemas/dados da aplicação e roles, não um snapshot físico integral do projecto.",
      "O ficheiro migrations-ledger.txt preserva os timestamps remotos; os corpos SQL das migrations recuperadas permanecem na branch de auditoria."
    )
  }
  $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $backupDir "manifest.json") -Encoding UTF8

  Write-Host ""
  Write-Host "BACKUP LOGICO CONCLUIDO" -ForegroundColor Green
  Write-Host "Pasta: $backupDir"
  $files | Format-Table -AutoSize
  Write-Host "Não publiques estes SQL no GitHub nem os envies para terceiros."
} finally {
  if ($locationPushed) { Pop-Location -ErrorAction SilentlyContinue }
  if (Get-Command supabase -ErrorAction SilentlyContinue) {
    Push-Location $cliWorkDir -ErrorAction SilentlyContinue
    & supabase unlink *> $null
    Pop-Location -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath $cliWorkDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item Env:\SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
  $dbPassword = $null
  $securePassword = $null
  Set-Location $previousLocation
}
