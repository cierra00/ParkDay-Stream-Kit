$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$pack = 'C:\StreamerBot\ctpg-pack'; $app = 'C:\StreamerBot\ctpg-planner'
"md5 overlay: " + (Get-FileHash "$pack\overlay.fmt-new.html" -Algorithm MD5).Hash
"md5 app    : " + (Get-FileHash "$app\src\App.fmt-new.jsx" -Algorithm MD5).Hash
Copy-Item "$pack\overlay.html" "$pack\overlay.html.bak-format-$stamp"
Copy-Item "$app\src\App.jsx" "$app\src\App.jsx.bak-$stamp"
Move-Item -Force "$pack\overlay.fmt-new.html" "$pack\overlay.html"
Move-Item -Force "$app\src\App.fmt-new.jsx" "$app\src\App.jsx"
Set-Location $app
$env:CLOUDFLARE_ACCOUNT_ID = '<CLOUDFLARE_ACCOUNT_ID>'
npx vite build 2>&1 | Select-String 'built in|error' | % { $_.Line }
npx wrangler deploy 2>&1 | Select-String -Pattern 'Deployed|Uploaded|error|Current Version' | % { $_.Line }
tasklist /FI "IMAGENAME eq obs64.exe" /NH
