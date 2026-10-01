param([string]$look = '', [string]$name = 'baseline')
$lab = 'C:\StreamerBot\ctpg-pack\lab'
foreach ($f in 'parkdata.js','plan.js','offline-dca-wide.jpg','offline-dca-tall.jpg') { if (-not (Test-Path "$lab\$f")) { Copy-Item "C:\StreamerBot\ctpg-pack\$f" $lab } }
$e = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$u = "file:///C:/StreamerBot/ctpg-pack/lab/lab.html?look=$look"
& $e --headless=new --disable-gpu --allow-file-access-from-files --user-data-dir="$env:TEMP\edgelab" --hide-scrollbars --virtual-time-budget=8000 --window-size=1950,3000 --screenshot="$lab\shot-$name.png" $u 2>$null
Start-Sleep 3
Get-Item "$lab\shot-$name.png" | Select-Object Name, Length
