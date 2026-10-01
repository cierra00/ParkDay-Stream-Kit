$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$pack = 'C:\StreamerBot\ctpg-pack'; $app = 'C:\StreamerBot\ctpg-planner'
"md5 lab overlay: " + (Get-FileHash "$pack\lab\overlay.html" -Algorithm MD5).Hash
"md5 app        : " + (Get-FileHash "$app\src\App.looks-new.jsx" -Algorithm MD5).Hash
# live overlay gets the same file (no look set in OBS yet, so the card keeps its current style with the fit fixes)
Copy-Item "$pack\overlay.html" "$pack\overlay.html.bak-looks-$stamp"
Copy-Item "$pack\lab\overlay.html" "$pack\overlay.html" -Force
Copy-Item "$app\src\App.jsx" "$app\src\App.jsx.bak-$stamp"
Move-Item -Force "$app\src\App.looks-new.jsx" "$app\src\App.jsx"
Set-Location $app
$env:CLOUDFLARE_ACCOUNT_ID = '<CLOUDFLARE_ACCOUNT_ID>'
npx vite build 2>&1 | Select-String 'built in|error' | % { $_.Line }
npx wrangler deploy 2>&1 | Select-String -Pattern 'Deployed|error|Current Version' | % { $_.Line }
Set-Location "$pack\lab"
foreach ($l in '', 'ticket', 'bar', 'sign') { $n = if ($l) { "$l-4" } else { 'classic-4' }; powershell -ExecutionPolicy Bypass -File .\shoot.ps1 -look $l -name $n | Out-Null; "shot $n" }
