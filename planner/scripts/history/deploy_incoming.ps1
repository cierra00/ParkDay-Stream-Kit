# Deploys whatever is in .\incoming (App.jsx, styles.css, concerts.js -> src; overlay.html -> ctpg-pack). Backs up first, checks md5s.
param([hashtable]$Expect = @{})
$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$app = 'C:\StreamerBot\ctpg-planner'; $pack = 'C:\StreamerBot\ctpg-pack'; $in = "$app\incoming"
$map = @{ 'App.jsx' = "$app\src\App.jsx"; 'styles.css' = "$app\src\styles.css"; 'concerts.js' = "$app\src\concerts.js"; 'parks.js' = "$app\src\parks.js"; 'api.js' = "$app\src\api.js"; 'main.jsx' = "$app\src\main.jsx"; 'vite.config.js' = "$app\vite.config.js"; 'sw.js' = "$app\public\sw.js"; 'index.js' = "$app\worker\index.js"; 'overlay.html' = "$pack\overlay.html" }
foreach ($f in Get-ChildItem $in -File) {
  $dest = $map[$f.Name]; if (-not $dest) { "skip $($f.Name)"; continue }
  "{0,-13} md5 {1}" -f $f.Name, (Get-FileHash $f.FullName -Algorithm MD5).Hash
  if (Test-Path $dest) { Copy-Item $dest "$dest.bak-$stamp" }
  Move-Item -Force $f.FullName $dest
  if ($f.Name -eq 'overlay.html') { Copy-Item $dest "$pack\lab\overlay.html" -Force }
}
Set-Location $app
$env:CLOUDFLARE_ACCOUNT_ID = '<CLOUDFLARE_ACCOUNT_ID>'
$b = npx vite build 2>&1 | Out-String; if ($LASTEXITCODE -ne 0 -or $b -notmatch 'built in') { $b.Split("`n") | Select-String 'error|Unexpected|failed' | Select-Object -First 5 | % { $_.Line }; throw 'BUILD FAILED: nothing was deployed' }; 'build ok'
npx wrangler deploy 2>&1 | Select-String -Pattern 'Deployed|error|Current Version' | % { $_.Line }
