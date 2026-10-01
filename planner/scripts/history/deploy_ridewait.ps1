$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$app = 'C:\StreamerBot\ctpg-planner'
"md5 app new: " + (Get-FileHash "$app\src\App.ridewait-new.jsx" -Algorithm MD5).Hash
Copy-Item "$app\src\App.jsx" "$app\src\App.jsx.bak-$stamp"
Move-Item -Force "$app\src\App.ridewait-new.jsx" "$app\src\App.jsx"
Set-Location $app
$env:CLOUDFLARE_ACCOUNT_ID = '<CLOUDFLARE_ACCOUNT_ID>'
npx vite build 2>&1 | Select-String 'built in|error' | % { $_.Line }
npx wrangler deploy 2>&1 | Select-String -Pattern 'Deployed|error|Current Version' | % { $_.Line }
# render the ride + wait card in the Ticket look
$e = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$d = @{ now = 'x'; nowParts = @{ cat = 'ride'; label = 'On a ride'; title = 'Haunted Mansion'; sub = 'Magic Kingdom'; wait = 13 }; park = 'Magic Kingdom'; tz = 'America/New_York'; next = $null; shows = @() } | ConvertTo-Json -Compress -Depth 5
$u = "file:///C:/StreamerBot/ctpg-pack/overlay.html?planner=1&look=ticket&previewbg=lab/offline-dca-wide.jpg&mock=" + [uri]::EscapeDataString($d)
& $e --headless=new --disable-gpu --allow-file-access-from-files --user-data-dir="$env:TEMP\edgerw" --virtual-time-budget=8000 --window-size=1920,1080 --screenshot="C:\StreamerBot\ctpg-pack\lab\ride-wait.png" $u 2>$null
Start-Sleep 2; "shot"
