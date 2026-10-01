# Live test setup: save the current plan, add a TEMPORARY test key (plan permission only), deploy.
$ErrorActionPreference = 'Stop'
$app = 'C:\StreamerBot\ctpg-planner'; Set-Location $app
$keys = Get-Content "$app\.keys.json" -Raw | ConvertFrom-Json
# 1. save the current plan exactly as the server has it
$state = Invoke-WebRequest "https://planner.cruiseandthemeparkguide.com/api/state?key=$($keys.OVERLAY_KEY)" -UseBasicParsing
[IO.File]::WriteAllText("$app\livetest-saved-state.json", $state.Content)
"saved current plan: $($state.Content.Length) bytes -> livetest-saved-state.json"
# 2. temporary key (never printed)
$bytes = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$tk = ([Convert]::ToBase64String($bytes)).Replace('+','A').Replace('/','B').Replace('=','')
$keys | Add-Member -NotePropertyName TEST_KEY -NotePropertyValue $tk -Force
[IO.File]::WriteAllText("$app\.keys.json", ($keys | ConvertTo-Json))
# 3. worker: accept the test key as a "tester" with plan permission only
$w = Get-Content "$app\worker\index.js" -Raw
Copy-Item "$app\worker\index.js" "$app\worker\index.js.bak-livetest"
$old = '  if (env.OVERLAY_KEY && safeEqual(code, env.OVERLAY_KEY)) return { role: "overlay", name: "OBS overlay", perms: [] };'
if (-not $w.Contains($old)) { throw "anchor not found" }
$new = $old + "`n  if (env.TEST_KEY && safeEqual(code, env.TEST_KEY)) return { role: `"tester`", name: `"Live test`", perms: [`"plan`"] };   // TEMPORARY live test"
[IO.File]::WriteAllText("$app\worker\index.js", $w.Replace($old, $new))
$env:CLOUDFLARE_ACCOUNT_ID = '<CLOUDFLARE_ACCOUNT_ID>'
$tk | npx wrangler secret put TEST_KEY 2>&1 | Select-String 'Success|error' | % { $_.Line }
npx wrangler deploy 2>&1 | Select-String -Pattern 'Deployed|error|Current Version' | % { $_.Line }
# 4. prove it: tester can write, overlay key still cannot
$h = @{ Authorization = "Bearer $tk" }
"tester whoami: " + (Invoke-RestMethod "https://planner.cruiseandthemeparkguide.com/api/whoami" -Headers $h).role
try { Invoke-WebRequest "https://planner.cruiseandthemeparkguide.com/api/state" -Method PUT -Headers @{ Authorization = "Bearer $($keys.OVERLAY_KEY)" } -Body '{}' -ContentType 'application/json' -UseBasicParsing | Out-Null; "overlay key PUT: allowed (BAD)" } catch { "overlay key PUT blocked: " + $_.Exception.Response.StatusCode.value__ }
