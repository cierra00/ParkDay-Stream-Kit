$pack = 'C:\StreamerBot\ctpg-pack'
"md5 lab: " + (Get-FileHash "$pack\lab\overlay.html" -Algorithm MD5).Hash
$e = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$cases = @(
  @('h', 'ride', 'On a ride', 'Haunted Mansion', 13, ''),
  @('h2', 'line', 'In line', 'Star Wars: Rise of the Resistance', 85, ''),
  @('v', 'ride', 'On a ride', 'Seven Dwarfs Mine Train', 7, '&layout=vertical')
)
foreach ($c in $cases) {
  $d = @{ now = 'x'; nowParts = @{ cat = $c[1]; label = $c[2]; title = $c[3]; sub = 'Magic Kingdom'; wait = $c[4] }; park = 'Magic Kingdom'; tz = 'America/New_York'; next = @{ time = ''; label = 'Space Mountain' }; shows = @() } | ConvertTo-Json -Compress -Depth 5
  $bg = if ($c[5]) { 'offline-dca-tall.jpg' } else { 'offline-dca-wide.jpg' }
  $size = if ($c[5]) { '1080,1920' } else { '1920,1080' }
  $u = "file:///C:/StreamerBot/ctpg-pack/lab/overlay.html?planner=1&look=ticket$($c[5])&previewbg=$bg&mock=" + [uri]::EscapeDataString($d)
  & $e --headless=new --disable-gpu --allow-file-access-from-files --user-data-dir="$env:TEMP\edgest" --virtual-time-budget=8000 --window-size=$size --screenshot="$pack\lab\sticker-$($c[0]).png" $u 2>$null
  Start-Sleep 2; "shot $($c[0])"
}
