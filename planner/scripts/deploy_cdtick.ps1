# Top countdown only runs when the switch is On AND a stop is ticked with the timer box in the Plan tab.
$ErrorActionPreference = 'Stop'
$app = 'C:\StreamerBot\ctpg-planner'
Set-Location $app
$env:CLOUDFLARE_ACCOUNT_ID = '<CLOUDFLARE_ACCOUNT_ID>'
npx vite build 2>&1 | Select-String 'built in|error' | % { $_.Line }
if ($args[0] -eq 'deploy') { npx wrangler deploy 2>&1 | Select-String -Pattern 'Deployed|error|Current Version' | % { $_.Line } }
