# Creates NyumbaSearch Play Store release keystore (run once).
# Usage: powershell -ExecutionPolicy Bypass -File android/scripts/create-release-keystore.ps1

$ErrorActionPreference = "Stop"

$keystorePath = "C:\secure\nyumbasearch-release.keystore"
$alias = "nyumbasearch"

if (Test-Path $keystorePath) {
  Write-Host "Keystore already exists: $keystorePath" -ForegroundColor Yellow
  $overwrite = Read-Host "Overwrite? This cannot be undone if you already published the app (y/N)"
  if ($overwrite -notmatch '^[yY]') {
    Write-Host "Aborted."
    exit 0
  }
  Remove-Item $keystorePath -Force
}

$secureDir = Split-Path $keystorePath -Parent
if (-not (Test-Path $secureDir)) {
  New-Item -ItemType Directory -Path $secureDir -Force | Out-Null
}

function Read-PasswordTwice {
  param([string]$Prompt)
  while ($true) {
    $a = Read-Host "$Prompt" -AsSecureString
    $b = Read-Host "Confirm password" -AsSecureString
    $plainA = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
      [Runtime.InteropServices.Marshal]::SecureStringToBSTR($a)
    )
    $plainB = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
      [Runtime.InteropServices.Marshal]::SecureStringToBSTR($b)
    )
    if ($plainA -eq $plainB -and $plainA.Length -ge 6) {
      return $plainA
    }
    Write-Host "Passwords must match and be at least 6 characters. Try again." -ForegroundColor Red
  }
}

Write-Host "`nNyumbaSearch release keystore" -ForegroundColor Cyan
Write-Host "Store this file and passwords in a password manager.`n"

$storePass = Read-PasswordTwice "Keystore password"
$keyPass = Read-Host "Key password (Enter to use same as keystore)" -AsSecureString
$keyPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($keyPass)
)
if ([string]::IsNullOrWhiteSpace($keyPassPlain)) {
  $keyPassPlain = $storePass
}

$cn = Read-Host "Your name or company [NyumbaSearch]"
if ([string]::IsNullOrWhiteSpace($cn)) { $cn = "NyumbaSearch" }

$org = Read-Host "Organization [NyumbaSearch]"
if ([string]::IsNullOrWhiteSpace($org)) { $org = "NyumbaSearch" }

$dname = "CN=$cn, OU=Mobile, O=$org, L=Nairobi, ST=Nairobi, C=KE"

& keytool -genkey -v `
  -keystore $keystorePath `
  -alias $alias `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -storepass $storePass `
  -keypass $keyPassPlain `
  -dname $dname

Write-Host "`nKeystore created: $keystorePath" -ForegroundColor Green
Write-Host "Alias: $alias`n"

Write-Host "SHA-256 fingerprint (for assetlinks.json):" -ForegroundColor Cyan
& keytool -list -v -keystore $keystorePath -alias $alias -storepass $storePass | Select-String "SHA256"

Write-Host "`nSet these for Gradle builds:" -ForegroundColor Cyan
Write-Host '$env:NYUMBA_KEYSTORE_PATH = "' + $keystorePath + '"'
Write-Host '$env:NYUMBA_KEYSTORE_PASSWORD = "<your-keystore-password>"'
Write-Host '$env:NYUMBA_KEY_ALIAS = "' + $alias + '"'
Write-Host '$env:NYUMBA_KEY_PASSWORD = "<your-key-password>"'
