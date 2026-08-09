# setup-leaderboard-key.ps1
# One-shot helper: generates a write key, tells you exactly what to paste into
# Vercel, and creates/updates the local .env so the game can submit scores.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-leaderboard-key.ps1
#
# What it does:
#   1. Reads an existing .env key if present; otherwise generates a random
#      64-char alphanumeric key (cryptographically random).
#   2. Prints the Vercel WRITE_KEYS JSON to paste (bullet-hell entry added).
#   3. Writes .env with VITE_LEADERBOARD_API + VITE_LEADERBOARD_WRITE_KEY.
#   4. Never prints or stores the keys of other games; only bullet-hell.
#
# NOTE: the Vercel edit itself must be done in the dashboard (this machine has
# no Vercel CLI/auth). Steps are printed at the end.

$ErrorActionPreference = 'Stop'

function New-RandomKey([int]$length = 64) {
  $alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  $bytes = New-Object byte[] $length
  # Portable across Windows PowerShell 5.1 and PowerShell 7:
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $sb = [System.Text.StringBuilder]::new($length)
  foreach ($b in $bytes) { [void]$sb.Append($alphabet[$b % $alphabet.Length]) }
  $sb.ToString()
}

# Reuse an existing .env key if present (idempotent: re-running must not
# produce a DIFFERENT key than the one already pasted into Vercel).
$envPath = Join-Path (Split-Path $PSScriptRoot -Parent) '.env'
$api = 'https://leaderboards-opal.vercel.app'
$key = $null
if (Test-Path $envPath) {
  $old = Get-Content $envPath -Raw
  if ($old -match 'VITE_LEADERBOARD_WRITE_KEY=(.+)') { $key = $Matches[1].Trim() }
}
if (-not $key) { $key = New-RandomKey }

Write-Host ''
Write-Host '=== STEP 1: Vercel dashboard (leaderboards project) ===' -ForegroundColor Cyan
Write-Host 'Settings -> Environment Variables -> WRITE_KEYS -> edit (Production + Preview).'
Write-Host 'Add a bullet-hell entry to the JSON, e.g.:' -ForegroundColor Yellow
Write-Host ''
Write-Host ('  {{"gigazonk":"<existing>","calamari-damacy":"<existing>","tower-of-power":"<existing>","bullet-hell":"{0}"}}' -f $key)
Write-Host ''
Write-Host 'Keep the existing keys for other games EXACTLY as they are; only append the bullet-hell entry.'
Write-Host 'Save -> redeploy (or Vercel auto-redeploys on env change).'
Write-Host ''

Write-Host '=== STEP 2: local .env (done automatically below) ===' -ForegroundColor Cyan
$content = @"
# Global leaderboard (pfaustino/leaderboards API)
VITE_LEADERBOARD_API=$api
VITE_LEADERBOARD_WRITE_KEY=$key
"@
Set-Content -Path $envPath -Value $content -Encoding utf8
Write-Host "Wrote $envPath (VITE_LEADERBOARD_WRITE_KEY=$key)" -ForegroundColor Green

Write-Host ''
Write-Host '=== STEP 3: verify after deploy ===' -ForegroundColor Cyan
Write-Host 'Run:  npm run verify:leaderboard'
Write-Host 'It submits ONE test row (player "key-verify-test", wave 1) and prints PASS/FAIL.'
Write-Host 'Note: there is no delete endpoint, so the test row stays on the board unless'
Write-Host 'you remove it yourself from the Turso DB. It is harmless wave-1 test data.'
Write-Host ''