# Creates the private overlay and Streamer.bot keys, saves them on this PC only, and sends them to Cloudflare as secrets.
# Values are never printed.
$ErrorActionPreference = 'Stop'
Set-Location C:\StreamerBot\ctpg-planner
$env:CLOUDFLARE_ACCOUNT_ID = '<CLOUDFLARE_ACCOUNT_ID>'
function NewKey { $b = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ([Convert]::ToBase64String($b)).Replace('+','-').Replace('/','_').TrimEnd('=') }
$keysFile = 'C:\StreamerBot\ctpg-planner\.keys.json'
if (Test-Path $keysFile) { $k = Get-Content $keysFile -Raw | ConvertFrom-Json } else { $k = [pscustomobject]@{ OVERLAY_KEY = NewKey; BOT_KEY = NewKey }; $k | ConvertTo-Json | Set-Content $keysFile -Encoding utf8 }
foreach ($name in 'OVERLAY_KEY','BOT_KEY') {
  $k.$name | npx wrangler secret put $name 2>&1 | Select-String -Pattern 'Success|error|ERROR' | ForEach-Object { "$name : " + $_.Line.Trim() }
}
if ((Get-Content .gitignore) -notcontains '.keys.json') { Add-Content .gitignore '.keys.json' }
"keys saved in $keysFile (not shown)"
