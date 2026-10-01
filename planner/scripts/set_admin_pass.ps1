# Sets the owner dashboard (/admin) login. You type it; it goes straight to Cloudflare as a secret and is never saved or shown.
$ErrorActionPreference = 'Stop'
Set-Location C:\StreamerBot\ctpg-planner
$env:CLOUDFLARE_ACCOUNT_ID = '<CLOUDFLARE_ACCOUNT_ID>'
$s = Read-Host "Choose the owner dashboard code (8+ characters, different from your planner passcode)" -AsSecureString
$p = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
if ($p.Length -lt 8) { "Too short, nothing changed."; Read-Host "Press Enter to close"; exit }
$p | npx wrangler secret put ADMIN_PASS 2>&1 | Select-String -Pattern 'Success|error|ERROR' | ForEach-Object { $_.Line.Trim() }
$p = $null
Read-Host "Done. Press Enter to close"
