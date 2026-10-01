$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$pack = 'C:\StreamerBot\ctpg-pack'; $app = 'C:\StreamerBot\ctpg-planner'
"md5 overlay: " + (Get-FileHash "$pack\lab\overlay.html" -Algorithm MD5).Hash
"md5 app    : " + (Get-FileHash "$app\src\App.fw-new.jsx" -Algorithm MD5).Hash
Copy-Item "$pack\overlay.html" "$pack\overlay.html.bak-fw-$stamp"
Copy-Item "$pack\lab\overlay.html" "$pack\overlay.html" -Force
Copy-Item "$app\src\App.jsx" "$app\src\App.jsx.bak-$stamp"
Move-Item -Force "$app\src\App.fw-new.jsx" "$app\src\App.jsx"
Set-Location $app
$env:CLOUDFLARE_ACCOUNT_ID = '<CLOUDFLARE_ACCOUNT_ID>'
npx vite build 2>&1 | Select-String 'built in|error' | % { $_.Line }
npx wrangler deploy 2>&1 | Select-String -Pattern 'Deployed|error|Current Version' | % { $_.Line }
# render a fireworks + parade card in the Ticket look
$e = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
foreach ($c in @(@('fireworks','Fireworks','Not-So-Spooky Spectacular'), @('parade','Parade','Festival of Fantasy Parade'))) {
  $d = @{ now = $c[2]; nowParts = @{ cat = $c[0]; label = $c[1]; title = $c[2]; sub = 'Magic Kingdom' }; park = 'Magic Kingdom'; tz = 'America/New_York'; next = $null; shows = @() } | ConvertTo-Json -Compress -Depth 5
  $u = "file:///C:/StreamerBot/ctpg-pack/lab/overlay.html?planner=1&look=ticket&previewbg=offline-dca-wide.jpg&mock=" + [uri]::EscapeDataString($d)
  & $e --headless=new --disable-gpu --allow-file-access-from-files --user-data-dir="$env:TEMP\edgefw" --virtual-time-budget=6000 --window-size=1920,1080 --screenshot="$pack\lab\fw-$($c[0]).png" $u 2>$null
  Start-Sleep 2; "shot $($c[0])"
}
