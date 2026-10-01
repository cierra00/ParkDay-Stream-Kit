# Screenshots the offline mockups with Edge (real fonts). Writes to previews\ only.
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$out = 'C:\StreamerBot\ctpg-pack\previews'
$base = 'file:///C:/StreamerBot/ctpg-pack/'
$shots = @(
  @('signal-current-h', 'screens.html?screen=signal', 1920, 1080),
  @('off-card-h', 'offline.html?style=card&bg=dca', 1920, 1080),
  @('off-card-v', 'offline.html?style=card&bg=dca&layout=vertical', 1080, 1920),
  @('off-window-h', 'offline.html?style=window&bg=monorail', 1920, 1080),
  @('off-window-v', 'offline.html?style=window&bg=monorail&layout=vertical', 1080, 1920),
  @('off-tint-h', 'offline.html?style=tint&bg=dca', 1920, 1080),
  @('off-tint-v', 'offline.html?style=tint&bg=dca&layout=vertical', 1080, 1920)
)
foreach ($s in $shots) {
  $png = "$out\$($s[0]).png"
  & $edge --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --virtual-time-budget=9000 "--window-size=$($s[2]),$($s[3])" "--screenshot=$png" "$base$($s[1])" 2>$null | Out-Null
  Start-Sleep -Milliseconds 300
  if (Test-Path $png) { & ffmpeg -y -v error -i $png -vf "scale='if(gt(iw,ih),1280,-2)':'if(gt(iw,ih),-2,1280)'" -q:v 3 "$out\$($s[0]).jpg"; "ok $($s[0])" } else { "FAILED $($s[0])" }
}
