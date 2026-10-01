$ErrorActionPreference = 'Continue'
$pack = 'C:\StreamerBot\ctpg-pack'; $base = 'https://planner.cruiseandthemeparkguide.com'
$k = (Get-Content C:\StreamerBot\ctpg-planner\.keys.json -Raw | ConvertFrom-Json).OVERLAY_KEY

"== 1. Deployed app has the new code"
$html = (Invoke-WebRequest $base -UseBasicParsing).Content
$js = [regex]::Match($html, '/assets/index-[^"]+\.js').Value
$code = (Invoke-WebRequest "$base$js" -UseBasicParsing).Content
"  bundle: $js"
foreach ($p in 'MIN WAIT', 'Fireworks', 'Not-So', 'pv-wait', 'firework\|happily') { "  contains '$p': " + ($code -match [regex]::Escape($p).Replace('\\\|','|')) }

"== 2. What your phone last sent"
$s = Invoke-RestMethod "$base/api/state?key=$k"
"  saved at: " + ([DateTimeOffset]::FromUnixTimeMilliseconds($s.updated).LocalDateTime) + "  (now " + (Get-Date) + ")"
"  nowParts: " + ($s.display.nowParts | ConvertTo-Json -Compress)

"== 3. OBS sources"
$j = Get-Content "$env:APPDATA\obs-studio\basic\scenes\Moblin.json" -Raw | ConvertFrom-Json
$j.sources | ? { $_.name -like 'Now/Next (Planner)*' } | % { "  $($_.name) -> $($_.settings.url)" }
"  OBS running: " + [bool](Get-Process obs64 -ErrorAction SilentlyContinue)

"== 4. Live overlay file"
"  md5: " + (Get-FileHash "$pack\overlay.html" -Algorithm MD5).Hash + "   sticker css present: " + ((Get-Content "$pack\overlay.html" -Raw) -match 'round sticker on the corner')

"== 5. Render the real OBS URL with your real data"
$e = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$u = 'file:///C:/StreamerBot/ctpg-pack/overlay.html?planner=1&look=ticket&debug=1&previewbg=lab/offline-dca-wide.jpg'
$o = & $e --headless=new --disable-gpu --allow-file-access-from-files --user-data-dir="$env:TEMP\edgever" --virtual-time-budget=9000 --dump-dom $u 2>$null | Out-String
"  " + (([regex]::Matches($o, '<title>[^<]*<|id="card" class="[^"]*"|id="nowLabel"[^>]*>[^<]*<|id="now"[^>]*>.{0,60}|id="wait" class="[^"]*"><b>[^<]*<') | % Value) -join "`n  ")
& $e --headless=new --disable-gpu --allow-file-access-from-files --user-data-dir="$env:TEMP\edgever" --virtual-time-budget=9000 --window-size=1920,1080 --screenshot="$pack\lab\verify-live.png" $u 2>$null
Start-Sleep 2; "  screenshot saved"
