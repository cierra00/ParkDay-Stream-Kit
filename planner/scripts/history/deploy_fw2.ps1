$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$pack = 'C:\StreamerBot\ctpg-pack'; $app = 'C:\StreamerBot\ctpg-planner'
"md5 live overlay: " + (Get-FileHash "$pack\overlay.html" -Algorithm MD5).Hash
"md5 app         : " + (Get-FileHash "$app\src\App.jsx" -Algorithm MD5).Hash
"md5 css new     : " + (Get-FileHash "$app\src\styles.fw-new.css" -Algorithm MD5).Hash
Copy-Item "$app\src\styles.css" "$app\src\styles.css.bak-$stamp"
Move-Item -Force "$app\src\styles.fw-new.css" "$app\src\styles.css"
Set-Location $app
$env:CLOUDFLARE_ACCOUNT_ID = '<CLOUDFLARE_ACCOUNT_ID>'
npx vite build 2>&1 | Select-String 'built in|error' | % { $_.Line }
npx wrangler deploy 2>&1 | Select-String -Pattern 'Deployed|error|Current Version' | % { $_.Line }
$e = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
foreach ($v in @('', '&layout=vertical')) {
  $d = @{ now = 'x'; nowParts = @{ cat = 'fireworks'; label = 'Fireworks'; title = 'Not-So-Spooky Spectacular'; sub = 'Magic Kingdom' }; park = 'Magic Kingdom'; tz = 'America/New_York'; next = $null; shows = @() } | ConvertTo-Json -Compress -Depth 5
  $bg = if ($v) { 'offline-dca-tall.jpg' } else { 'offline-dca-wide.jpg' }
  $size = if ($v) { '1080,1920' } else { '1920,1080' }
  $n = if ($v) { 'v' } else { 'h' }
  $u = "file:///C:/StreamerBot/ctpg-pack/lab/overlay.html?planner=1&look=ticket$v&previewbg=$bg&mock=" + [uri]::EscapeDataString($d)
  & $e --headless=new --disable-gpu --allow-file-access-from-files --user-data-dir="$env:TEMP\edgefw3" --virtual-time-budget=8000 --window-size=$size --screenshot="$pack\lab\fw2-$n.png" $u 2>$null
  Start-Sleep 2; "shot $n"
}
