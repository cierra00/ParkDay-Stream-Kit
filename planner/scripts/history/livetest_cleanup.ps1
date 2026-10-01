# Remove the temporary test key; add charset=utf-8 to server replies; deploy; prove the key no longer works.
$ErrorActionPreference = 'Stop'
$app = 'C:\StreamerBot\ctpg-planner'; Set-Location $app
$env:CLOUDFLARE_ACCOUNT_ID = '<CLOUDFLARE_ACCOUNT_ID>'
$keys = Get-Content "$app\.keys.json" -Raw | ConvertFrom-Json; $tk = $keys.TEST_KEY
# 1. worker back to the pre-test version, plus the UTF-8 label
Copy-Item "$app\worker\index.js.bak-livetest" "$app\worker\index.js" -Force
$w = Get-Content "$app\worker\index.js" -Raw
$w = $w.Replace('"content-type": "application/json", "cache-control"', '"content-type": "application/json; charset=utf-8", "cache-control"')
[IO.File]::WriteAllText("$app\worker\index.js", $w)
"test key line gone: " + (-not $w.Contains('TEST_KEY')) + " | utf-8 label: " + $w.Contains('application/json; charset=utf-8')
npx wrangler deploy 2>&1 | Select-String -Pattern 'Deployed|error|Current Version' | % { $_.Line }
"y" | npx wrangler secret delete TEST_KEY 2>&1 | Select-String 'Success|error|Deleting' | % { $_.Line }
# 2. forget it locally
$keys.PSObject.Properties.Remove('TEST_KEY'); [IO.File]::WriteAllText("$app\.keys.json", ($keys | ConvertTo-Json))
"keys file now holds: " + (($keys.PSObject.Properties | % Name) -join ', ')
# 3. prove it
Start-Sleep 3
try { Invoke-RestMethod "https://planner.cruiseandthemeparkguide.com/api/whoami" -Headers @{ Authorization = "Bearer $tk" } | Out-Null; "test key: STILL WORKS (bad)" } catch { "test key rejected: " + $_.Exception.Response.StatusCode.value__ }
$r = Invoke-WebRequest "https://planner.cruiseandthemeparkguide.com/api/state?key=$($keys.OVERLAY_KEY)" -UseBasicParsing
"content-type now: " + $r.Headers['Content-Type']
"label reads correctly: " + ((($r.Content | ConvertFrom-Json).display.nowParts.label) -like '*·*')
