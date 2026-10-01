# Step 1 of connecting OBS to the planner: swap in new files, write the local key file, redeploy the Worker.
$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$pack = 'C:\StreamerBot\ctpg-pack'; $app = 'C:\StreamerBot\ctpg-planner'
"md5 overlay new : " + (Get-FileHash "$pack\overlay.planner-new.html" -Algorithm MD5).Hash
"md5 worker new  : " + (Get-FileHash "$app\worker\index.new.js" -Algorithm MD5).Hash
Copy-Item "$pack\overlay.html" "$pack\overlay.html.bak-planner-$stamp"
Copy-Item "$app\worker\index.js" "$app\worker\index.js.bak-$stamp"
Move-Item -Force "$pack\overlay.planner-new.html" "$pack\overlay.html"
Move-Item -Force "$app\worker\index.new.js" "$app\worker\index.js"
# local key file for the overlay (read-only key). Never printed.
$k = (Get-Content "$app\.keys.json" | ConvertFrom-Json).OVERLAY_KEY
$js = "// Private: read-only key the OBS overlay uses to read the Park Day planner. Do not share.`nwindow.CTPG_PLANNER = { url: 'https://planner.cruiseandthemeparkguide.com', key: '$k' };`n"
[IO.File]::WriteAllText("$pack\planner_key.js", $js)
"planner_key.js written (not shown)"
Set-Location $app
$env:CLOUDFLARE_ACCOUNT_ID = '<CLOUDFLARE_ACCOUNT_ID>'
npx wrangler deploy 2>&1 | Select-String -Pattern 'Deployed|Uploaded|error|Current Version' | ForEach-Object { $_.Line }
