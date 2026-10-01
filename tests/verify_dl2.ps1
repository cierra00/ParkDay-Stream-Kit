$pack = 'C:\StreamerBot\ctpg-pack'
$e = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$cases = @(
  @('ride-h', '{"cat":"ride","label":"On a ride","title":"Haunted Mansion Holiday","sub":"Disneyland","wait":45}', ''),
  @('line-h', '{"cat":"line","label":"In line Â· 120 min wait","title":"Matterhorn Bobsleds","sub":"Disneyland","wait":120}', ''),
  @('line-v', '{"cat":"line","label":"In line Â· 120 min wait","title":"Matterhorn Bobsleds","sub":"Disneyland","wait":120}', '&layout=vertical')
)
foreach ($c in $cases) {
  $parts = $c[1] | ConvertFrom-Json
  $d = @{ now = 'x'; nowParts = $parts; park = 'Disneyland'; tz = 'America/Los_Angeles'; next = $null; shows = @() } | ConvertTo-Json -Compress -Depth 5
  $bg = if ($c[2]) { 'lab/offline-dca-tall.jpg' } else { 'lab/offline-dca-wide.jpg' }
  $size = if ($c[2]) { '1080,1920' } else { '1920,1080' }
  $u = "file:///C:/StreamerBot/ctpg-pack/overlay.html?planner=1&look=ticket$($c[2])&previewbg=$bg&mock=" + [uri]::EscapeDataString($d)
  & $e --headless=new --disable-gpu --force-prefers-reduced-motion --allow-file-access-from-files --user-data-dir="$env:TEMP\edgedl" --virtual-time-budget=8000 --window-size=$size --screenshot="$pack\lab\dl-$($c[0]).png" $u 2>$null
  Start-Sleep 2
  $o = & $e --headless=new --disable-gpu --force-prefers-reduced-motion --allow-file-access-from-files --user-data-dir="$env:TEMP\edgedl" --virtual-time-budget=8000 --dump-dom $u 2>$null | Out-String
  "$($c[0]): " + (([regex]::Matches($o, 'id="nowLabel"[^>]*>[^<]*<|id="wait" class="[^"]*"><b>[^<]*<') | % Value) -join '  ')
}

