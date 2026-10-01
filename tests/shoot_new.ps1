$pack = 'C:\StreamerBot\ctpg-pack'; $e = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$cases = @(
  @('concert', '{"cat":"concert","label":"Eat to the Beat","title":"New Found Glory","sub":"EPCOT"}'),
  @('skyliner', '{"cat":"travel","label":"Skyliner to","title":"Riviera Resort","sub":"From EPCOT","mode":"skyliner"}'),
  @('boat', '{"cat":"travel","label":"Boat to","title":"Disney Springs","sub":"From Hollywood Studios","mode":"boat"}'),
  @('bus', '{"cat":"travel","label":"","title":"Riding the Bus","sub":"From Magic Kingdom","mode":"bus"}')
)
foreach ($c in $cases) {
  $d = '{"now":"x","nowParts":' + $c[1] + ',"park":"EPCOT","tz":"America/New_York","next":null,"shows":[]}'
  $u = "file:///C:/StreamerBot/ctpg-pack/overlay.html?planner=1&look=ticket&previewbg=lab/offline-dca-wide.jpg&mock=" + [uri]::EscapeDataString($d)
  & $e --headless=new --disable-gpu --force-prefers-reduced-motion --allow-file-access-from-files --user-data-dir="$env:TEMP\edgenew" --virtual-time-budget=6000 --window-size=1920,1080 --screenshot="$pack\lab\new-$($c[0]).png" $u 2>$null
  Start-Sleep 3; "shot $($c[0])"
}

