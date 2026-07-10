# Starts local portable PostgreSQL 16 (used when Docker is not available).
# Binaries: C:\Users\user\erp-tools\pgsql  Data: C:\Users\user\erp-tools\pgdata
$PgBin = "C:\Users\user\erp-tools\pgsql\bin"
$PgData = "C:\Users\user\erp-tools\pgdata"
$PgLog = "C:\Users\user\erp-tools\pg.log"

if (-not (Test-Path "$PgBin\pg_ctl.exe")) {
  Write-Error "PostgreSQL binaries not found at $PgBin"
  exit 1
}

if (-not (Test-Path "$PgData\PG_VERSION")) {
  Write-Host "Initializing data directory..."
  $pwFile = Join-Path $env:TEMP "pgpw.txt"
  Set-Content -Path $pwFile -Value "postgres" -Encoding ascii
  & "$PgBin\initdb.exe" -D $PgData -U postgres --pwfile=$pwFile -A md5 -E UTF8 --locale=C | Out-Null
  Remove-Item $pwFile -Force
}

$status = & "$PgBin\pg_ctl.exe" status -D $PgData 2>$null
if ($LASTEXITCODE -ne 0) {
  & "$PgBin\pg_ctl.exe" start -D $PgData -l $PgLog -o "-p 5432"
  Start-Sleep -Seconds 2
} else {
  Write-Host "PostgreSQL is already running."
}

# Create erp database if missing
$env:PGPASSWORD = "postgres"
$exists = & "$PgBin\psql.exe" -U postgres -h localhost -p 5432 -tAc "SELECT 1 FROM pg_database WHERE datname='erp'"
if ($exists -ne "1") {
  & "$PgBin\createdb.exe" -U postgres -h localhost -p 5432 erp
  Write-Host "Database 'erp' created."
}
Write-Host "PostgreSQL ready on localhost:5432 (user=postgres, db=erp)."
