# PowerShell migration script for Supabase
param(
    [string]$SupabaseDbUrl = $env:SUPABASE_DB_URL
)

if (-not $SupabaseDbUrl) {
    Write-Error "SUPABASE_DB_URL is not set. Set environment variable and re-run the script. Example: `$env:SUPABASE_DB_URL='postgres://user:pass@host:5432/postgres'`"
    exit 1
}

Write-Host "Applying migrations from supabase/migrations using SUPABASE_DB_URL"
Get-ChildItem -Path "supabase/migrations" -Filter "*.sql" | ForEach-Object {
    $file = $_.FullName
    Write-Host "-- Applying $file"
    psql $SupabaseDbUrl -f $file
}

Write-Host "Migrations applied."
